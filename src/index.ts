import { Express } from 'express'

import Server from './server'
import env from './env'
import { logger } from './lib/logger'
;(async () => {
  const app: Express = await Server()

  app.listen(env.PORT, () => {
    logger.info(`openapi-ts-template listening on ${env.PORT} port`)
  })
})()
