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

import { BadGatewayError } from '../../../error.js'
import { VerifiedDrpcApi } from '../VerifiedDrpcApi.js'
import { VerifiedDrpcModuleConfig } from '../VerifiedDrpcModuleConfig.js'
import { VerifiedDrpcRequestMessage, VerifiedDrpcResponseMessage } from '../messages/index.js'
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
      expect(error).to.be.instanceOf(BadGatewayError)
      expect(error).to.include({ code: 502, message: 'Server proof verification failed' })
    }

    sinon.assert.notCalled(sender.sendMessage)
  })
})

describe('VerifiedDrpcApi.addRequestListener', () => {
  const internalError = { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: 1 } as const

  const setupListener = (handler: Parameters<VerifiedDrpcApi<never>['addRequestListener']>[0]) => {
    const context = setup()
    const record = withMockVerifiedDrpcRecord({
      connectionId: context.connection.id,
      role: VerifiedDrpcRole.Server,
      state: VerifiedDrpcState.ClientProofReceived,
    })
    record.request = { jsonrpc: '2.0', method: 'hello', id: 1 }
    context.service.findByThreadAndConnectionId.resolves(record)
    context.service.createResponseMessage.callsFake(async (_agentContext, response, verifiedDrpcRecord) => ({
      responseMessage: new VerifiedDrpcResponseMessage({ response, threadId: verifiedDrpcRecord.threadId }),
      record: verifiedDrpcRecord,
    }))
    context.api.addRequestListener(handler)
    const listener = context.service.createRequestListener.firstCall.args[0]
    const deliver = () => listener({ verifiedDrpcMessageRecord: record, removeListener: () => {} })
    return { ...context, record, deliver }
  }

  it('sends a JSON-RPC internal error when the handler throws', async () => {
    const { service, sender, deliver } = setupListener(() => {
      throw new Error('handler failed')
    })

    await deliver()

    sinon.assert.calledWithMatch(service.createResponseMessage, sinon.match.any, internalError)
    sinon.assert.calledOnce(sender.sendMessage)
    sinon.assert.notCalled(service.abandonUnansweredRequest)
  })

  it('sends a JSON-RPC internal error when the handler returns an invalid response', async () => {
    const { service, sender, deliver } = setupListener(() => ({ jsonrpc: '1.0', id: 1 }) as never)

    await deliver()

    sinon.assert.calledWithMatch(service.createResponseMessage, sinon.match.any, internalError)
    sinon.assert.calledOnce(sender.sendMessage)
  })

  it('abandons the request when no response can be sent', async () => {
    const { service, sender, record, deliver } = setupListener(() => ({ jsonrpc: '2.0', result: 'ok', id: 1 }))
    sender.sendMessage.rejects(new Error('transport failed'))

    await deliver()

    sinon.assert.calledOnceWithExactly(
      service.abandonUnansweredRequest,
      sinon.match.any,
      record.connectionId,
      record.threadId
    )
  })
})
