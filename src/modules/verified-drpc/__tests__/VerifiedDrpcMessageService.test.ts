import type { VerifiedDrpcRequestObject } from '../messages/index.js'

import { DidExchangeState, EventEmitter, InboundMessageContext,  } from '@credo-ts/core'

import { withMockedAgentContext } from './fixtures/agentContext.js'

import { VerifiedDrpcRequestMessage } from '../messages/index.js'
import { VerifiedDrpcRole } from '../models/VerifiedDrpcRole.js'
import { VerifiedDrpcRecord } from '../repository/VerifiedDrpcRecord.js'
import { VerifiedDrpcRepository } from '../repository/VerifiedDrpcRepository.js'
import { VerifiedDrpcService } from '../services/index.js'

jest.mock('../repository/VerifiedDrpcRepository')
const VerifiedDrpcRepositoryMock = VerifiedDrpcRepository as jest.Mock<VerifiedDrpcRepository>
const verifiedDrpcMessageRepository = new VerifiedDrpcRepositoryMock()

jest.mock('../../../core/src/agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = withMockedAgentContext()

export function getMockConnection({
  state = DidExchangeState.InvitationReceived,
  role = DidExchangeRole.Requester,
  id = 'test',
  did = 'test-did',
  threadId = 'threadId',
  tags = {},
  theirLabel,
  theirDid = 'their-did',
}: Partial<ConnectionRecordProps> = {}) {
  return new ConnectionRecord({
    did,
    threadId,
    theirDid,
    id,
    role,
    state,
    tags,
    theirLabel,
  })
}

describe('VerifiedDrpcService', () => {
  let verifiedDrpcMessageService: VerifiedDrpcService
  const mockConnectionRecord = new ConnectionRecord({
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
    threadId: 'threadId',
    theirDid: 'their-did',
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    role: DidExchangeRole.Requester,
    state: DidExchangeState.Completed,
    tags: {},
  })

  beforeEach(() => {
    verifiedDrpcMessageService = new VerifiedDrpcService(verifiedDrpcMessageRepository, eventEmitter)
  })

  describe('createMessage', () => {
    it.only(`creates message and record, and emits message and basic message record`, async () => {
      const messageRequest: VerifiedDrpcRequestObject = {
        jsonrpc: '2.0',
        method: 'hello',
        id: 1,
      }
      const { requestMessage } = await verifiedDrpcMessageService.createRequestMessage(
        agentContext,
        messageRequest,
        mockConnectionRecord.id
      )

      expect(requestMessage).toBeInstanceOf(VerifiedDrpcRequestMessage)
      expect((requestMessage.request as VerifiedDrpcRequestObject).method).toBe('hello')

      expect(verifiedDrpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(VerifiedDrpcRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'VerifiedDrpcRequestStateChanged',
        payload: {
          verifiedDrpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            request: {
              id: 1,
              jsonrpc: '2.0',
              method: 'hello',
            },
            role: VerifiedDrpcRole.Client,
          }),
        },
      })
    })
  })

  describe('recieve request', () => {
    it(`stores record and emits message and basic message record`, async () => {
      const verifiedDrpcMessage = new VerifiedDrpcRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } })

      const messageContext = new InboundMessageContext(verifiedDrpcMessage, { agentContext, connection: mockConnectionRecord })

      await verifiedDrpcMessageService.receiveRequest(messageContext)

      expect(verifiedDrpcMessageRepository.save).toHaveBeenCalledWith(agentContext, expect.any(VerifiedDrpcRecord))
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: 'VerifiedDrpcRequestStateChanged',
        payload: {
          verifiedDrpcMessageRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            request: {
              id: 1,
              jsonrpc: '2.0',
              method: 'hello',
            },
            role: VerifiedDrpcRole.Server,
          }),
        },
      })
    })
  })
})
