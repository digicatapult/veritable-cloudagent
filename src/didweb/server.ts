import type PinoLogger from '../utils/logger.js'

import cors from 'cors'
import express from 'express'
import fs from 'fs'
import https from 'https'

import { container } from 'tsyringe'
import { Env } from '../env.js'
import { errorHandler } from '../error.js'
import { createRequestLogger } from '../utils/logger.js'

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
  private logger: PinoLogger
  private config: DidWebServerConfig

  constructor(logger: PinoLogger) {
    const env = container.resolve(Env)
    this.logger = logger.child({ component: 'did-web-server' })
    this.config = {
      enabled: env.get('DID_WEB_ENABLED'),
      port: env.get('DID_WEB_PORT'),
      useHttps: env.get('DID_WEB_USE_HTTPS'),
      certPath: env.get('DID_WEB_HTTPS_CERT_PATH'),
      keyPath: env.get('DID_WEB_HTTPS_KEY_PATH'),
    }

    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.use(createRequestLogger(this.logger))
    this.app.use(cors())

    this.app.get('/health', this.healthCheck)

    this.app.use(errorHandler(this.logger))
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
    } catch (err) {
      throw new Error('Failed to read certificate or key file. Have you generated them?')
    }

    this.server = https.createServer(httpsCredentials, this.app)
    this.server.listen(this.config.port, () => {
      this.logger.info(`DID:web server started on https port ${this.config.port}`)
    })
  }
}
