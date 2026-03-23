import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'

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
  if (err instanceof HttpResponse) {
    return err
  }

  if (err instanceof Error) {
    return new InternalError(err.message)
  }

  return new InternalError('Unknown error')
}

export const errorHandler = (err: unknown, req: ExRequest, res: ExResponse, _next: NextFunction): void => {
  const normalized = normalizeError(err)

  if (normalized.code >= 500) {
    req.log.error(err instanceof Error ? err : normalized, `${req.method} ${req.path}`)
  } else {
    req.log.warn(normalized, `${req.method} ${req.path}`)
  }
  res.status(normalized.code).json(toErrorBody(normalized))
}
