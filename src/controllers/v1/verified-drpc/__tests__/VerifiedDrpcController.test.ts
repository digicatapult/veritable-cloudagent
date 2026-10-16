import { expect } from 'chai'
import { describe, it } from 'mocha'
import sinon from 'sinon'

import { UnprocessableEntityError } from '../../../../error.js'
import type { VerifiedDrpcRequest, VerifiedDrpcResponse } from '../../../../modules/verified-drpc/index.js'
import { VerifiedDrpcController } from '../VerifiedDrpcController.js'

describe('VerifiedDrpcController', () => {
  const connectionId = 'connection-id'

  it('rejects invalid request input with 422 before starting the protocol', async () => {
    const sendRequest = sinon.stub()
    const controller = new VerifiedDrpcController({ modules: { verifiedDrpc: { sendRequest } } } as never)

    try {
      await controller.sendRequest({} as never, connectionId, {
        drpcRequest: { jsonrpc: '2.0', method: 'hello' } as VerifiedDrpcRequest,
      })
      expect.fail('Expected invalid request input to be rejected')
    } catch (error) {
      expect(error).to.be.instanceOf(UnprocessableEntityError)
      expect(error).to.include({ code: 422, message: 'Validation Failed' })
      expect((error as UnprocessableEntityError).details).to.be.an('array')
    }
    sinon.assert.notCalled(sendRequest)
  })

  it('rejects invalid response input with 422 before sending a response', async () => {
    const sendResponse = sinon.stub()
    const controller = new VerifiedDrpcController({ modules: { verifiedDrpc: { sendResponse } } } as never)

    try {
      await controller.sendResponse({} as never, connectionId, 'thread-id', {
        jsonrpc: '2.0',
        id: 1,
      } as VerifiedDrpcResponse)
      expect.fail('Expected invalid response input to be rejected')
    } catch (error) {
      expect(error).to.be.instanceOf(UnprocessableEntityError)
      expect(error).to.include({ code: 422, message: 'Validation Failed' })
      expect((error as UnprocessableEntityError).details).to.be.an('array')
    }
    sinon.assert.notCalled(sendResponse)
  })
})
