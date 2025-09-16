import { Request as ExRequest, Response as ExResponse } from 'express'

export const errorHandler = (err: unknown, req: ExRequest, res: ExResponse): void => {
  req.log.error(err, `${req.method} ${req.path}`)

  res.status(500).json({
    message: 'Internal Server Error',
    error: (err as Error)?.message || 'Unknown error',
  })
}
