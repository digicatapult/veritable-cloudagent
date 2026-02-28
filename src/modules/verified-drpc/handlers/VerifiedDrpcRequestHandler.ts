import type {
  DidCommProofProtocol,
  DidCommMessageHandler as MessageHandler,
  DidCommMessageHandlerInboundMessage as MessageHandlerInboundMessage,
} from '@credo-ts/didcomm'
import type { VerifiedDrpcService } from '../services/VerifiedDrpcService.js'

import { VerifiedDrpcRequestMessage } from '../messages/index.js'

export class VerifiedDrpcRequestHandler<PPs extends DidCommProofProtocol[]> implements MessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  public supportedMessages = [VerifiedDrpcRequestMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService<PPs>) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<VerifiedDrpcRequestHandler<PPs>>) {
    await this.verifiedDrpcMessageService.receiveRequest(messageContext)
    return undefined
  }
}
