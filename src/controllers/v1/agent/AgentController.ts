import { Agent } from '@credo-ts/core'
import { Controller, Get, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import type { AgentInfo } from '../../types.js'
import { RestAgent } from '../../../agent.js'
@Tags('Agent')
@Route('/v1/agent')
@injectable()
export class AgentController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve basic agent information
   */
  @Get('/')
  public async getAgentInfo(): Promise<AgentInfo> {
    return {
      label: this.agent.config.label,
      endpoints: this.agent.config.endpoints,
      isInitialized: this.agent.isInitialized,
    }
  }
}
