/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseLogger, LogLevel as CredoLogLevel } from '@credo-ts/core'
import { randomUUID } from 'crypto'
import type { Request as ExRequest, Response as ExResponse } from 'express'
import pino, { LevelWithSilent, Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { UUID } from '../controllers/types/index.js'

const tsLogLevelMap = {
  silent: CredoLogLevel.Off,
  trace: CredoLogLevel.Trace,
  debug: CredoLogLevel.Debug,
  info: CredoLogLevel.Info,
  warn: CredoLogLevel.Warn,
  error: CredoLogLevel.Error,
  fatal: CredoLogLevel.Fatal,
} as const

const invTsLogLevelMap = {
  [CredoLogLevel.Off]: 'silent' as const,
  [CredoLogLevel.Test]: 'trace' as const,
  [CredoLogLevel.Trace]: 'trace' as const,
  [CredoLogLevel.Debug]: 'debug' as const,
  [CredoLogLevel.Info]: 'info' as const,
  [CredoLogLevel.Warn]: 'warn' as const,
  [CredoLogLevel.Error]: 'error' as const,
  [CredoLogLevel.Fatal]: 'fatal' as const,
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

  private log(level: Exclude<CredoLogLevel, CredoLogLevel.Off>, message: string, data?: Record<string, any>): void {
    const tsLogLevel = invTsLogLevelMap[level]
    if (data) return this._logger[tsLogLevel]('%s %o', message, data)
    this._logger[tsLogLevel](message)
  }

  public test(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Test, message, data)
  }

  public trace(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Trace, message, data)
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Debug, message, data)
  }

  public info(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Info, message, data)
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Warn, message, data)
  }

  public error(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Error, message, data)
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.log(CredoLogLevel.Fatal, message, data)
  }
}

export function createRequestLogger(logger: Logger) {
  return pinoHttp({
    logger,
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
