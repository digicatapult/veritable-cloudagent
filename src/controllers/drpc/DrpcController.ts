import { Agent } from '@credo-ts/core'
import type { DrpcRequest, DrpcResponse } from '@credo-ts/drpc'
import { Body, Controller, Path, Query, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { type RecordId } from '../examples.js'
import { NotFound, GatewayTimeout } from '../../error.js'

@Tags('DRPC')
@Route('/drpc')
@injectable()
export class DrpcController extends Controller {
  private agent: Agent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * sends a request object to the connection
   *
   * @param connectionId the connection to send the request to
   * @param request The request object
   * @param timeout The timeout for receiving a response
   */
  @Post('/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendRequest(
    @Path('connectionId') connectionId: RecordId,
    @Body() request: DrpcRequest,
    @Query('async') async_ = false,
    @Query('timeout') timeout = 5000
  ) {
    const responseListener = await this.agent.modules.drpc.sendRequest(connectionId, request)
    const responsePromise = responseListener(timeout).then((response: DrpcResponse) => {
      if (response === undefined) {
        throw new GatewayTimeout('Response from peer timed out')
      }
      return response
    })
    let response: DrpcResponse | undefined
    if (async_) {
      this.setStatus(202)
    } else {
      response = await responsePromise
    }
    return response
  }

  /**
   * sends a response object to the connection
   *
   * @param connectionId the connection to send the request to
   * @param request The request object
   * @param timeout The timeout for receiving a response
   */
  @Post('/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendRequest(
    @Path('connectionId') connectionId: RecordId,
    @Body() request: DrpcRequest,
    @Query('async') async_ = false,
    @Query('timeout') timeout = 5000
  ) {
    const responseListener = await this.agent.modules.drpc.sendRequest(connectionId, request)
    const responsePromise = responseListener(timeout).then((response: DrpcResponse) => {
      if (response === undefined) {
        throw new GatewayTimeout('Response from peer timed out')
      }
      return response
    })
    let response: DrpcResponse | undefined
    if (async_) {
      this.setStatus(202)
    } else {
      response = await responsePromise
    }
    return response
  }
}
