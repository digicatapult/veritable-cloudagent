import 'reflect-metadata'
import express, { type Response as ExResponse, type Request as ExRequest } from 'express'
import { Agent } from '@credo-ts/core'
import bodyParser from 'body-parser'
import cors from 'cors'
import { serve, generateHTML } from 'swagger-ui-express'
import { container } from 'tsyringe'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import type { ServerConfig } from './utils/ServerConfig.js'
import type { RestAgent } from './utils/agent.js'
import { basicMessageEvents } from './events/BasicMessageEvents.js'
import { connectionEvents } from './events/ConnectionEvents.js'
import { credentialEvents } from './events/CredentialEvents.js'
import { proofEvents } from './events/ProofEvents.js'
import { trustPingEvents } from './events/TrustPingEvents.js'
import { drpcEvents } from './events/DrpcEvents.js'
import { verifiedDrpcEvents } from './events/VerifiedDrpcEvents.js'
//import { VerifiedDrpcService } from './verified-drpc/VerifiedDrpcService.js'
import { RegisterRoutes } from './routes/routes.js'
import { errorHandler } from './error.js'
import PolicyAgent from './policyAgent/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const setupServer = async (agent: RestAgent, config: ServerConfig) => {
  const swaggerBuffer = await fs.readFile(path.join(__dirname, './routes/swagger.json'))
  const swaggerJson = JSON.parse(swaggerBuffer.toString('utf8'))

  container.registerInstance(Agent, agent as Agent)
  container.registerInstance(PolicyAgent, new PolicyAgent(config.opaOrigin || 'http://localhost:8181'))

  const app = config.app ?? express()
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

  // Use body parser to read sent json payloads
  app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  )
  app.use(bodyParser.json())

  app.use('/docs', serve, async (_req: ExRequest, res: ExResponse) => {
    return res.send(
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

  RegisterRoutes(app)

  app.use((req, res, next) => {
    if (req.url == '/') {
      res.redirect('/docs')
      return
    }
    next()
  })

  app.use(errorHandler(agent.config.logger))

  return app
}
