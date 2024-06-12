import { pino, Logger } from 'pino'

export interface ILogger extends Logger {
  logLevel?: number // due to @creado-ts this is rquired property or fork
  test?(message: string, data?: Record<string, string>): void // same here
}

const logger: ILogger = pino(
  {
    name: 'sqnc-matchmaker-api',
    timestamp: true,
    level: 'debug',
  },
  process.stdout
)

export default logger
