import type { RestAgent } from '../agent.js'
import type PinoLogger from '../utils/logger.js'

import { certificateFor } from '@expo/devcert'
import express from 'express'
import https from 'https'
import path from 'path'
import { container } from 'tsyringe'

import { Env } from '../env.js'
import { DidWebService } from './service.js'

export interface DidWebServerConfig {
  enabled: boolean
  port: number
  host: string
  didId: string
}

export class DidWebServer {
  private app: express.Application
  private server?: https.Server
  private logger: PinoLogger
  private config: DidWebServerConfig
  private didWebService: DidWebService

  constructor(agent: RestAgent, logger: PinoLogger) {
    const env = container.resolve(Env)
    this.logger = logger.child({ component: 'did-web-server' })
    this.config = {
      enabled: env.get('DID_WEB_ENABLED'),
      port: env.get('DID_WEB_PORT'),
      host: env.get('DID_WEB_HOST'),
      didId: env.get('DID_WEB_DID_ID'),
    }
    
    this.didWebService = new DidWebService(agent, this.logger)
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    // Add request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`)
      next()
    })

    // Add CORS headers for did:web resolution
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      res.header('Content-Type', 'application/json')
      next()
    })

    // Handle did:web resolution paths
    // Path format: /.well-known/did.json or /path/to/did/did.json
    this.app.get('/.well-known/did.json', this.handleDidRequest.bind(this))
    this.app.get(/.*\/did\.json$/, this.handleDidRequest.bind(this))
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'did:web-server' })
    })

    // Fallback for other requests
    this.app.use((req, res) => {
      this.logger.warn(`DID document not found for path: ${req.path}`)
      res.status(404).json({ error: 'DID document not found' })
    })
  }

  private async handleDidRequest(req: express.Request, res: express.Response): Promise<void> {
    try {
      const requestedPath = req.path
      this.logger.info(`DID document requested for path: ${requestedPath}`)

      // Construct the did:web identifier from the request
      const didId = this.constructDidFromPath(req)
      this.logger.debug(`Constructed DID: ${didId}`)

      const didDocument = await this.didWebService.getDidDocument(didId)
      if (!didDocument) {
        this.logger.warn(`DID document not found for: ${didId}`)
        res.status(404).json({ error: 'DID document not found' })
        return
      }

      this.logger.info(`Serving DID document for: ${didId}`)
      res.json(didDocument)
    } catch (error) {
      this.logger.error(`Error serving DID document: ${error}`)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  private constructDidFromPath(req: express.Request): string {
    const host = req.get('host') || `${this.config.host}:${this.config.port}`
    const pathname = req.path

    // Handle .well-known/did.json case (root DID)
    if (pathname === '/.well-known/did.json') {
      return `did:web:${host.replace(/:/g, '%3A')}`
    }

    // Handle path-based DID (remove /did.json suffix and convert slashes to colons)
    const pathWithoutDidJson = pathname.replace(/\/did\.json$/, '')
    const pathParts = pathWithoutDidJson.split('/').filter(part => part.length > 0)
    const didPath = pathParts.join(':')
    
    return `did:web:${host.replace(/:/g, '%3A')}:${didPath}`
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }

    try {
      // Initialize the DID if it doesn't exist
      await this.didWebService.ensureDidExists(this.config.didId)

      // Get HTTPS credentials for local development
      const httpsCredentials = await certificateFor(this.config.host)

      this.server = https.createServer(httpsCredentials, this.app)

      return new Promise((resolve, reject) => {
        if (!this.server) {
          reject(new Error('Server not initialized'))
          return
        }

        this.server.listen(this.config.port, this.config.host, () => {
          this.logger.info(
            `DID:web server started on https://${this.config.host}:${this.config.port}`
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
    if (!this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.logger.info('DID:web server stopped')
        resolve()
      })
    })
  }

  getConfig(): DidWebServerConfig {
    return { ...this.config }
  }
}