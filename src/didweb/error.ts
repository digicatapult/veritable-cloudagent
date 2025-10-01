import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'

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

export const errorHandler = (err: unknown, req: ExRequest, res: ExResponse, _next: NextFunction): void => {
  req.log.error(err, `${req.method} ${req.path}`)

  if (err instanceof HttpResponse) {
    res.status(err.code).json({
      message: err.message,
    })
  } else {
    res.status(500).json({
      message: 'Internal Server Error',
      error: (err as Error)?.message || 'Unknown error',
    })
  }
}
