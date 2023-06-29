import { Controller, Get, Route, Request } from 'tsoa'
import { Logger } from 'pino'

import * as Ex from 'express'
import type { Health } from '../../models'
import { logger } from '../../lib/logger'
@Route('health')
export class health extends Controller {
  constructor() {
    super()
  }

  @Get('/')
  public async get(@Request() req: Ex.Request & { log: Logger; req_id: string }): Promise<Health> {
    logger.debug({ msg: 'new request received', controller: '/health' })

    return Promise.resolve({
      status: 200,
      message: 'success',
      req_id: req.req_id,
    })
  }
}
