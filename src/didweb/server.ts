import cors from 'cors'
import express from 'express'
import fs from 'fs'
import type { Server } from 'http'
import https from 'https'
import { Logger } from 'pino'
import { createRequestLogger } from '../utils/logger.js'
import { errorHandler } from './error.js'

export interface DidWebServerConfig {
  enabled: boolean
  port: number
  useDevCert: boolean
  certPath: string
  keyPath: string
}

export class DidWebServer {
  private app: express.Application
  private server?: Server
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
    }

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
