import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

import type { UUID } from '../../../controllers/types/index.js'
import { verifiedDrpcResponseSchema } from '../models/index.js'

export interface VerifiedDrpcResponseError {
  code: number
  message: string
  data?: unknown
}

export interface VerifiedDrpcResultResponse {
  jsonrpc: '2.0'
  result: unknown
  id: UUID | number | null
}

export interface VerifiedDrpcErrorResponse {
  jsonrpc: '2.0'
  error: VerifiedDrpcResponseError
  id: UUID | number | null
}

export type VerifiedDrpcResponse = VerifiedDrpcResultResponse | VerifiedDrpcErrorResponse

export class VerifiedDrpcResponseMessage extends DidCommMessage {
  public constructor(options: { response: VerifiedDrpcResponse; threadId: UUID }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.response = verifiedDrpcResponseSchema.parse(options.response)
      this.setThread({ threadId: options.threadId })
    }
  }

  public static readonly type = parseMessageType('https://didcomm.org/verified-drpc/1.0/response')

  @IsValidMessageType(VerifiedDrpcResponseMessage.type)
  public readonly type = VerifiedDrpcResponseMessage.type.messageTypeUri

  public response!: VerifiedDrpcResponse
}
