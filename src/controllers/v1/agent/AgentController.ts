import { Agent } from '@credo-ts/core'
import { Controller, Get, Request, Route, Tags } from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import type { AgentInfo } from '../../types/index.js'
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
  public async getAgentInfo(@Request() req: express.Request): Promise<AgentInfo> {
    const info = {
      label: this.agent.config.label,
      endpoints: this.agent.config.endpoints,
      isInitialized: this.agent.isInitialized,
    }
    req.log.info('getting agent config %j', { info })

    return info
  }
}
