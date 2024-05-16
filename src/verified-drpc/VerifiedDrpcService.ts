import { type Agent } from '@credo-ts/core'
import type { VerifiedDrpcRequest, VerifiedDrpcRequestObject, VerifiedDrpcResponseObject } from '../modules/verified-drpc'

export class VerifiedDrpcService {
  /*
  // Can define method handlers in the service class
  private handlers: { [key: string]: (request: VerifiedDrpcRequestObject) => Promise<VerifiedDrpcResponseObject["result"]> } = {
    hello: async function () {
      return 'Hello world!'
    },
  }

  constructor(private agent: Agent) {
    this.startVerifiedDrpcService()
    this.registerMethodHandler('goodbye', async function () {
      return 'Bai-bai'
    })
  }

  // Can also register method handlers after instantiation
  registerMethodHandler(
    method: string,
    handler: (request: VerifiedDrpcRequest) => Promise<VerifiedDrpcResponseObject["result"]>,
    override: boolean = false
  ) {
    if (this.handlers[method] && !override) {
      throw new Error(`handler already registered for method ${method}`)
    }
    this.handlers[method] = handler
  }
  */
 
  constructor(private agent: Agent) {
    this.startVerifiedDrpcService()
  }

  private async startVerifiedDrpcService(timeout = 5000) {
    for (;;) {
      const { request, sendResponse } = await this.agent.modules.verifiedDrpc.recvRequest()
      console.dir({request})


      /*
      const verifiedDrpcRequestObjects: VerifiedDrpcRequestObject[] = [].concat(verifiedDrpcRequest)
      for (const request of verifiedDrpcRequestObjects) {
        if (!this.handlers[request.method]) {
          this.agent.config.logger.error(`no handler for Verified DRPC method ${request.method} registered`)
        }
        ;((sendResponse) => {
          this.handlers[request.method](request).then((result) => {
            sendResponse({
              jsonrpc: '2.0',
              result,
              id: request.id,
            })
          })
        })(sendResponse)
      }
      */
    }
  }
}
