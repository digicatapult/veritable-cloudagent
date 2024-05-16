import type { VerifiedDrpcService } from '../services/VerifiedDrpcService'
import type { MessageHandler, MessageHandlerInboundMessage } from '@credo-ts/core'

import { VerifiedDrpcRequestMessage } from '../messages'

export class VerifiedDrpcRequestHandler implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService
  public supportedMessages = [VerifiedDrpcRequestMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcRequestHandler>) {
    await this.verifiedDrpcMessageService.receiveRequest(messageContext)
  }
}
