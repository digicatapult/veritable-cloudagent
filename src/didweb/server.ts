import type { RestAgent } from '../agent.js'
import type PinoLogger from '../utils/logger.js'

import { certificateFor } from '@expo/devcert'
import express from 'express'
import https from 'https'
import { container } from 'tsyringe'

import { Env } from '../env.js'
import { DidWebService } from './service.js'

export interface DidWebServerConfig {
  enabled: boolean
  port: number
  didId: string
}

export class DidWebServer {
  private app: express.Application
  private server?: https.Server
  private logger: PinoLogger
  private config: DidWebServerConfig
  private didWebService: DidWebService

  constructor(agent: RestAgent, logger: PinoLogger, useMockDatabase?: boolean) {
    const env = container.resolve(Env)
    this.logger = logger.child({ component: 'did-web-server' })
    this.config = {
      enabled: env.get('DID_WEB_ENABLED'),
      port: env.get('DID_WEB_PORT'),
      didId: env.get('DID_WEB_DID_ID'),
    }
    
    this.didWebService = new DidWebService(agent, this.logger, undefined, useMockDatabase)
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    // Add request logging
    this.app.use((req, _res, next) => {
      this.logger.debug(`${req.method} ${req.path}`)
      next()
    })

    // Add CORS headers for did:web resolution
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      res.header('Content-Type', 'application/json')
      next()
    })

    // Handle .well-known/did.json requests
    this.app.get('/.well-known/did.json', this.handleWellKnownDidRequest.bind(this))
    
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this))
    
    // Fallback for other requests
    this.app.use((req, res) => {
      this.logger.warn(`DID document not found for path: ${req.path}`)
      res.status(404).json({ error: 'DID document not found' })
    })
  }

  private async handleWellKnownDidRequest(_req: express.Request, res: express.Response): Promise<void> {
    try {
      this.logger.info('DID document requested at /.well-known/did.json')

      // Get the DID document for the configured DID ID
      const didDocument = await this.didWebService.getDidDocument(this.config.didId)
      if (!didDocument) {
        this.logger.warn(`DID document not found for: ${this.config.didId}`)
        res.status(404).json({ error: 'DID document not found' })
        return
      }

      this.logger.info(`Serving DID document for: ${this.config.didId}`)
      res.json(didDocument)
    } catch (error) {
      this.logger.error(`Error serving DID document: ${error}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  private async handleHealthCheck(_req: express.Request, res: express.Response): Promise<void> {
    res.json({ status: 'ok', service: 'did:web-server' })
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }

    try {
      // Initialize the service and database
      await this.didWebService.init()
      
      // Initialize the DID if it doesn't exist
      await this.didWebService.ensureDidExists(this.config.didId)

      // Get HTTPS credentials for local development
      const httpsCredentials = await certificateFor('localhost')

      this.server = https.createServer(httpsCredentials, this.app)

      return new Promise((resolve, reject) => {
        if (!this.server) {
          reject(new Error('Server not initialized'))
          return
        }

        this.server.listen(this.config.port, 'localhost', () => {
          this.logger.info(
            `DID:web server started on https://localhost:${this.config.port}`
          )
          resolve()
        })

        this.server.on('error', (error) => {
          this.logger.error(`DID:web server error: ${error}`)
          reject(error)
        })
      })
    } catch (error) {
      this.logger.error(`Failed to start DID:web server: ${error}`)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger.info('DID:web server stopped')
          resolve()
        })
      })
    }
    
    // Close database connections
    await this.didWebService.close()
  }

  getConfig(): DidWebServerConfig {
    return { ...this.config }
  }
}