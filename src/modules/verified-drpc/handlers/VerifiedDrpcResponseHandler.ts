import type { MessageHandler, MessageHandlerInboundMessage, ProofProtocol } from '@credo-ts/core'
import type { VerifiedDrpcService } from '../services/VerifiedDrpcService.js'

import { VerifiedDrpcResponseMessage } from '../messages/index.js'

export class VerifiedDrpcResponseHandler<PPs extends ProofProtocol[]> implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  public supportedMessages = [VerifiedDrpcResponseMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService<PPs>) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcResponseHandler<PPs>>) {
    await this.verifiedDrpcMessageService.receiveResponse(messageContext)
  }
}
