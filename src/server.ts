import { Agent } from '@credo-ts/core'
import cors from 'cors'
import express, { type Express, type Request as ExRequest, type Response as ExResponse } from 'express'
import fs from 'fs/promises'
import path from 'path'
import 'reflect-metadata'
import { serve, setup } from 'swagger-ui-express'
import { container } from 'tsyringe'
import { fileURLToPath } from 'url'

import type { ServerConfig } from './utils/ServerConfig.js'

import { RestAgent } from './agent.js'
import { errorHandler } from './error.js'
import { basicMessageEvents } from './events/BasicMessageEvents.js'
import { connectionEvents } from './events/ConnectionEvents.js'
import { credentialEvents } from './events/CredentialEvents.js'
import { drpcEvents } from './events/DrpcEvents.js'
import { proofEvents } from './events/ProofEvents.js'
import { trustPingEvents } from './events/TrustPingEvents.js'
import { verifiedDrpcEvents } from './events/VerifiedDrpcEvents.js'
import { RegisterRoutes } from './routes/routes.js'
import PinoLogger, { createRequestLogger } from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const createAdminApiApp = (logger: PinoLogger): Express => {
  const adminApiApp = express()
  adminApiApp.use(createRequestLogger(logger.logger))
  return adminApiApp
}

export const setupAdminApi = async (
  agent: RestAgent,
  logger: PinoLogger,
  config: ServerConfig,
  adminApiApp: Express = createAdminApiApp(logger)
) => {
  const swaggerBuffer = await fs.readFile(path.join(__dirname, '..', 'build', 'routes', 'swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))
  const swaggerUiOpts = {
    customCss: `body { background-color: ${config.personaColor} }
      .swagger-ui .scheme-container { background-color: inherit }
      .swagger-ui .opblock .opblock-section-header { background: inherit }
      .topbar { display: none }
      .swagger-ui .btn.authorize { background-color: #f7f7f7 }
      .swagger-ui .opblock.opblock-post { background: rgba(73,204,144,.3) }
      .swagger-ui .opblock.opblock-get { background: rgba(97,175,254,.3) }
      .swagger-ui .opblock.opblock-delete { background: rgba(249,62,62,.3) }
      .swagger-ui section.models { background-color: #f7f7f7 } `,
    customSiteTitle: `${config.personaTitle}`,
  }

  container.registerInstance(Agent, agent as Agent)

  if (config.cors) adminApiApp.use(cors())

  if (config.socketServer || (config.webhookUrl && config.webhookUrl.length > 0)) {
    basicMessageEvents(agent, config)
    connectionEvents(agent, config)
    credentialEvents(agent, config)
    proofEvents(agent, config)
    trustPingEvents(agent, config)
    drpcEvents(agent, config)
    verifiedDrpcEvents(agent, config)
  }

  // Use Express native body parser to read sent json payloads
  adminApiApp.use(express.urlencoded({ extended: true }))
  adminApiApp.use(express.json())

  adminApiApp.get('/', (_req: ExRequest, res: ExResponse) => {
    res.redirect('/swagger')
  })

  adminApiApp.use('/swagger', serve, setup(swaggerJson, swaggerUiOpts))

  adminApiApp.get('/api-docs', (_req: ExRequest, res: ExResponse) => {
    res.json(swaggerJson)
  })

  RegisterRoutes(adminApiApp)

  adminApiApp.use(errorHandler(agent.config.logger))

  return adminApiApp
}
