import { Response as ExResponse, Request as ExRequest, NextFunction } from 'express'
import { ValidateError } from 'tsoa'

import { logger } from '../logger'
export interface ValidateErrorJSON {
  message: 'Validation failed'
  details: { [name: string]: unknown }
}

export const errorHandler = function errorHandler(
  err: unknown,
  req: ExRequest,
  res: ExResponse,
  next: NextFunction
): ExResponse | void {
  if (err instanceof ValidateError) {
    logger.debug(`Handled Validation Error for ${req.path}:`, err.fields)
    const response: ValidateErrorJSON = {
      message: 'Validation failed',
      details: err?.fields,
    }
    return res.status(422).json(response)
  }
  if (err instanceof Error) {
    logger.warn('Unexpected error thrown in handler: %s', err.message)
    return res.status(500).json({
      message: 'Internal Server Error',
    })
  }

  next()
}
