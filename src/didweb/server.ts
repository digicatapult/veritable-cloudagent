import { DidDocument } from '@credo-ts/core'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import type { Server } from 'http'
import * as http from 'http'
import https from 'https'
import { Logger } from 'pino'
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
}

export class DidWebServer {
  private app: express.Application
  private server?: Server
  private logger: Logger
  private config: DidWebServerConfig
  private db: Database

  constructor(logger: Logger, db: Database, config: DidWebServerConfig) {
    this.logger = logger.child({ component: 'did-web-server' })
    this.config = config
    this.app = express()
    this.db = db
    this.setupRoutes()
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
    const did = this.reqPathToDid(req.path)
    const [record] = await this.db.get('did_web', { did })
    if (!record) throw new NotFoundError(`DID document not found: ${did}`)
    res.json(record.document)
  }

  public async upsertDid(document: DidDocument): Promise<void> {
    this.logger.info(`Uploading did to server: ${document.id}`)
    await this.db.upsert('did_web', { did: document.id, document: document.toJSON() }, 'did')
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
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
    } else {
      this.server = http.createServer(this.app)
    }

    const server = this.server
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(this.config.port, () => {
          server.removeListener('error', reject)
          resolve()
        })
      })
    } catch (error) {
      // Bind failed before the server ever started; clear it so stop() treats this as never-started.
      this.server = undefined
      throw error
    }

    this.logger.info(`DID:web server started on ${this.config.useDevCert ? 'https' : 'http'} port ${this.config.port}`)
  }

  async stop(): Promise<void> {
    if (!this.server || !this.server.listening) {
      return
    }

    const server = this.server
    this.server = undefined

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
            resolve()
            return
          }
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}
