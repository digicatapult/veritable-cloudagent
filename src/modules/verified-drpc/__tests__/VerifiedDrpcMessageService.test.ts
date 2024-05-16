import type { VerifiedDrpcRequestObject } from '../messages'

import { DidExchangeState } from '@credo-ts/core'

import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { InboundMessageContext } from '../../../core/src/agent/models/InboundMessageContext'
import { getAgentContext, getMockConnection } from '../../../core/tests/helpers'
import { VerifiedDrpcRequestMessage } from '../messages'
import { VerifiedDrpcRole } from '../models/VerifiedDrpcRole'
import { VerifiedDrpcRecord } from '../repository/VerifiedDrpcRecord'
import { VerifiedDrpcRepository } from '../repository/VerifiedDrpcRepository'
import { VerifiedDrpcService } from '../services'

jest.mock('../repository/VerifiedDrpcRepository')
const VerifiedDrpcRepositoryMock = VerifiedDrpcRepository as jest.Mock<VerifiedDrpcRepository>
const verifiedDrpcMessageRepository = new VerifiedDrpcRepositoryMock()

jest.mock('../../../core/src/agent/EventEmitter')
const EventEmitterMock = EventEmitter as jest.Mock<EventEmitter>
const eventEmitter = new EventEmitterMock()

const agentContext = getAgentContext()

describe('VerifiedDrpcService', () => {
  let verifiedDrpcMessageService: VerifiedDrpcService
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
    state: DidExchangeState.Completed,
  })

  beforeEach(() => {
    verifiedDrpcMessageService = new VerifiedDrpcService(verifiedDrpcMessageRepository, eventEmitter)
  })

  describe('createMessage', () => {
    it(`creates message and record, and emits message and basic message record`, async () => {
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
