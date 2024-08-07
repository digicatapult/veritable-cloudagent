import { Agent, utils } from '@credo-ts/core'
import { Body, Controller, Path, Query, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'
import type { DrpcRequestObject, DrpcResponseObject } from '@credo-ts/drpc'

import { type RecordId } from '../../examples.js'
import { NotFound, GatewayTimeout, BadGatewayError, InternalError } from '../../../error.js'
import { RestAgent } from '../../../utils/agent.js'
import DrpcReceiveHandler from '../../../drpc-handler/index.js'
import { z } from 'zod'

type DrpcRequestOptions = Omit<DrpcRequestObject, 'id'>
type DrpcResponseOptions = Omit<DrpcResponseObject, 'id'>

const rpcResponseParser = z.object({
  jsonrpc: z.string(),
  result: z.any().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.any().optional(),
    })
    .optional(),
  id: z.string(),
})

@Tags('Didcomm RPC')
@Route('/v1/drpc')
@injectable()
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
  @Response<NotFound>(404)
  @Response<BadGatewayError>(502)
  @Response<GatewayTimeout>(504)
  public async sendRequest(
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
      this.setStatus(204)
      return
    }

    let validatedResponse: DrpcResponseObject
    try {
      validatedResponse = rpcResponseParser.parse(response)
    } catch (err) {
      throw new BadGatewayError('Invalid response to RPC call')
    }

    return validatedResponse
  }

  /**
   * Sends a response to a drpc request
   * @param requestId the connection id to use
   * @param response the verified drpc response object to send
   */
  @Post('/:requestId/response')
  @Response<NotFound['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendResponse(@Path('requestId') requestId: string, @Body() response: DrpcResponseOptions) {
    try {
      await this.receiveHandler.respondToRequest(requestId, response)
    } catch (err) {
      if (err instanceof NotFound) {
        throw new NotFound(`Request ${requestId} not found`)
      }
      throw new InternalError()
    }

    this.setStatus(204)
  }
}
