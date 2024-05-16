import type { VerifiedDrpcRequest, VerifiedDrpcResponse, VerifiedDrpcRequestMessage, VerifiedDrpcResponseMessage } from './messages/index.js'
import type { VerifiedDrpcRecord } from './repository/VerifiedDrpcRecord.js'
import type { ProofsApi, ConnectionRecord, ProofProtocol, RequestProofOptions } from '@credo-ts/core'

import {
  AgentContext,
  MessageHandlerRegistry,
  MessageSender,
  OutboundMessageContext,
  injectable,
  ConnectionService,
} from '@credo-ts/core'

import { VerifiedDrpcRequestHandler, VerifiedDrpcResponseHandler } from './handlers'
import { VerifiedDrpcRole } from './models'
import { VerifiedDrpcService } from './services'

@injectable()
export class VerifiedDrpcApi<PPs extends ProofProtocol[]> {
  private verifiedDrpcMessageService: VerifiedDrpcService
  private messageSender: MessageSender
  private proofsApi: ProofsApi<PPs>
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    messageHandlerRegistry: MessageHandlerRegistry,
    verifiedDrpcMessageService: VerifiedDrpcService,
    proofsApi: ProofsApi<PPs>,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext
  ) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
    this.messageSender = messageSender
    this.proofsApi = proofsApi
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.registerMessageHandlers(messageHandlerRegistry)
  }

  /**
   * sends the request object to the connection and returns a function that will resolve to the response
   * @param connectionId the connection to send the request to
   * @param request the request object
   * @returns curried function that waits for the response with an optional timeout in seconds
   */
  public async sendRequest(
    connectionId: string,
    request: VerifiedDrpcRequest,
    proofOptions: RequestProofOptions<PPs>
  ): Promise<() => Promise<VerifiedDrpcResponse | undefined>> {
    console.log({proofOptions})
    const connection = await this.connectionService.getById(this.agentContext, connectionId)
    const { requestMessage: verifiedDrpcMessage, record: verifiedDrpcMessageRecord } =
      await this.verifiedDrpcMessageService.createRequestMessage(this.agentContext, request, connection.id)
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
  private async recvResponse(messageId: string, timeoutMs?: number): Promise<VerifiedDrpcResponse | undefined> {
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
   * Listen for a request and returns the request object and a function to send the response
   * @param timeoutMs the time in seconds to wait for a request
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
      const listener = ({
        verifiedDrpcMessageRecord,
        removeListener,
      }: {
        verifiedDrpcMessageRecord: VerifiedDrpcRecord
        removeListener: () => void
      }) => {
        const request = verifiedDrpcMessageRecord.request
        if (request && verifiedDrpcMessageRecord.role === VerifiedDrpcRole.Server) {
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
  private async sendResponse(options: {
    connectionId: string
    threadId: string
    response: VerifiedDrpcResponse
  }): Promise<void> {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)
    const verifiedDrpcMessageRecord = await this.verifiedDrpcMessageService.findByThreadAndConnectionId(
      this.agentContext,
      options.connectionId,
      options.threadId
    )
    if (!verifiedDrpcMessageRecord) {
      throw new Error(`No request found for threadId ${options.threadId}`)
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
