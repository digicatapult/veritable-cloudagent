/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseLogger, LogLevel as CredoLogLevel } from '@credo-ts/core'
import { LevelWithSilent, Logger, pino } from 'pino'

const tsLogLevelMap = {
  silent: CredoLogLevel.off,
  trace: CredoLogLevel.trace,
  debug: CredoLogLevel.debug,
  info: CredoLogLevel.info,
  warn: CredoLogLevel.warn,
  error: CredoLogLevel.error,
  fatal: CredoLogLevel.fatal,
} as const

const invTsLogLevelMap = {
  [CredoLogLevel.off]: 'silent' as const,
  [CredoLogLevel.test]: 'trace' as const,
  [CredoLogLevel.trace]: 'trace' as const,
  [CredoLogLevel.debug]: 'debug' as const,
  [CredoLogLevel.info]: 'info' as const,
  [CredoLogLevel.warn]: 'warn' as const,
  [CredoLogLevel.error]: 'error' as const,
  [CredoLogLevel.fatal]: 'fatal' as const,
} as const

export type LogLevel = LevelWithSilent

export default class PinoLogger extends BaseLogger {
  private logger: Logger

  // Map our log levels to tslog levels

  public constructor(logLevel: LevelWithSilent) {
    super(tsLogLevelMap[logLevel])

    this.logger = pino(
      {
        name: 'veritable-cloudagent',
        timestamp: true,
        level: logLevel,
      },
      process.stdout
    )
  }

  private log(level: Exclude<CredoLogLevel, CredoLogLevel.off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = invTsLogLevelMap[level]
    if (data) return this.logger[tsLogLevel]('%s %o', message, data)
    this.logger[tsLogLevel](message)
  }

  public test(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.test, message, data)
  }

  public trace(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.trace, message, data)
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.debug, message, data)
  }

  public info(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.info, message, data)
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.warn, message, data)
  }

  public error(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.error, message, data)
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.fatal, message, data)
  }
}
