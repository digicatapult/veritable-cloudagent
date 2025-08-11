import type {
  VerifiedDrpcRequest,
  VerifiedDrpcRequestMessage,
  VerifiedDrpcResponse,
  VerifiedDrpcResponseMessage,
} from './messages/index.js'
import type { VerifiedDrpcRecord } from './repository/VerifiedDrpcRecord.js'

import {
  type ConnectionRecord,
  type CreateProofRequestOptions,
  type ProofProtocol,
  AgentContext,
  ConnectionsApi,
  MessageHandlerRegistry,
  MessageSender,
  OutboundMessageContext,
  injectable,
} from '@credo-ts/core'

import type { UUID } from '../../controllers/types.js'
import { NotFoundError } from '../../error.js'
import { VerifiedDrpcModuleConfig } from './VerifiedDrpcModuleConfig.js'
import { VerifiedDrpcRequestHandler, VerifiedDrpcResponseHandler } from './handlers/index.js'
import { VerifiedDrpcRole, VerifiedDrpcState } from './models/index.js'
import { VerifiedDrpcService } from './services/index.js'

@injectable()
export class VerifiedDrpcApi<PPs extends ProofProtocol[]> {
  private config: VerifiedDrpcModuleConfig<PPs>
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  private messageSender: MessageSender
  private connectionsApi: ConnectionsApi
  private agentContext: AgentContext

  public constructor(
    verifiedDrpcModuleConfig: VerifiedDrpcModuleConfig<PPs>,
    messageHandlerRegistry: MessageHandlerRegistry,
    verifiedDrpcMessageService: VerifiedDrpcService<PPs>,
    messageSender: MessageSender,
    connectionsApi: ConnectionsApi,
    agentContext: AgentContext
  ) {
    this.config = verifiedDrpcModuleConfig
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
    this.messageSender = messageSender
    this.connectionsApi = connectionsApi
    this.agentContext = agentContext
    //this.config = this.agentContext.dependencyManager.resolve(VerifiedDrpcModuleConfig)
    this.registerMessageHandlers(messageHandlerRegistry)
  }

  /**
   * sends the request object to the connection and returns a function that will resolve to the response
   * @param connectionId the connection to send the request to
   * @param request the request object
   * @param proofOptions the proof options against which to verify the server
   * @param proofTimeoutMs the time in milliseconds to wait for a proof
   * @returns curried function that waits for the response with an optional timeout in seconds
   */
  public async sendRequest(
    connectionId: UUID,
    request: VerifiedDrpcRequest,
    proofOptions: CreateProofRequestOptions<ProofProtocol[]> = this.config.proofRequestOptions,
    proofTimeoutMs: number = this.config.proofTimeoutMs
  ): Promise<(timeout?: number) => Promise<VerifiedDrpcResponse | undefined>> {
    const connection = await this.connectionsApi.getById(connectionId)
    const { requestMessage: verifiedDrpcMessage, record: verifiedDrpcMessageRecord } =
      await this.verifiedDrpcMessageService.createRequestMessage(this.agentContext, request, connection.id)
    await this.verifiedDrpcMessageService.verifyServer(
      this.agentContext,
      connection.id,
      proofOptions,
      verifiedDrpcMessageRecord,
      proofTimeoutMs
    )
    const messageId = verifiedDrpcMessage.id
    await this.sendMessage(connection, verifiedDrpcMessage, verifiedDrpcMessageRecord)
    return async (timeout?: number) => {
      return await this.recvResponse(messageId, timeout)
    }
  }

  /**
   * Listen for a response that has a thread id matching the provided messageId
   * @param messageId the id to match the response to
   * @param timeoutMs the time in milliseconds to wait for a response
   * @returns the response object
   */
  private async recvResponse(messageId: UUID, timeoutMs?: number): Promise<VerifiedDrpcResponse | undefined> {
    return new Promise((resolve) => {
      const listener = ({
        verifiedDrpcMessageRecord,
        removeListener,
      }: {
        verifiedDrpcMessageRecord: VerifiedDrpcRecord
        removeListener: () => void
      }) => {
        const response = verifiedDrpcMessageRecord.response
        if (verifiedDrpcMessageRecord.threadId === messageId) {
          removeListener()
          resolve(response)
        }
      }

      const cancelListener = this.verifiedDrpcMessageService.createResponseListener(listener)
      if (timeoutMs) {
        const handle = setTimeout(() => {
          clearTimeout(handle)
          cancelListener()
          resolve(undefined)
        }, timeoutMs)
      }
    })
  }

  /**
   * Register a handler to fully verified (both client and server) DRPC requests
   * @param handler the handler function that receives a DRPC request record and returns a DRPC response
   * @param proofOptions the proof options against which to verify the client
   * @param proofTimeoutMs the time in milliseconds to wait for a proof
   * @return a function to cancel the listener
   */

  public addRequestListener(
    handler: (
      drpcRecord: VerifiedDrpcRecord,
      agentContext: AgentContext
    ) => VerifiedDrpcResponse | Promise<VerifiedDrpcResponse>
  ): () => void {
    const listener = async ({ verifiedDrpcMessageRecord }: { verifiedDrpcMessageRecord: VerifiedDrpcRecord }) => {
      const request = verifiedDrpcMessageRecord.request
      if (
        request &&
        verifiedDrpcMessageRecord.role === VerifiedDrpcRole.Server &&
        verifiedDrpcMessageRecord.state === VerifiedDrpcState.ClientProofReceived
      ) {
        const response = await handler(verifiedDrpcMessageRecord, this.agentContext)
        this.sendResponse({
          connectionId: verifiedDrpcMessageRecord.connectionId,
          threadId: verifiedDrpcMessageRecord.threadId,
          response,
        })
      }
    }

    return this.verifiedDrpcMessageService.createRequestListener(listener)
  }

  /**
   * Listen for a request and returns the request object and a function to send the response
   * @param timeoutMs the time in milliseconds to wait for a request
   * @returns the request object and a function to send the response
   */
  public async recvRequest(timeoutMs?: number): Promise<
    | {
        request: VerifiedDrpcRequest
        sendResponse: (response: VerifiedDrpcResponse) => Promise<void>
      }
    | undefined
  > {
    return new Promise((resolve) => {
      const listener = async ({
        verifiedDrpcMessageRecord,
        removeListener,
      }: {
        verifiedDrpcMessageRecord: VerifiedDrpcRecord
        removeListener: () => void
      }) => {
        const request = verifiedDrpcMessageRecord.request
        if (
          request &&
          verifiedDrpcMessageRecord.role === VerifiedDrpcRole.Server &&
          verifiedDrpcMessageRecord.state === VerifiedDrpcState.ClientProofReceived
        ) {
          removeListener()
          resolve({
            sendResponse: async (response: VerifiedDrpcResponse) => {
              await this.sendResponse({
                connectionId: verifiedDrpcMessageRecord.connectionId,
                threadId: verifiedDrpcMessageRecord.threadId,
                response,
              })
            },
            request,
          })
        }
      }

      const cancelListener = this.verifiedDrpcMessageService.createRequestListener(listener)

      if (timeoutMs) {
        const handle = setTimeout(() => {
          clearTimeout(handle)
          cancelListener()
          resolve(undefined)
        }, timeoutMs)
      }
    })
  }

  /**
   * Sends a verified drpc response to a connection
   * @param connectionId the connection id to use
   * @param threadId the thread id to respond to
   * @param response the verified drpc response object to send
   */
  public async sendResponse(options: {
    connectionId: UUID
    threadId: UUID
    response: VerifiedDrpcResponse
  }): Promise<void> {
    const connection = await this.connectionsApi.getById(options.connectionId)
    const verifiedDrpcMessageRecord = await this.verifiedDrpcMessageService.findByThreadAndConnectionId(
      this.agentContext,
      options.connectionId,
      options.threadId
    )
    if (!verifiedDrpcMessageRecord) {
      throw new NotFoundError(`no request found for threadId ${options.threadId}`)
    }
    const { responseMessage, record } = await this.verifiedDrpcMessageService.createResponseMessage(
      this.agentContext,
      options.response,
      verifiedDrpcMessageRecord
    )
    await this.sendMessage(connection, responseMessage, record)
  }

  private async sendMessage(
    connection: ConnectionRecord,
    message: VerifiedDrpcRequestMessage | VerifiedDrpcResponseMessage,
    messageRecord: VerifiedDrpcRecord
  ): Promise<void> {
    const outboundMessageContext = new OutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection,
      associatedRecord: messageRecord,
    })
    await this.messageSender.sendMessage(outboundMessageContext)
  }

  private registerMessageHandlers(messageHandlerRegistry: MessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new VerifiedDrpcRequestHandler(this.verifiedDrpcMessageService))
    messageHandlerRegistry.registerMessageHandler(new VerifiedDrpcResponseHandler(this.verifiedDrpcMessageService))
  }
}
