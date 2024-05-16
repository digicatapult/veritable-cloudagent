import type { VerifiedDrpcRequest, VerifiedDrpcResponse } from '../messages/index.js'
import type { VerifiedDrpcRole, VerifiedDrpcState } from '../models/index.js'
import type { RecordTags, TagsBase } from '@credo-ts/core'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'

export type CustomVerifiedDrpcMessageTags = TagsBase
export type DefaultVerifiedDrpcMessageTags = {
  connectionId: string
  threadId: string
}

export type VerifiedDrpcMessageTags = RecordTags<VerifiedDrpcRecord>

export interface VerifiedDrpcStorageProps {
  id?: string
  connectionId: string
  role: VerifiedDrpcRole
  tags?: CustomVerifiedDrpcMessageTags
  request?: VerifiedDrpcRequest
  response?: VerifiedDrpcResponse
  state: VerifiedDrpcState
  threadId: string
}

export class VerifiedDrpcRecord extends BaseRecord<DefaultVerifiedDrpcMessageTags, CustomVerifiedDrpcMessageTags> {
  public request?: VerifiedDrpcRequest
  public response?: VerifiedDrpcResponse
  public connectionId!: string
  public role!: VerifiedDrpcRole
  public state!: VerifiedDrpcState
  public threadId!: string

  public static readonly type = 'VerifiedDrpcRecord'
  public readonly type = VerifiedDrpcRecord.type

  public constructor(props: VerifiedDrpcStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.request = props.request
      this.response = props.response
      this.connectionId = props.connectionId
      this._tags = props.tags ?? {}
      this.role = props.role
      this.state = props.state
      this.threadId = props.threadId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      connectionId: this.connectionId,
      threadId: this.threadId,
    }
  }

  public assertRole(expectedRole: VerifiedDrpcRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Invalid Verified DRPC record role ${this.role}, expected is ${expectedRole}.`)
    }
  }

  public assertState(expectedStates: VerifiedDrpcState | VerifiedDrpcState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Verified DRPC response record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
