import { type Agent } from '@credo-ts/core'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import type { Server } from 'http'
import https from 'https'
import { Client } from 'pg'
import pgFormat from 'pg-format'
import { Logger } from 'pino'
import { container } from 'tsyringe'
import { Env } from '../env.js'
import { DidWebDocGenerator, DidWebDocument } from '../utils/didWebGenerator.js'
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

export class DidWebServer {
  private app: express.Application
  private server?: Server
  private logger: Logger
  private config: DidWebServerConfig
  private db?: Database
  private didGenerator?: (domain: string, serviceEndpoint?: string) => Promise<DidWebDocument>

  // =============================================================================
  // STATIC FACTORY METHODS (Entry Points)
  // =============================================================================

  /**
   * Creates and starts a DID:web server with minimal coupling to the main application
   * Only requires the agent for DID generation - everything else is handled internally
   */
  public static async createAndStart(logger: Logger, agent?: Agent): Promise<DidWebServer> {
    const server = new DidWebServer(logger)

    // Set up DID generator if agent is provided and server is enabled
    if (agent && server.config.enabled) {
      const didWebGenerator = new DidWebDocGenerator(agent, logger)
      server.setDidGenerator(async (domain: string, serviceEndpoint?: string) => {
        const result = await didWebGenerator.generateDidWebDocument(domain, serviceEndpoint || '')
        return result.didDocument
      })
    }

    // Start the server (will handle its own database setup)
    await server.start()

    return server
  }

  // =============================================================================
  // CONSTRUCTOR
  // =============================================================================

  constructor(logger: Logger) {
    // Read configuration from environment variables internally
    const env = container.resolve(Env)
    this.config = {
      enabled: env.get('DID_WEB_ENABLED'),
      port: env.get('DID_WEB_PORT'),
      useDevCert: env.get('DID_WEB_USE_DEV_CERT'),
      certPath: env.get('DID_WEB_DEV_CERT_PATH'),
      keyPath: env.get('DID_WEB_DEV_KEY_PATH'),
      didWebDomain: env.get('DID_WEB_DOMAIN'),
      serviceEndpoint: env.get('DID_WEB_SERVICE_ENDPOINT'),
    }

    this.logger = logger.child({ component: 'did-web-server' })
    this.app = express()
    this.setupRoutes()
  }

  // =============================================================================
  // PUBLIC API METHODS (What external code can call)
  // =============================================================================

  /**
   * Allows the main application to provide a DID generator function
   * This maintains loose coupling - the server can generate DIDs but doesn't depend on the agent
   */
  public setDidGenerator(generator: (domain: string, serviceEndpoint?: string) => Promise<DidWebDocument>): void {
    this.didGenerator = generator
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }

    // Initialize database before starting server
    await this.initialiseDatabase()

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

  public async upsertDid(document: DidWebDocument): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    this.logger.info(`Uploading did to server: ${document.id}`)
    await this.db.upsert('did_web', { did: document.id, document }, 'did')
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

  // =============================================================================
  // ROUTE HANDLERS (Express endpoints)
  // =============================================================================

  public serveDid = async (req: express.Request, res: express.Response) => {
    if (!this.db) throw new Error('Database not initialised')
    const did = this.reqPathToDid(req.path)
    const [record] = await this.db.get('did_web', { did })
    if (!record) throw new NotFoundError(`DID document not found: ${did}`)
    res.json(record.document)
  }

  private healthCheck = async (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok' })
  }

  // =============================================================================
  // PRIVATE INITIALIZATION METHODS (Grouped by concern)
  // =============================================================================

  /**
   * Creates and initializes the database for DID:web server
   * This handles database setup internally, maintaining loose coupling
   */
  private async initialiseDatabase(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled, skipping database initialization')
      return
    }

    const env = container.resolve(Env)
    const storageType = env.get('STORAGE_TYPE')

    // Only initialize PostgreSQL database if storage type is postgres
    if (storageType === 'postgres') {
      try {
        // Ensure the database exists
        await this.ensureDatabaseExists()
        this.logger.info('DID:web server PostgreSQL database exists')

        // Create PostgreSQL database connection
        this.db = new Database({
          database: env.get('DID_WEB_DB_NAME') as string,
          host: env.get('POSTGRES_HOST') as string,
          port: env.get('POSTGRES_PORT') as number,
          user: env.get('POSTGRES_USERNAME') as string,
          password: env.get('POSTGRES_PASSWORD') as string,
        })
      } catch (error) {
        this.logger.error(`Failed to initialize PostgreSQL database: ${String(error)}`)
        throw error
      }
    } else if (storageType === 'sqlite') {
      // For SQLite, no database creation needed, just log
      this.logger.info('DID:web server using SQLite storage (no database initialisation required)')
      // SQLite doesn't need a separate database connection for DID:web server
      // The Credo agent handles SQLite storage internally
    } else {
      throw new Error(`Unsupported storage type: ${storageType}`)
    }
  }

  /**
   * Ensures that the target database exists by creating it if necessary.
   * This function connects to the 'postgres' database to create the target database.
   * Uses environment variables for configuration (validated by envalid).
   */
  private async ensureDatabaseExists(): Promise<void> {
    const env = container.resolve(Env)
    const host = env.get('POSTGRES_HOST') as string
    const user = env.get('POSTGRES_USERNAME') as string
    const password = env.get('POSTGRES_PASSWORD') as string
    const port = env.get('POSTGRES_PORT') as number
    const targetDatabase = env.get('DID_WEB_DB_NAME') as string

    // Create a connection to the default 'postgres' database to create our target database
    const adminClient = new Client({
      host,
      user,
      password,
      port,
      database: 'postgres', // Connect to default postgres database
    })

    try {
      await adminClient.connect()
      this.logger.info(`Connected to PostgreSQL server at ${host}:${port}`)

      // Check if database exists
      const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase])

      if (result.rows.length === 0) {
        // Database doesn't exist, create it
        this.logger.info(`Creating database: ${targetDatabase}`)
        // Use pg-format for proper SQL identifier escaping to prevent SQL injection
        const createDbQuery = pgFormat('CREATE DATABASE %I', targetDatabase)
        await adminClient.query(createDbQuery)
        this.logger.info(`Successfully created database: ${targetDatabase}`)
      } else {
        this.logger.info(`Database ${targetDatabase} already exists`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to ensure database ${targetDatabase} exists: ${errorMessage}`)

      // Provide more specific error messages for common issues
      if (errorMessage.includes('ECONNREFUSED')) {
        this.logger.error(`Cannot connect to PostgreSQL server at ${host}:${port}. Is the server running?`)
      } else if (errorMessage.includes('authentication failed')) {
        this.logger.error(`Authentication failed for user ${user}. Check username and password.`)
      } else if (errorMessage.includes('permission denied')) {
        this.logger.error(`User ${user} does not have permission to create databases.`)
      }

      throw error
    } finally {
      try {
        await adminClient.end()
      } catch (endError) {
        this.logger.warn(`Warning: Failed to close database connection: ${String(endError)}`)
      }
    }
  }

  private setupRoutes(): void {
    this.app.use(createRequestLogger(this.logger))
    this.app.use(cors())
    this.app.get('/health', this.healthCheck)
    this.app.get(/.*did\.json$/, this.serveDid)
    this.app.use(errorHandler)
  }

  // =============================================================================
  // PRIVATE BUSINESS LOGIC METHODS
  // =============================================================================

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
}
