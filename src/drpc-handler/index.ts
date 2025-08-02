import { Agent } from '@credo-ts/core'
import { injectable, singleton } from 'tsyringe'

import type { VerifiedDrpcRecord, VerifiedDrpcResponse } from '../modules/verified-drpc/index.js'

import { DrpcRequestObject, DrpcResponse, DrpcResponseObject } from '@credo-ts/drpc'
import { RestAgent } from '../agent.js'
import type { UUID } from '../controllers/types.js'
import { NotFoundError } from '../error.js'
import PinoLogger from '../utils/logger.js'

export const verifiedDrpcRequestHandler = async (request: VerifiedDrpcRecord): Promise<VerifiedDrpcResponse> => {
  return { jsonrpc: '2.0', result: { a: 123, b: 456 }, id: request.id }
}

type ReceivedRequest = {
  request: DrpcRequestObject
  sendResponse: (response: DrpcResponse) => Promise<void>
}

@injectable()
@singleton()
export default class DrpcReceiveHandler {
  private agent: RestAgent
  private requests = new Map<string | number, ReceivedRequest>()
  private stopped = true
  private join: Promise<void> | null = null

  constructor(
    agent: Agent,
    private logger: PinoLogger
  ) {
    this.agent = agent
  }

  public start() {
    if (!this.stopped) {
      return
    }
    this.stopped = false
    this.join = this.loop()
  }

  public async stop() {
    if (this.stopped) {
      return
    }
    this.stopped = true
    const join = this.join
    this.join = null
    await join
  }

  public async respondToRequest(id: UUID | number, response: Omit<DrpcResponseObject, 'id'>): Promise<void> {
    const request = this.requests.get(id)
    if (!request) {
      throw new NotFoundError(`request not found`)
    }
    this.requests.delete(id)
    await request.sendResponse({
      ...response,
      id,
    })
  }

  private async loop() {
    while (!this.stopped) {
      const maybeRequest = await this.agent.modules.drpc.recvRequest()
      if (!maybeRequest) {
        continue
      }
      const { request, sendResponse } = maybeRequest

      if (request instanceof Array) {
        this.logger.warn('Array Drpc requests are currently unsupported')
        continue
      }

      if (request.id === null) {
        this.logger.warn('Drpc requests without an id are currently unsupported')
        continue
      }

      this.requests.set(request.id, { request, sendResponse })
    }
  }
}
