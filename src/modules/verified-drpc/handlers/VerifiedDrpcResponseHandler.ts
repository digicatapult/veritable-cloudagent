import type {
  DidCommMessageHandler,
  DidCommMessageHandlerInboundMessage,
  DidCommProofProtocol,
} from '@credo-ts/didcomm'
import type { VerifiedDrpcService } from '../services/VerifiedDrpcService.js'

import { VerifiedDrpcResponseMessage } from '../messages/index.js'

export class VerifiedDrpcResponseHandler<PPs extends DidCommProofProtocol[]> implements DidCommMessageHandler {
  private verifiedDrpcMessageService: VerifiedDrpcService<PPs>
  public supportedMessages = [VerifiedDrpcResponseMessage]

  public constructor(verifiedDrpcMessageService: VerifiedDrpcService<PPs>) {
    this.verifiedDrpcMessageService = verifiedDrpcMessageService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<VerifiedDrpcResponseHandler<PPs>>) {
    await this.verifiedDrpcMessageService.receiveResponse(messageContext)
    return undefined
  }
}
