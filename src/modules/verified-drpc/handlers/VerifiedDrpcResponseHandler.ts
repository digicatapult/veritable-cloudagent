import type { VerifiedDrpcService } from '../services/VerifiedDrpcService'
import type { MessageHandler, MessageHandlerInboundMessage } from '@credo-ts/core'

import { VerifiedDrpcResponseMessage } from '../messages'

export class VerifiedDrpcResponseHandler implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService
  public supportedMessages = [VerifiedDrpcResponseMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcResponseHandler>) {
    await this.verifiedDrpcMessageService.receiveResponse(messageContext)
  }
}
