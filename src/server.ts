import { Agent } from '@credo-ts/core'
import cors from 'cors'
import express, { NextFunction, type Request as ExRequest, type Response as ExResponse } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { pinoHttp as requestLogger } from 'pino-http'
import 'reflect-metadata'
import { generateHTML } from 'swagger-ui-express'
import { container } from 'tsyringe'
import { fileURLToPath } from 'url'

import type { ServerConfig } from './utils/ServerConfig.js'

import { randomUUID } from 'crypto'
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
import PinoLogger from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const setupServer = async (agent: RestAgent, logger: PinoLogger, config: ServerConfig) => {
  const swaggerBuffer = await fs.readFile(path.join(__dirname, '..', 'build', 'routes', 'swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))

  container.registerInstance(Agent, agent as Agent)

  const app = express()

  app.use(
    requestLogger({
      logger: logger.logger,
      genReqId: function (req: ExRequest, res: ExResponse): string {
        const id: string = (req.headers['x-request-id'] as string) || (req.id as string) || randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      quietReqLogger: true,
      customAttributeKeys: {
        reqId: 'req_id',
      },
    })
  )

  if (config.cors) app.use(cors())

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
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())

  // app.get('/', (_req: ExRequest, res: ExResponse) => {
  //   res.redirect('/swagger')
  // })

  app.get('/swagger', (_req: ExRequest, res: ExResponse) => {
    res.send(
      generateHTML(swaggerJson, {
        ...(config.personaColor && {
          customCss: `body { background-color: ${config.personaColor} } 
        .swagger-ui .scheme-container { background-color: inherit }
        .swagger-ui .opblock .opblock-section-header { background: inherit }
        .topbar { display: none }
        .swagger-ui .btn.authorize { background-color: #f7f7f7 } 
        .swagger-ui .opblock.opblock-post { background: rgba(73,204,144,.3) } 
        .swagger-ui .opblock.opblock-get { background: rgba(97,175,254,.3) } 
        .swagger-ui .opblock.opblock-delete { background: rgba(249,62,62,.3) } 
        .swagger-ui section.models { background-color: #f7f7f7 } `,
        }),
        ...(config.personaTitle && { customSiteTitle: config.personaTitle }),
      })
    )
  })

  app.get('/api-docs', (_req: ExRequest, res: ExResponse) => {
    res.json(swaggerJson)
  })

  RegisterRoutes(app)

  app.use((req: ExRequest, res: ExResponse, next: NextFunction) => {
    if (req.url == '/') {
      res.redirect('/swagger')
      return
    }
    next()
  })

  app.use(errorHandler(agent.config.logger))

  return app
}
