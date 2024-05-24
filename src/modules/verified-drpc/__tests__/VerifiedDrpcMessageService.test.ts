import { describe, it } from 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'
import type { SinonStubbedInstance, SinonStub } from 'sinon'

import type { VerifiedDrpcRequestObject } from '../messages/index.js'

import { ProofState, ProofStateChangedEvent, ProofEventTypes, DidExchangeState, DidExchangeRole, EventEmitter, InboundMessageContext, ConnectionRecord, ConnectionRecordProps, ProofsApi } from '@credo-ts/core'
import type { DependencyManager, V2ProofProtocol } from '@credo-ts/core'
import type { AnonCredsProofFormatService } from '@credo-ts/anoncreds'

import { withMockedAgentContext } from './fixtures/agentContext.js'
import { withMockProofExchangeRecord } from './fixtures/mockProofExchangeRecord.js'

import { VerifiedDrpcRequestMessage } from '../messages/index.js'
import { VerifiedDrpcRole } from '../models/VerifiedDrpcRole.js'
import { VerifiedDrpcRecord } from '../repository/VerifiedDrpcRecord.js'
import { VerifiedDrpcRepository } from '../repository/VerifiedDrpcRepository.js'
import { VerifiedDrpcService } from '../services/index.js'
import { VerifiedDrpcModuleConfig } from '../VerifiedDrpcModuleConfig.js'


const mockVerifiedDrpcRepository: SinonStubbedInstance<VerifiedDrpcRepository> = sinon.createStubInstance(VerifiedDrpcRepository)
const mockEventEmitter: SinonStubbedInstance<EventEmitter> = sinon.createStubInstance(EventEmitter)
const mockVerifiedDrpcModuleConfig = new VerifiedDrpcModuleConfig({ proofRequestOptions: { protocolVersion: '2.0', proofFormats: {} } })

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
    verifiedDrpcMessageService = new VerifiedDrpcService(mockVerifiedDrpcModuleConfig, mockVerifiedDrpcRepository, mockEventEmitter)
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

      expect(requestMessage).to.be.an.instanceof(VerifiedDrpcRequestMessage)
      expect((requestMessage.request as VerifiedDrpcRequestObject).method).to.equal('hello')

      sinon.assert.calledWith(mockVerifiedDrpcRepository.save, agentContext, sinon.match.instanceOf(VerifiedDrpcRecord))
      sinon.assert.calledWithMatch<any>(mockEventEmitter.emit, agentContext, {
        type: 'VerifiedDrpcRequestStateChanged',
        payload: {
          verifiedDrpcMessageRecord: sinon.match({
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
      const testProofId = 'test-proof-id'
      const testProofRecord = withMockProofExchangeRecord({
        id: testProofId,
        state: ProofState.Done,
      })
      const mockProofsApi: SinonStubbedInstance<ProofsApi<[V2ProofProtocol<[AnonCredsProofFormatService]>]>> = sinon.createStubInstance(ProofsApi)
      mockProofsApi.requestProof.resolves(testProofRecord)
      agentContext.dependencyManager.resolve = sinon.stub()
        .withArgs(ProofsApi)
        .returns(mockProofsApi)
      const proofEvent = {
        type: ProofEventTypes.ProofStateChanged,
        payload: {
          proofRecord: testProofRecord,
          previousState: null,
        }
      }
      mockEventEmitter.on
        .withArgs(ProofEventTypes.ProofStateChanged, sinon.match.func)
        .callsArgWith(1, proofEvent)
      const verifiedDrpcMessage = new VerifiedDrpcRequestMessage({ request: { jsonrpc: '2.0', method: 'hello', id: 1 } })
      const messageContext = new InboundMessageContext(verifiedDrpcMessage, { agentContext, connection: mockConnectionRecord })
      
      const requestPromise = verifiedDrpcMessageService.receiveRequest(messageContext)

      sinon.assert.calledWith(mockVerifiedDrpcRepository.save, agentContext, sinon.match.instanceOf(VerifiedDrpcRecord))
      sinon.assert.calledWithMatch<any>(mockEventEmitter.emit, agentContext, {
        type: 'VerifiedDrpcRequestStateChanged',
        payload: {
          verifiedDrpcMessageRecord: {
            connectionId: mockConnectionRecord.id,
            request: {
              id: 1,
              jsonrpc: '2.0',
              method: 'hello',
            },
            role: VerifiedDrpcRole.Client,
          },
        },
      })
    })
  })
})
