/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseLogger, LogLevel as CredoLogLevel } from '@credo-ts/core'
import pino, { LevelWithSilent, Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import { randomUUID } from 'crypto'
import type { Request as ExRequest, Response as ExResponse } from 'express'
import type { UUID } from '../controllers/types.js'

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
  private _logger: Logger

  // Map our log levels to tslog levels

  public constructor(logLevel: LevelWithSilent, logger?: Logger) {
    super(tsLogLevelMap[logLevel])

    this._logger =
      logger ||
      pino(
        {
          name: 'veritable-cloudagent',
          timestamp: true,
          level: logLevel,
        },
        process.stdout
      )
  }

  public get logger() {
    return this._logger
  }

  public child(bindings: pino.Bindings): PinoLogger {
    const child = this._logger.child(bindings)
    return new PinoLogger(invTsLogLevelMap[this.logLevel], child)
  }

  private log(level: Exclude<CredoLogLevel, CredoLogLevel.off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = invTsLogLevelMap[level]
    if (data) return this._logger[tsLogLevel]('%s %o', message, data)
    this._logger[tsLogLevel](message)
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

export function createRequestLogger(logger: PinoLogger) {
  return pinoHttp({
    logger: logger.logger,
    serializers: {
      req: ({ id, headers, ...req }: { id: UUID; headers: Record<string, string> }) => ({
        ...req,
        headers: {},
      }),
      res: (res) => {
        delete res.headers
        return res
      },
    },
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
}
