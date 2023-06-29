import pino, { Logger } from 'pino'

import env from '../env'

export const logger: Logger = pino(
  {
    name: 'openapi-ts-template',
    timestamp: true,
    level: env.LOG_LEVEL,
  },
  process.stdout
)
