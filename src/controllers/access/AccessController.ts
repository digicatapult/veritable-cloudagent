import { Controller, Route, Tags, Get } from 'tsoa'
import { injectable } from 'tsyringe'

import type { RestAgent } from '../../utils/agent'

@Tags('Access')
@Route('/access')
@injectable()
export class AccessController extends Controller {
  private agent: RestAgent

  public constructor(agent: RestAgent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve basic agent information
   */
  @Get('/policies')
  public async getPolicies() {
    return this.agent.modules
  }
}
