import { expect } from 'chai'
import { describe, it } from 'mocha'
import * as sinon from 'sinon'

import {
  DidCommConnectionRecord,
  DidCommConnectionsApi,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommMessageHandlerRegistry,
  DidCommMessageSender,
} from '@credo-ts/didcomm'

import { withMockedAgentContext } from './fixtures/agentContext.js'
import { withMockVerifiedDrpcRecord } from './fixtures/mockVerifiedDrpcRecord.js'

import { VerifiedDrpcApi } from '../VerifiedDrpcApi.js'
import { VerifiedDrpcModuleConfig } from '../VerifiedDrpcModuleConfig.js'
import { VerifiedDrpcRequestMessage } from '../messages/index.js'
import { VerifiedDrpcState } from '../models/index.js'
import { VerifiedDrpcService } from '../services/index.js'

describe('VerifiedDrpcApi.sendRequest', () => {
  it('does not send a request when server proof verification fails', async () => {
    const agentContext = withMockedAgentContext()
    const config = new VerifiedDrpcModuleConfig({ proofRequestOptions: { protocolVersion: 'v2', proofFormats: {} } })
    const service = sinon.createStubInstance(VerifiedDrpcService)
    const sender = sinon.createStubInstance(DidCommMessageSender)
    const connections = sinon.createStubInstance(DidCommConnectionsApi)
    const connection = new DidCommConnectionRecord({
      id: 'connection-id',
      did: 'did:example:alice',
      theirDid: 'did:example:bob',
      threadId: 'connection-thread',
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.Completed,
      tags: {},
    })
    connections.getById.resolves(connection)
    const record = withMockVerifiedDrpcRecord({ connectionId: connection.id })
    service.createRequestMessage.resolves({
      requestMessage: new VerifiedDrpcRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } }),
      record,
    })
    service.verifyServer.callsFake(async () => {
      record.state = VerifiedDrpcState.Abandoned
    })
    const api = new VerifiedDrpcApi(
      config,
      sinon.createStubInstance(DidCommMessageHandlerRegistry),
      service,
      sender,
      connections,
      agentContext
    )

    try {
      await api.sendRequest(connection.id, { jsonrpc: '2.0', method: 'hello', id: 1 })
      expect.fail('Request must not be sent after a failed server proof')
    } catch (error) {
      expect(error).to.have.property('message').that.includes('invalid state')
    }

    sinon.assert.notCalled(sender.sendMessage)
  })
})
