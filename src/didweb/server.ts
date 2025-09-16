import cors from 'cors'
import express from 'express'
import fs from 'fs'
import https from 'https'
import { createRequestLogger } from '../utils/logger.js'

import { Logger } from 'pino'
import { errorHandler } from './error.js'

export interface DidWebServerConfig {
  enabled: boolean
  port: number
  useHttps: boolean
  certPath: string
  keyPath: string
}

export class DidWebServer {
  private app: express.Application
  private server?: https.Server
  private logger: Logger
  private config: DidWebServerConfig

  constructor(logger: Logger, config: DidWebServerConfig) {
    this.logger = logger
    this.config = config

    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(createRequestLogger(this.logger))
    this.app.use(cors())

    this.app.get('/health', this.healthCheck)

    this.app.use(errorHandler)
  }

  private healthCheck = async (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok' })
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('DID:web server disabled')
      return
    }
    if (!this.config.useHttps) {
      this.app.listen(this.config.port, () => {
        this.logger.info(`DID:web server started on http port ${this.config.port}`)
      })
      return
    }
    let httpsCredentials
    try {
      httpsCredentials = {
        cert: fs.readFileSync(this.config.certPath),
        key: fs.readFileSync(this.config.keyPath),
      }
    } catch {
      throw new Error('Failed to read certificate or key file. Have you generated them?')
    }

    this.server = https.createServer(httpsCredentials, this.app)
    this.server.listen(this.config.port, () => {
      this.logger.info(`DID:web server started on https port ${this.config.port}`)
    })
  }
}
