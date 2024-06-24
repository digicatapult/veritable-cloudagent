import { IsValidMessageType, parseMessageType, AgentMessage } from '@credo-ts/core'
import { Expose } from 'class-transformer'

import { IsValidVerifiedDrpcRequest } from '../models/index.js'

export interface VerifiedDrpcRequestObject {
  jsonrpc: string
  method: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[] | Record<string, unknown>
  id: string | number | null
}

export type VerifiedDrpcRequest = VerifiedDrpcRequestObject | VerifiedDrpcRequestObject[]

export class VerifiedDrpcRequestMessage extends AgentMessage {
  public constructor(options: { request: VerifiedDrpcRequest }) {
    super()
    if (options) {
      this.id = this.generateId()
      this.request = options.request
    }
  }

  public static readonly type = parseMessageType('https://didcomm.org/verified-drpc/1.0/request')

  @IsValidMessageType(VerifiedDrpcRequestMessage.type)
  public readonly type = VerifiedDrpcRequestMessage.type.messageTypeUri

  @Expose({ name: 'request' })
  @IsValidVerifiedDrpcRequest()
  public request!: VerifiedDrpcRequest
}
