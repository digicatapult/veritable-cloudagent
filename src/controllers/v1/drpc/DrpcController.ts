import { Agent, utils } from '@credo-ts/core'
import type { DrpcResponseObject } from '@credo-ts/drpc'
import express from 'express'
import { Body, Controller, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable, singleton } from 'tsyringe'
import { z } from 'zod'

import { BadGatewayError, GatewayTimeout, NotFoundError } from '../../../error.js'
import { type RecordId } from '../../examples.js'

import { RestAgent } from '../../../agent.js'
import DrpcReceiveHandler from '../../../drpc-handler/index.js'

type DrpcRequestOptions = {
  jsonrpc: string
  method: string
  params?: Record<string, unknown> | unknown[]
}
type DrpcResponseOptions = Omit<DrpcResponseObject, 'id'>

const rpcResponseParser = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.any().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.any().optional(),
    })
    .optional(),
  id: z.uuid(),
})

@Tags('Didcomm RPC')
@Route('/v1/drpc')
@injectable()
@singleton()
export class DrpcController extends Controller {
  private agent: RestAgent

  public constructor(
    agent: Agent,
    private receiveHandler: DrpcReceiveHandler
  ) {
    super()
    this.agent = agent
  }

  /**
   * sends a request object to the connection
   *
   * @param connectionId the connection to send the request to
   * @param requestOptions The request object
   * @param timeout The timeout for receiving a response
   */
  @Post('/:connectionId/request')
  @Response<NotFoundError>(404)
  @Response<BadGatewayError>(502)
  @Response<GatewayTimeout>(504)
  public async sendRequest(
    @Request() req: express.Request,
    @Path('connectionId') connectionId: RecordId,
    @Body() requestOptions: DrpcRequestOptions,
    @Query('timeout') timeout = 5000
  ): Promise<DrpcResponseObject | undefined> {
    const responseListener = await this.agent.modules.drpc.sendRequest(connectionId, {
      id: utils.uuid(),
      ...requestOptions,
    })

    const response = await Promise.race([
      responseListener(),
      new Promise<never>((_, reject) =>
        setTimeout(reject, timeout, new GatewayTimeout('Response from peer timed out'))
      ),
    ])

    if (response === undefined) {
      req.log.warn('received %s from DRPC response listener', response)
      this.setStatus(204)
      return
    }

    let validatedResponse: DrpcResponseObject
    try {
      req.log.info('validating DRPC response %j', response)
      validatedResponse = rpcResponseParser.parse(response)
    } catch {
      throw new BadGatewayError(`invalid response to RPC call`)
    }

    req.log.debug('returning validated response %j', validatedResponse)
    return validatedResponse
  }

  /**
   * Sends a response to a drpc request
   * @param requestId the request id to respond to
   * @param response the verified drpc response object to send
   */
  @Post('/:requestId/response')
  @Response<NotFoundError['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendResponse(
    @Request() req: express.Request,
    @Path('requestId') requestId: string,
    @Body() response: DrpcResponseOptions
  ) {
    req.log.info('responding %j to request %s', response, requestId)
    await this.receiveHandler.respondToRequest(requestId, response)

    this.setStatus(204)
  }
}
