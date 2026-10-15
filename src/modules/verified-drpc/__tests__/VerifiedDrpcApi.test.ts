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
import { VerifiedDrpcRole, VerifiedDrpcState } from '../models/index.js'
import { VerifiedDrpcService } from '../services/index.js'

const setup = () => {
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
  const api = new VerifiedDrpcApi(
    config,
    sinon.createStubInstance(DidCommMessageHandlerRegistry),
    service,
    sender,
    connections,
    agentContext
  )
  return { agentContext, service, sender, connection, api }
}

describe('VerifiedDrpcApi.sendRequest', () => {
  it('does not send a request when server proof verification fails', async () => {
    const { service, sender, connection, api } = setup()
    const record = withMockVerifiedDrpcRecord({ connectionId: connection.id })
    service.createRequestMessage.resolves({
      requestMessage: new VerifiedDrpcRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } }),
      record,
    })
    service.verifyServer.callsFake(async () => {
      record.state = VerifiedDrpcState.Abandoned
    })

    try {
      await api.sendRequest(connection.id, { jsonrpc: '2.0', method: 'hello', id: 1 })
      expect.fail('Request must not be sent after a failed server proof')
    } catch (error) {
      expect(error).to.have.property('message').that.includes('invalid state')
    }

    sinon.assert.notCalled(sender.sendMessage)
  })
})

describe('VerifiedDrpcApi.addRequestListener', () => {
  it('logs and does not reject when the handler returns an invalid response', async () => {
    const { agentContext, service, sender, connection, api } = setup()
    const record = withMockVerifiedDrpcRecord({
      connectionId: connection.id,
      role: VerifiedDrpcRole.Server,
      state: VerifiedDrpcState.ClientProofReceived,
    })
    record.request = { jsonrpc: '2.0', method: 'hello', id: 1 }
    service.findByThreadAndConnectionId.resolves(record)
    service.createResponseMessage.callThrough()
    api.addRequestListener(() => ({ jsonrpc: '1.0', id: 1 }) as never)
    const listener = service.createRequestListener.firstCall.args[0]

    await listener({ verifiedDrpcMessageRecord: record, removeListener: () => {} })

    sinon.assert.notCalled(sender.sendMessage)
    sinon.assert.calledWithMatch(
      agentContext.config.logger.error as sinon.SinonStub,
      sinon.match(`Error responding to verified DRPC request ${record.threadId}`)
    )
  })
})
