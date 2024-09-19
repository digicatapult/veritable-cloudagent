import express from 'express'
import { Controller, Get, Hidden, Request, Route, SuccessResponse } from 'tsoa'
import { injectable } from 'tsyringe'
import { version } from '../../package.json'

const packageVersion = process.env.npm_package_version ? process.env.npm_package_version : version || 'unknown'

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
    req.log.info('health controller called, cloudagent version is %s', packageVersion)
    return {
      status: 'ok',
      version: packageVersion,
    }
  }
}
