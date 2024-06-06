import { Agent } from '@credo-ts/core'
import { Controller, Get, Route, SuccessResponse, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

const packageVersion = process.env.npm_package_version ? process.env.npm_package_version : 'unknown'

@Route('api/health')
@Tags('health')
@injectable()
export class HealthController extends Controller {
  private agent: Agent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * @summary Check health of API and its dependencies
   */
  @SuccessResponse(200)
  @Get('/')
  public async get() {
    return {
      status: 'ok',
      version: packageVersion,
    }
  }
}
