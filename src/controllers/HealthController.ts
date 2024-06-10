import { Controller, Get, Hidden, Route, SuccessResponse } from 'tsoa'
import { injectable } from 'tsyringe'

const packageVersion = process.env.npm_package_version ? process.env.npm_package_version : 'unknown'

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
  public async get(): Promise<Health> {
    return {
      status: 'ok',
      version: packageVersion,
    }
  }
}
