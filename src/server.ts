import 'reflect-metadata'
import type { ServerConfig } from './utils/ServerConfig'
import type { RestAgent } from './utils/agent'
import type { Response as ExResponse, Request as ExRequest } from 'express'

import { Agent } from '@aries-framework/core'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import { serve, generateHTML } from 'swagger-ui-express'
import { container } from 'tsyringe'

import { basicMessageEvents } from './events/BasicMessageEvents'
import { connectionEvents } from './events/ConnectionEvents'
import { credentialEvents } from './events/CredentialEvents'
import { proofEvents } from './events/ProofEvents'
import { RegisterRoutes } from './routes/routes'
import { errorHandler } from './error'

export const setupServer = async (agent: RestAgent, config: ServerConfig) => {
  container.registerInstance(Agent, agent as Agent)

  const app = config.app ?? express()
  if (config.cors) app.use(cors())

  if (config.socketServer || config.webhookUrl) {
    basicMessageEvents(agent, config)
    connectionEvents(agent, config)
    credentialEvents(agent, config)
    proofEvents(agent, config)
  }

  // Use body parser to read sent json payloads
  app.use(
    bodyParser.urlencoded({
      extended: true,
    })
  )
  app.use(bodyParser.json())
  app.use('/docs', serve, async (_req: ExRequest, res: ExResponse) => {
    return res.send(generateHTML(await import('./routes/swagger.json')))
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
