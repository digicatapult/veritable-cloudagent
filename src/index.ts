#!/usr/bin/env node
import 'reflect-metadata'

import { container } from 'tsyringe'
import { startCloudagent } from './bootstrap.js'
import { Env } from './env.js'
import PinoLogger from './utils/logger.js'

const env = container.resolve(Env)
const logger = new PinoLogger(env.get('LOG_LEVEL'))
container.register(PinoLogger, {
  useValue: logger,
})

let cloudagent
try {
  cloudagent = await startCloudagent(env, logger)
} catch (error) {
  logger.error('Startup failed', { error })
  process.exit(1)
}

let shuttingDown = false
const shutdown = async (signal: NodeJS.Signals, exitCode: number) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Received ${signal}. Shutting down`)

  try {
    await cloudagent!.shutdown()
    process.exit(exitCode)
  } catch (error) {
    logger.error('Shutdown failed', { error })
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT', 0)
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM', 143)
})
