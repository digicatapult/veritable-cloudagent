import type { VerifiedDrpcRequest, VerifiedDrpcRequestObject, VerifiedDrpcResponseObject } from '../modules/verified-drpc/index.js'

import { type Agent } from '@credo-ts/core'

import { transformProofFormat } from '../utils/proofs.js'

export class VerifiedDrpcService {
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
    this.startVerifiedDrpcService()
  }

  private async startVerifiedDrpcService(timeout = 5000) {

    const proofOptionsObject = {
      "protocolVersion": "v2",
      "proofFormats": {
        "anoncreds": {
          "name": "proof-request",
          "version": "1.0",

          "requested_attributes": {
            "name": {
              "name": "niceRole",
              "restrictions": [
                {
                  "cred_def_id": "ipfs://bafkreifrnrqbr4ofsuoenr2xzsyc5qhwectsq7lovhohw47rhgxhkig4de"
                }
              ]
            }
          }
        }
      },
      "willConfirm": true,
      "autoAcceptProof": "always"
    }

    const { proofFormats, ...rest } = proofOptionsObject

    const proofOptions = {
      proofFormats: {
        anoncreds: transformProofFormat(proofFormats.anoncreds),
      },
      ...rest
    }

    for (;;) {
      const { request, sendResponse } = await this.agent.modules.verifiedDrpc.recvRequest(proofOptions)
      const result = { jsonrpc: '2.0', result: 'Hello world!', id: request.id }
      await sendResponse(result)


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
