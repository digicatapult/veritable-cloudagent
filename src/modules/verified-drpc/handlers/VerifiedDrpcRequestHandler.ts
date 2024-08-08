import type { MessageHandler, MessageHandlerInboundMessage, ProofProtocol } from '@credo-ts/core'
import type { VerifiedDrpcService } from '../services/VerifiedDrpcService.js'

import { VerifiedDrpcRequestMessage } from '../messages/index.js'

export class VerifiedDrpcRequestHandler<PPs extends ProofProtocol[]> implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  public supportedMessages = [VerifiedDrpcRequestMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService<PPs>) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcRequestHandler<PPs>>) {
    await this.verifiedDrpcMessageService.receiveRequest(messageContext)
  }
}
