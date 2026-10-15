import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

import type { UUID } from '../../../controllers/types/index.js'
import { verifiedDrpcRequestSchema } from '../models/index.js'

export interface VerifiedDrpcRequest {
  jsonrpc: string
  method: string
  params?: unknown[] | Record<string, unknown>
  id: UUID | number | null
}

export class VerifiedDrpcRequestMessage extends DidCommMessage {
  public constructor(options: { request: VerifiedDrpcRequest }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.request = verifiedDrpcRequestSchema.parse(options.request)
    }
  }

  public static readonly type = parseMessageType('https://didcomm.org/verified-drpc/1.0/request')

  @IsValidMessageType(VerifiedDrpcRequestMessage.type)
  public readonly type = VerifiedDrpcRequestMessage.type.messageTypeUri

  public request!: VerifiedDrpcRequest
}
