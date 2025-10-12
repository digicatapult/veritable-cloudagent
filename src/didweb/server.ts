import cors from 'cors'
import express from 'express'
import fs from 'fs'
import type { Server } from 'http'
import https from 'https'
import { Logger } from 'pino'
import { DidWebDocument } from '../utils/didWebGenerator.js'
import { createRequestLogger } from '../utils/logger.js'
import Database from './db.js'
import { errorHandler, NotFoundError } from './error.js'

export interface DidWebServerConfig {
  enabled: boolean
  port: number
  useDevCert: boolean
  certPath: string
  keyPath: string
  didWebDomain: string
  serviceEndpoint?: string
}

/**
 * Validates the DID web server configuration
 */
function validateConfig(config: DidWebServerConfig): void {
  if (config.enabled) {
    if (!config.didWebDomain?.trim()) {
      throw new Error('DID web domain is required when server is enabled')
    }
    if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
      throw new Error(`Invalid port: ${config.port}. Must be a valid port number between 1 and 65535`)
    }
    if (config.useDevCert) {
      if (!config.certPath?.trim()) {
        throw new Error('Certificate path is required when using dev certificates')
      }
      if (!config.keyPath?.trim()) {
        throw new Error('Key path is required when using dev certificates')
      }
    }
  }
}

export class DidWebServer {
  private app: express.Application
  private server?: Server
  private logger: Logger
  private config: DidWebServerConfig
  private db: Database
  private didGenerator?: (domain: string, serviceEndpoint?: string) => Promise<DidWebDocument>

  constructor(logger: Logger, db: Database, config: DidWebServerConfig) {
    validateConfig(config)
    this.logger = logger.child({ component: 'did-web-server' })
    this.config = config
    this.app = express()
    this.db = db
    this.setupRoutes()
  }

  /**
   * Allows the main application to provide a DID generator function
   * This maintains loose coupling - the server can generate DIDs but doesn't depend on the agent
   */
  public setDidGenerator(generator: (domain: string, serviceEndpoint?: string) => Promise<DidWebDocument>): void {
    this.didGenerator = generator
  }

  private async generateDidIfNeeded(): Promise<void> {
    if (!this.didGenerator) {
      this.logger.info('No DID generator provided, skipping DID generation')
      return
    }

    try {
      const didDocument = await this.didGenerator(this.config.didWebDomain, this.config.serviceEndpoint)
      await this.upsertDid(didDocument)
      this.logger.info(`Successfully generated and stored DID: ${didDocument.id}`)
    } catch (error) {
      this.logger.error(`Failed to generate DID: ${String(error)}`)
      // Don't throw - DID generation failure shouldn't prevent server startup
    }
  }

  private setupRoutes(): void {
    this.app.use(createRequestLogger(this.logger))
    this.app.use(cors())
    this.app.get('/health', this.healthCheck)
    this.app.get(/.*did\.json$/, this.serveDid)
    this.app.use(errorHandler)
  }

  private healthCheck = async (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok' })
  }

  /**
   * Converts a request path to a did:web identifier
   * @param reqPath - The HTTP request path (e.g., '/.well-known/did.json' or '/path/to/did.json')
   * @returns The corresponding did:web identifier
   * @throws Error if the path doesn't end with 'did.json'
   */
  public reqPathToDid(reqPath: string): string {
    if (reqPath === '/.well-known/did.json' || reqPath === '/did.json') return `did:web:${this.config.didWebDomain}`

    if (!reqPath.endsWith('did.json')) throw new Error(`Invalid DID URL path: ${reqPath}`)

    const slashToColon = reqPath.replace(/\/did\.json$/, '').replaceAll('/', ':')

    return `did:web:${this.config.didWebDomain}${slashToColon}`
  }

  public serveDid = async (req: express.Request, res: express.Response) => {
    if (!this.db) throw new Error('Database not initialised')
    const did = this.reqPathToDid(req.path)
    const [record] = await this.db.get('did_web', { did })
    if (!record) throw new NotFoundError(`DID document not found: ${did}`)
    res.json(record.document)
  }

  public async upsertDid(document: DidWebDocument): Promise<void> {
    this.logger.info(`Uploading did to server: ${document.id}`)
    await this.db.upsert('did_web', { did: document.id, document }, 'did')
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }

    // Generate and store DID document if generator is available
    await this.generateDidIfNeeded()
    const setupGracefulExit = (sigName: NodeJS.Signals, server: Server, exitCode: number) => {
      process.on(sigName, async () => {
        server.close(() => {
          process.exit(exitCode)
        })
      })
    }

    if (this.config.useDevCert) {
      let httpsCredentials
      try {
        httpsCredentials = {
          cert: fs.readFileSync(this.config.certPath),
          key: fs.readFileSync(this.config.keyPath),
        }
      } catch {
        throw new Error(
          `Failed to read certificate or key file. certPath: ${this.config.certPath}, keyPath: ${this.config.keyPath}`
        )
      }
      this.server = https.createServer(httpsCredentials, this.app)
      this.server.listen(this.config.port, () => {
        this.logger.info(`DID:web server started on https port ${this.config.port}`)
      })
    } else {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info(`DID:web server started on http port ${this.config.port}`)
      })
    }

    setupGracefulExit('SIGINT', this.server, 0)
    setupGracefulExit('SIGTERM', this.server, 143)
  }
}
