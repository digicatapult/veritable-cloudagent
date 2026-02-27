import type { MessageHandler, MessageHandlerInboundMessage } from '@credo-ts/core'
import type { DidCommProofProtocol } from '@credo-ts/didcomm'
import type { VerifiedDrpcService } from '../services/VerifiedDrpcService.js'

import { VerifiedDrpcResponseMessage } from '../messages/index.js'

export class VerifiedDrpcResponseHandler<PPs extends DidCommProofProtocol[]> implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  public supportedMessages = [VerifiedDrpcResponseMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService<PPs>) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcResponseHandler<PPs>>) {
    await this.verifiedDrpcMessageService.receiveResponse(messageContext)
  }
}
