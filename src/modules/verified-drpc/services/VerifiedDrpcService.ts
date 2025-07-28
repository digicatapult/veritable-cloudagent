import { VerifiedDrpcModuleConfig } from '../VerifiedDrpcModuleConfig.js'

import {
  type AgentContext,
  type CreateProofRequestOptions,
  EventEmitter,
  type InboundMessageContext,
  injectable,
  ProofEventTypes,
  ProofProtocol,
  ProofsApi,
  ProofState,
  type ProofStateChangedEvent,
  type Query,
} from '@credo-ts/core'

import { BadRequest, NotFoundError } from '../../../error.js'
import {
  VerifiedDrpcRequestEventTypes,
  type VerifiedDrpcRequestStateChangedEvent,
} from '../VerifiedDrpcRequestEvents.js'
import {
  VerifiedDrpcResponseEventTypes,
  type VerifiedDrpcResponseStateChangedEvent,
} from '../VerifiedDrpcResponseEvents.js'
import {
  type VerifiedDrpcRequest,
  VerifiedDrpcRequestMessage,
  type VerifiedDrpcResponse,
  VerifiedDrpcResponseMessage,
} from '../messages/index.js'
import {
  isValidVerifiedDrpcRequest,
  isValidVerifiedDrpcResponse,
  VerifiedDrpcRole,
  VerifiedDrpcState,
} from '../models/index.js'
import { VerifiedDrpcRecord, VerifiedDrpcRepository } from '../repository/index.js'

@injectable()
export class VerifiedDrpcService<PPs extends ProofProtocol[]> {
  private config: VerifiedDrpcModuleConfig<PPs>
  private verifiedDrpcMessageRepository: VerifiedDrpcRepository
  private eventEmitter: EventEmitter

  public constructor(
    verifiedDrpcModuleConfig: VerifiedDrpcModuleConfig<PPs>,
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

  private async verifyConnection(
    agentContext: AgentContext,
    connectionId: string,
    proofOptions: CreateProofRequestOptions<ProofProtocol[]>,
    timeoutMs: number
  ) {
    const proofsApi = agentContext.dependencyManager.resolve(ProofsApi) as ProofsApi<ProofProtocol[]>
    const { id: proofRecordId } = await proofsApi.requestProof({ ...proofOptions, connectionId })
    await new Promise<void>((resolve, reject) => {
      const proofFailed = () => {
        this.eventEmitter.off(ProofEventTypes.ProofStateChanged, onProofStateChanged)
        reject('Proof verification timed out')
      }
      const proofTimeout = setTimeout(proofFailed, timeoutMs)
      const onProofStateChanged = async ({ payload: { proofRecord } }: ProofStateChangedEvent) => {
        if (proofRecord.id === proofRecordId) {
          if (proofRecord.state === ProofState.Done) {
            clearTimeout(proofTimeout)
            this.eventEmitter.off(ProofEventTypes.ProofStateChanged, onProofStateChanged)
            resolve()
          } else if (proofRecord.state === ProofState.Abandoned) {
            proofFailed()
          }
        }
      }
      this.eventEmitter.on(ProofEventTypes.ProofStateChanged, onProofStateChanged)
    })
  }

  public async verifyServer(
    agentContext: AgentContext,
    connectionId: string,
    proofOptions: CreateProofRequestOptions<ProofProtocol[]>,
    verifiedDrpcRecord: VerifiedDrpcRecord,
    timeoutMs: number = 5000
  ) {
    try {
      await this.verifyConnection(agentContext, connectionId, proofOptions, timeoutMs)
      verifiedDrpcRecord.isVerified = true
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.RequestSent)
    } catch (e) {
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Abandoned)
      agentContext.config.logger.warn(`Error verifying DRPC server: ${e}`)
    }
  }

  public async verifyClient(
    agentContext: AgentContext,
    connectionId: string,
    proofOptions: CreateProofRequestOptions<ProofProtocol[]>,
    verifiedDrpcRecord: VerifiedDrpcRecord,
    timeoutMs: number = 5000
  ) {
    try {
      await this.verifyConnection(agentContext, connectionId, proofOptions, timeoutMs)
      verifiedDrpcRecord.isVerified = true
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.ClientProofReceived)
    } catch (e) {
      await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Abandoned)
      agentContext.config.logger.warn(`Error verifying DRPC client: ${e}`)
    }
  }

  public async createResponseMessage(
    agentContext: AgentContext,
    response: VerifiedDrpcResponse,
    verifiedDrpcRecord: VerifiedDrpcRecord
  ) {
    const verifiedDrpcMessage = new VerifiedDrpcResponseMessage({ response, threadId: verifiedDrpcRecord.threadId })

    verifiedDrpcRecord.assertState(VerifiedDrpcState.ClientProofReceived)

    verifiedDrpcRecord.response = response
    verifiedDrpcRecord.request = undefined

    await this.updateState(agentContext, verifiedDrpcRecord, VerifiedDrpcState.Completed)

    return { responseMessage: verifiedDrpcMessage, record: verifiedDrpcRecord }
  }

  public createRequestListener(
    callback: (params: {
      verifiedDrpcMessageRecord: VerifiedDrpcRecord
      removeListener: () => void
    }) => void | Promise<void>
  ) {
    const listener = async (event: VerifiedDrpcRequestStateChangedEvent) => {
      const { verifiedDrpcMessageRecord } = event.payload
      await callback({
        verifiedDrpcMessageRecord,
        removeListener: () =>
          this.eventEmitter.off(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener),
      })
    }
    this.eventEmitter.on(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener)

    return () => {
      this.eventEmitter.off(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, listener)
    }
  }

  public createResponseListener(
    callback: (params: {
      verifiedDrpcMessageRecord: VerifiedDrpcRecord
      removeListener: () => void
    }) => void | Promise<void>
  ) {
    const listener = async (event: VerifiedDrpcResponseStateChangedEvent) => {
      const { verifiedDrpcMessageRecord } = event.payload
      await callback({
        verifiedDrpcMessageRecord,
        removeListener: () =>
          this.eventEmitter.off(VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged, listener),
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
      throw new NotFoundError('verified DRPC message record not found')
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
      throw new BadRequest('verified DRPC message record already exists')
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
    await this.verifyClient(
      messageContext.agentContext,
      connection.id,
      this.config.proofRequestOptions,
      verifiedDrpcMessageRecord,
      this.config.proofTimeoutMs
    )

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

  private async updateState(
    agentContext: AgentContext,
    verifiedDrpcRecord: VerifiedDrpcRecord,
    newState: VerifiedDrpcState
  ) {
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
