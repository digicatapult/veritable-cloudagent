import { Logger } from '@credo-ts/core'
import { ValidateError } from '@tsoa/runtime'
import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import { isHttpError } from 'http-errors'

export class HttpResponse extends Error {
  public code: number
  public message: string
  public details?: unknown

  constructor({
    code = 500,
    message = 'Unexpected error',
    details,
  }: {
    code?: number
    message?: string
    details?: unknown
  }) {
    super(message)
    this.code = code
    this.message = message
    this.details = details
    this.name = 'Internal server error'
  }
}

export class NotFoundError extends HttpResponse {
  constructor(message = 'not found', details?: unknown) {
    super({ code: 404, message, details })
  }
}

export class BadRequest extends HttpResponse {
  constructor(message = 'bad request', details?: unknown) {
    super({ code: 400, message, details })
  }
}

export class UnprocessableEntityError extends HttpResponse {
  constructor(message = 'validation failed', details?: unknown) {
    super({ code: 422, message, details })
  }
}

export class GatewayTimeout extends HttpResponse {
  constructor(message = 'gateway timeout', details?: unknown) {
    super({ code: 504, message, details })
  }
}

export class BadGatewayError extends HttpResponse {
  constructor(message = 'bad gateway error', details?: unknown) {
    super({ code: 502, message, details })
  }
}

export class InternalError extends HttpResponse {
  constructor(message = 'internal error', details?: unknown) {
    super({ code: 500, message, details })
  }
}

type ErrorBody = {
  code: number
  message: string
  details?: unknown
}

const toErrorBody = (error: HttpResponse): ErrorBody => ({
  code: error.code,
  message: error.message,
  ...(error.details !== undefined ? { details: error.details } : {}),
})

const normalizeError = (err: unknown): HttpResponse => {
  if (err instanceof ValidateError) {
    return new UnprocessableEntityError('Validation Failed', err.fields)
  }

  if (err instanceof HttpResponse) {
    return err
  }

  if (isHttpError(err)) {
    return new HttpResponse({
      code: err.statusCode,
      message: err.message,
    })
  }

  if (err instanceof Error) {
    return new InternalError(err.message)
  }

  return new InternalError('Unknown error')
}

export const errorHandler =
  (logger: Logger) =>
  (err: unknown, req: ExRequest, res: ExResponse, _next: NextFunction): void => {
    const normalized = normalizeError(err)

    if (normalized.code >= 500) {
      logger.error(`Unexpected error thrown in handler: ${normalized.message}`)
      if (err instanceof Error) {
        logger.debug(`Stack: ${err.stack}`)
      }
    } else {
      logger.warn(`Error thrown in handler for ${req.method} ${req.path}: ${normalized.message}`)
      if (err instanceof ValidateError) {
        logger.warn(`Caught Validation Error for ${req.path}:`, err.fields)
      }
    }

    res.status(normalized.code).json(toErrorBody(normalized))
    return
  }
