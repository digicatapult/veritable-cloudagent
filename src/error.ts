import { Logger } from '@credo-ts/core'
import { ValidateError } from '@tsoa/runtime'
import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { isHttpError } from 'http-errors'

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

export class NotFoundError extends HttpResponse {
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

export class BadGatewayError extends HttpResponse {
  constructor(message = 'bad gateway error') {
    super({ code: 502, message })
  }
}

export class InternalError extends HttpResponse {
  constructor(message = 'internal error') {
    super({ code: 500, message })
  }
}

export const errorHandler =
  (logger: Logger) =>
  (err: unknown, req: ExRequest, res: ExResponse, next: NextFunction): void => {
    if (err instanceof ValidateError) {
      logger.warn(`Caught Validation Error for ${req.path}:`, err.fields)
      res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      })
      return
    }

    if (err instanceof HttpResponse) {
      logger.warn(`Error thrown in handler for ${req.method} ${req.path}: ${err.message}`)
      res.status(err.code).json(err.message)
      return
    }
    // capture body parser errors
    if (isHttpError(err)) {
      logger.warn(`HTTPError in request for ${req.method} ${req.path}: ${err.message}`)
      res.status(err.statusCode).json(err.message)
      return
    }
    if (err instanceof Error) {
      logger.error(`Unexpected error thrown in handler: ${err.message}`)
      logger.debug(`Stack: ${err.stack}`)
      res.status(500).json(err.message)
      return
    }

    next(err)
  }
