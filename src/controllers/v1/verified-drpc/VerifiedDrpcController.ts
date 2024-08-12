import { Agent } from '@credo-ts/core'
import { Body, Controller, Path, Post, Query, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'
import type { VerifiedDrpcRequest, VerifiedDrpcResponse } from '../../../modules/verified-drpc/index.js'

import { RestAgent } from '../../../agent.js'
import { GatewayTimeout, NotFound } from '../../../error.js'
import { transformProofFormat } from '../../../utils/proofs.js'
import { type RecordId } from '../../examples.js'
import type { CreateProofRequestOptions } from '../../types.js'

interface VerifiedDrpcRequestOptions {
  drpcRequest: VerifiedDrpcRequest
  proofRequestOptions?: CreateProofRequestOptions
}

@Tags('Verified DRPC')
@Route('/v1/verified-drpc')
@injectable()
export class VerifiedDrpcController extends Controller {
  private agent: RestAgent

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
  @Post('/request/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendRequest(
    @Path('connectionId') connectionId: RecordId,
    @Body() requestOptions: VerifiedDrpcRequestOptions,
    @Query('async') async_ = false,
    @Query('timeout') timeout = 5000
  ) {
    let proofOptions: CreateProofRequestOptions | undefined
    if (requestOptions.proofRequestOptions) {
      const {
        proofRequestOptions: { proofFormats, ...rest },
      } = requestOptions
      proofOptions = {
        proofFormats: {
          anoncreds: transformProofFormat(proofFormats.anoncreds),
        },
        ...rest,
      }
    }

    const responseListener = await this.agent.modules.verifiedDrpc.sendRequest(
      connectionId,
      requestOptions.drpcRequest,
      proofOptions
    )
    const responsePromise = responseListener(timeout).then((response?: VerifiedDrpcResponse) => {
      if (response === undefined) {
        throw new GatewayTimeout('Response from peer timed out')
      }
      return response
    })
    let response: VerifiedDrpcResponse | undefined
    if (async_) {
      this.setStatus(202)
    } else {
      response = await responsePromise
    }
    return response
  }

  /**
   * Sends a verified drpc response to a connection
   * @param connectionId the connection id to use
   * @param threadId the thread id to respond to
   * @param response the verified drpc response object to send
   */
  @Post('/response/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<GatewayTimeout>(504)
  public async sendResponse(
    @Path('connectionId') connectionId: RecordId,
    @Query() threadId: string,
    @Body() response: VerifiedDrpcResponse
  ) {
    await this.agent.modules.verifiedDrpc.sendResponse({ connectionId, threadId, response })
  }
}
