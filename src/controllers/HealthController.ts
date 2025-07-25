import express from 'express'
import { Controller, Get, Hidden, Request, Route, SuccessResponse } from 'tsoa'
import { injectable } from 'tsyringe'
import version from '../utils/version.js'

type Health = {
  version: string
  status: 'ok'
}

@Route('health')
@injectable()
export class HealthController extends Controller {
  public constructor() {
    super()
  }

  /**
   * @summary Check health of API and its dependencies
   */
  @SuccessResponse(200)
  @Hidden()
  @Get('/')
  public async get(@Request() req: express.Request): Promise<Health> {
    req.log.trace('health controller called, cloudagent version is %s', version)
    return {
      status: 'ok',
      version: version,
    }
  }
}
