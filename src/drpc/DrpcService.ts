import { type Agent } from '@credo-ts/core'
import type { DrpcRequest, DrpcRequestObject, DrpcResponseObject } from '@credo-ts/drpc'

export class DrpcService {
  /*
  // Can define method handlers in the service class
  private handlers: { [key: string]: (request: DrpcRequestObject) => Promise<DrpcResponseObject["result"]> } = {
    hello: async function () {
      return 'Hello world!'
    },
  }

  constructor(private agent: Agent) {
    this.startDrpcService()
    this.registerMethodHandler('goodbye', async function () {
      return 'Bai-bai'
    })
  }

  // Can also register method handlers after instantiation
  registerMethodHandler(
    method: string,
    handler: (request: DrpcRequest) => Promise<DrpcResponseObject["result"]>,
    override: boolean = false
  ) {
    if (this.handlers[method] && !override) {
      throw new Error(`handler already registered for method ${method}`)
    }
    this.handlers[method] = handler
  }
  */
 
  constructor(private agent: Agent) {
    this.startDrpcService()
  }

  private async startDrpcService(timeout = 5000) {
    for (;;) {
      const { request, sendResponse } = await this.agent.modules.drpc.recvRequest()
      console.dir({request})


      /*
      const drpcRequestObjects: DrpcRequestObject[] = [].concat(drpcRequest)
      for (const request of drpcRequestObjects) {
        if (!this.handlers[request.method]) {
          this.agent.config.logger.error(`no handler for DRPC method ${request.method} registered`)
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
