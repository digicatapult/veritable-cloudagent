import { IsValidMessageType, parseMessageType, AgentMessage } from '@credo-ts/core'
import { Expose } from 'class-transformer'

import { type VerifiedDrpcErrorCode, IsValidVerifiedDrpcResponse } from '../models/index.js'

export type VerifiedDrpcResponse =
  | VerifiedDrpcResponseObject
  | (VerifiedDrpcResponseObject | Record<string, never>)[]
  | Record<string, never>

export interface VerifiedDrpcResponseError {
  code: VerifiedDrpcErrorCode
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

export interface VerifiedDrpcResponseObject {
  jsonrpc: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any
  error?: VerifiedDrpcResponseError
  id: string | number | null
}

export class VerifiedDrpcResponseMessage extends AgentMessage {
  public constructor(options: { response: VerifiedDrpcResponse; threadId: string }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.response = options.response
      this.setThread({ threadId: options.threadId })
    }
  }

  public static readonly type = parseMessageType('https://didcomm.org/verified-drpc/1.0/response')

  @IsValidMessageType(VerifiedDrpcResponseMessage.type)
  public readonly type = VerifiedDrpcResponseMessage.type.messageTypeUri

  @Expose({ name: 'response' })
  @IsValidVerifiedDrpcResponse()
  public response!: VerifiedDrpcResponse
}
