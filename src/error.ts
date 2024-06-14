import { Response as ExResponse, Request as ExRequest, NextFunction } from 'express'
import { ValidateError } from 'tsoa'
import { isHttpError } from 'http-errors'
import { Logger } from '@credo-ts/core'

export class HttpResponse extends Error {
  public code: number
  public message: string

  constructor({ code = 500, message = 'Unexpected error' }) {
    super(message)
    this.code = code
    this.message = message
    this.name = 'Internal server error'
  }
}

export class NotFound extends HttpResponse {
  constructor(message = 'not found') {
    super({ code: 404, message })
  }
}

export class BadRequest extends HttpResponse {
  constructor(message = 'bad request') {
    super({ code: 400, message })
  }
}

export class GatewayTimeout extends HttpResponse {
  constructor(message = 'gateway timeout') {
    super({ code: 504, message })
  }
}

export const errorHandler =
  (logger: Logger) =>
  (err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): ExResponse | void => {
    if (err instanceof ValidateError) {
      logger.warn(`Caught Validation Error for ${req.path}:`, err.fields)
      return res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      })
    }

    if (err instanceof HttpResponse) {
      logger.warn(`Error thrown in handler: ${err.message}`)

      return res.status(err.code).json(err.message)
    }
    // capture body parser errors
    if (isHttpError(err)) {
      logger.warn(`HTTPError in request: ${err.message}`)
      return res.status(err.statusCode).json(err.message)
    }
    if (err instanceof Error) {
      logger.error(`Unexpected error thrown in handler: ${err.message}`)
      logger.trace(`Stack: ${err.stack}`)

      return res.status(500).json(err)
    }

    next(err)
  }
