import type { VerifiedDrpcRequestStateChangedEvent } from '../VerifiedDrpcRequestEvents'
import type { VerifiedDrpcResponseStateChangedEvent } from '../VerifiedDrpcResponseEvents'
import type { VerifiedDrpcRequest, VerifiedDrpcResponse } from '../messages'
import type { VerifiedDrpcModuleConfig } from '../VerifiedDrpcModuleConfig.js'
import type { ProofProtocols } from '../types.js'

import type {
  AgentContext,
  InboundMessageContext,
  Query,
  ProofStateChangedEvent,
  CreateProofRequestOptions
} from '@credo-ts/core'

import { EventEmitter, injectable, ProofsApi, ProofEventTypes } from '@credo-ts/core'

import { VerifiedDrpcRequestEventTypes } from '../VerifiedDrpcRequestEvents.js'
import { VerifiedDrpcResponseEventTypes } from '../VerifiedDrpcResponseEvents.js'
import { VerifiedDrpcRequestMessage, VerifiedDrpcResponseMessage } from '../messages/index.js'
import { VerifiedDrpcRole, VerifiedDrpcState, isValidVerifiedDrpcRequest, isValidVerifiedDrpcResponse } from '../models/index.js'
import { VerifiedDrpcRecord, VerifiedDrpcRepository } from '../repository/index.js'

@injectable()
export class VerifiedDrpcService {
  private verifiedDrpcMessageRepository: VerifiedDrpcRepository
  private eventEmitter: EventEmitter
  private config: VerifiedDrpcModuleConfig

  public constructor(
    verifiedDrpcModuleConfig: VerifiedDrpcModuleConfig,
    verifiedDrpcMessageRepository: VerifiedDrpcRepository,
    eventEmitter: EventEmitter
  ) {
    this.config = verifiedDrpcModuleConfig
    this.verifiedDrpcMessageRepository = verifiedDrpcMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createRequestMessage(agentContext: AgentContext, request: VerifiedDrpcRequest, connectionId: string) {
    const verifiedDrpcMessage = new VerifiedDrpcRequestMessage({ request })

    const verifiedDrpcMessageRecord = new VerifiedDrpcRecord({
      request,
      connectionId,
      state: VerifiedDrpcState.ServerProofRequestSent,
      threadId: verifiedDrpcMessage.threadId,
      role: VerifiedDrpcRole.Client,
    })

    await this.verifiedDrpcMessageRepository.save(agentContext, verifiedDrpcMessageRecord)
    this.emitStateChangedEvent(agentContext, verifiedDrpcMessageRecord)

    return { requestMessage: verifiedDrpcMessage, record: verifiedDrpcMessageRecord }
  }

  private async verifyConnection(agentContext: AgentContext, connectionId: string, proofOptions: CreateProofRequestOptions<ProofProtocols>, timeoutMs: number) {
    const proofsApi = agentContext.dependencyManager.resolve(ProofsApi) as ProofsApi<ProofProtocols>
    const { id: proofRecordId } = await proofsApi.requestProof({ ...proofOptions, connectionId })
    await new Promise<void>((resolve, reject) => {
      const proofTimeout = setTimeout(() => {
        this.eventEmitter.off(ProofEventTypes.ProofStateChanged, onProofStateChanged)
        reject('Proof verification timed out')
      }, timeoutMs)
      const onProofStateChanged = async ({ payload: { proofRecord } }: ProofStateChangedEvent) => {
        if (proofRecord.id === proofRecordId && proofRecord.state === 'done') {
          clearTimeout(proofTimeout)
          this.eventEmitter.off(ProofEventTypes.ProofStateChanged, onProofStateChanged)
          resolve()
        }
      }
      this.eventEmitter.on(ProofEventTypes.ProofStateChanged, onProofStateChanged)
    })
  }

  public async verifyServer(agentContext: AgentContext, connectionId: string, proofOptions: CreateProofRequestOptions<ProofProtocols>, verifiedDrpcRecord: VerifiedDrpcRecord, timeoutMs: number = 5000) {
    try {
      await this.verifyConnection(agentContext, connectionId, proofOptions, timeoutMs)
      verifiedDrpcRecord.isVerified = true
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.RequestSent)
    } catch (e) {
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Abandoned)
      throw e
    }
  }

  public async verifyClient(agentContext: AgentContext, connectionId: string, proofOptions: CreateProofRequestOptions<ProofProtocol>, verifiedDrpcRecord: VerifiedDrpcRecord, timeoutMs: number = 5000) {
    try {
      await this.verifyConnection(agentContext, connectionId, proofOptions, timeoutMs)
      verifiedDrpcRecord.isVerified = true
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.ClientProofReceived)
    } catch (e) {
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Abandoned)
      throw e
    }
  }

  public async createResponseMessage(agentContext: AgentContext, response: VerifiedDrpcResponse, verifiedDrpcRecord: VerifiedDrpcRecord) {
    const verifiedDrpcMessage = new VerifiedDrpcResponseMessage({ response, threadId: verifiedDrpcRecord.threadId })

    verifiedDrpcRecord.assertState(VerifiedDrpcState.ClientProofReceived)

    verifiedDrpcRecord.response = response
    verifiedDrpcRecord.request = undefined

    await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Completed)

    return { responseMessage: verifiedDrpcMessage, record: verifiedDrpcRecord }
  }

  public createRequestListener(
    callback: (params: { verifiedDrpcMessageRecord: VerifiedDrpcRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: VerifiedDrpcRequestStateChangedEvent) => {
      const { verifiedDrpcMessageRecord } = event.payload
      await callback({
        verifiedDrpcMessageRecord,
        removeListener: () => this.eventEmitter.off(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener),
      })
    }
    this.eventEmitter.on(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener)

    return () => {
      this.eventEmitter.off(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener)
    }
  }

  public createResponseListener(
    callback: (params: { verifiedDrpcMessageRecord: VerifiedDrpcRecord; removeListener: () => void }) => void | Promise<void>
  ) {
    const listener = async (event: VerifiedDrpcResponseStateChangedEvent) => {
      const { verifiedDrpcMessageRecord } = event.payload
      await callback({
        verifiedDrpcMessageRecord,
        removeListener: () => this.eventEmitter.off(VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged, listener),
      })
    }
    this.eventEmitter.on(VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged, listener)
    return () => {
      this.eventEmitter.off(VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged, listener)
    }
  }

  public async receiveResponse(messageContext: InboundMessageContext<VerifiedDrpcResponseMessage>) {
    const connection = messageContext.assertReadyConnection()
    const verifiedDrpcMessageRecord = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      connection.id,
      messageContext.message.threadId
    )

    if (!verifiedDrpcMessageRecord) {
      throw new Error('Verified DRPC message record not found')
    }

    verifiedDrpcMessageRecord.assertRole(VerifiedDrpcRole.Client)
    verifiedDrpcMessageRecord.assertState(VerifiedDrpcState.RequestSent)
    verifiedDrpcMessageRecord.response = messageContext.message.response
    verifiedDrpcMessageRecord.request = undefined

    await this.updateState(messageContext.agentContext, verifiedDrpcMessageRecord, VerifiedDrpcState.Completed)
    return verifiedDrpcMessageRecord
  }

  public async receiveRequest(messageContext: InboundMessageContext<VerifiedDrpcRequestMessage>) {
    const connection = messageContext.assertReadyConnection()
    const record = await this.findByThreadAndConnectionId(
      messageContext.agentContext,
      connection.id,
      messageContext.message.threadId
    )

    if (record) {
      throw new Error('Verified DRPC message record already exists')
    }

    const verifiedDrpcMessageRecord = new VerifiedDrpcRecord({
      request: messageContext.message.request,
      connectionId: connection.id,
      role: VerifiedDrpcRole.Server,
      state: VerifiedDrpcState.RequestReceived,
      threadId: messageContext.message.id,
    })
    await this.verifiedDrpcMessageRepository.save(messageContext.agentContext, verifiedDrpcMessageRecord)
    this.emitStateChangedEvent(messageContext.agentContext, verifiedDrpcMessageRecord)
    await this.verifyClient(messageContext.agentContext, connection.id, this.config.proofRequestOptions, verifiedDrpcMessageRecord, this.config.proofTimeoutMs)
    
    return verifiedDrpcMessageRecord
  }

  private emitStateChangedEvent(agentContext: AgentContext, verifiedDrpcMessageRecord: VerifiedDrpcRecord) {
    if (
      verifiedDrpcMessageRecord.request &&
      (isValidVerifiedDrpcRequest(verifiedDrpcMessageRecord.request) ||
        (Array.isArray(verifiedDrpcMessageRecord.request) &&
          verifiedDrpcMessageRecord.request.length > 0 &&
          isValidVerifiedDrpcRequest(verifiedDrpcMessageRecord.request[0])))
    ) {
      this.eventEmitter.emit<VerifiedDrpcRequestStateChangedEvent>(agentContext, {
        type: VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged,
        payload: { verifiedDrpcMessageRecord: verifiedDrpcMessageRecord.clone() },
      })
    } else if (
      verifiedDrpcMessageRecord.response &&
      (isValidVerifiedDrpcResponse(verifiedDrpcMessageRecord.response) ||
        (Array.isArray(verifiedDrpcMessageRecord.response) &&
          verifiedDrpcMessageRecord.response.length > 0 &&
          isValidVerifiedDrpcResponse(verifiedDrpcMessageRecord.response[0])))
    ) {
      this.eventEmitter.emit<VerifiedDrpcResponseStateChangedEvent>(agentContext, {
        type: VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged,
        payload: { verifiedDrpcMessageRecord: verifiedDrpcMessageRecord.clone() },
      })
    }
  }

  private async updateState(agentContext: AgentContext, verifiedDrpcRecord: VerifiedDrpcRecord, newState: VerifiedDrpcState) {
    verifiedDrpcRecord.state = newState
    await this.verifiedDrpcMessageRepository.update(agentContext, verifiedDrpcRecord)

    this.emitStateChangedEvent(agentContext, verifiedDrpcRecord)
  }

  public findByThreadAndConnectionId(
    agentContext: AgentContext,
    connectionId: string,
    threadId: string
  ): Promise<VerifiedDrpcRecord | null> {
    return this.verifiedDrpcMessageRepository.findSingleByQuery(agentContext, {
      connectionId,
      threadId,
    })
  }

  public async findAllByQuery(agentContext: AgentContext, query: Query<VerifiedDrpcRecord>) {
    return this.verifiedDrpcMessageRepository.findByQuery(agentContext, query)
  }

  public async getById(agentContext: AgentContext, verifiedDrpcMessageRecordId: string) {
    return this.verifiedDrpcMessageRepository.getById(agentContext, verifiedDrpcMessageRecordId)
  }

  public async deleteById(agentContext: AgentContext, verifiedDrpcMessageRecordId: string) {
    const verifiedDrpcMessageRecord = await this.getById(agentContext, verifiedDrpcMessageRecordId)
    return this.verifiedDrpcMessageRepository.delete(agentContext, verifiedDrpcMessageRecord)
  }
}
