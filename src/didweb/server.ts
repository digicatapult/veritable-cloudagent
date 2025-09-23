import cors from 'cors'
import express from 'express'
import fs from 'fs'
import type { Server } from 'http'
import https from 'https'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
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
  didWebDir: string
  didWebDomain: string
}

export class DidWebServer {
  private app: express.Application
  private server?: Server
  private logger: Logger
  private config: DidWebServerConfig
  private db: Database

  constructor(logger: Logger, db: Database, config: DidWebServerConfig) {
    this.logger = logger
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

  public reqPathToDid(reqPath: string): string {
    if (reqPath === '/.well-known/did.json' || reqPath === '/did.json') return `did:web:${this.config.didWebDomain}`

    if (!reqPath.endsWith('did.json')) throw new Error(`Invalid DID URL path: ${reqPath}`)

    const slashToColon = reqPath.replace(/\/did\.json$/, '').replaceAll('/', ':')

    return `did:web:${this.config.didWebDomain}${slashToColon}`
  }

  private serveDid = async (req: express.Request, res: express.Response) => {
    const did = this.reqPathToDid(req.path)
    const [record] = await this.db.get('did_web', { did })
    if (!record) throw new NotFoundError(`DID document not found: ${did}`)
    res.json(record.document)
  }

  private async loadDidDocuments(): Promise<void> {
    try {
      await access(this.config.didWebDir)
    } catch {
      this.logger.warn(`DID directory '${this.config.didWebDir}' does not exist`)
      return
    }
    this.logger.info(`Loading DIDs from '${this.config.didWebDir}' directory`)
    const dirents = await readdir(this.config.didWebDir, { withFileTypes: true })
    const files = dirents.filter((f) => f.isFile() && f.name.endsWith('.json'))
    await Promise.all(
      files.map(async (f) => {
        const raw = await readFile(path.join(this.config.didWebDir, f.name), 'utf8')
        await this.upsertDid(raw, f.name)
      })
    )
  }

  public async upsertDid(file: string, filename: string): Promise<void> {
    let json
    try {
      json = JSON.parse(file)
    } catch {
      this.logger.info(`File '${filename}' contains invalid JSON`)
      return
    }

    if (json?.id && typeof json.id === 'string') {
      this.logger.info(`Loading DID '${json.id}'`)
      await this.db.upsert('did_web', { did: json.id, document: json }, 'did')
    }
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }
    await this.loadDidDocuments()
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
