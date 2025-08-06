import { type RecordTags, type TagsBase, BaseRecord, CredoError, utils } from '@credo-ts/core'
import type { UUID } from '../../../controllers/types.js'
import type { VerifiedDrpcRequest, VerifiedDrpcResponse } from '../messages/index.js'
import type { VerifiedDrpcRole, VerifiedDrpcState } from '../models/index.js'

export type CustomVerifiedDrpcMessageTags = TagsBase
export type DefaultVerifiedDrpcMessageTags = {
  connectionId: UUID
  threadId: UUID
}

export type VerifiedDrpcMessageTags = RecordTags<VerifiedDrpcRecord>

export interface VerifiedDrpcStorageProps {
  id?: UUID
  connectionId: UUID
  role: VerifiedDrpcRole
  tags?: CustomVerifiedDrpcMessageTags
  request?: VerifiedDrpcRequest
  response?: VerifiedDrpcResponse
  state: VerifiedDrpcState
  threadId: UUID
  isVerified?: boolean
}

export class VerifiedDrpcRecord extends BaseRecord<DefaultVerifiedDrpcMessageTags, CustomVerifiedDrpcMessageTags> {
  public request?: VerifiedDrpcRequest
  public response?: VerifiedDrpcResponse
  public connectionId!: UUID
  public role!: VerifiedDrpcRole
  public state!: VerifiedDrpcState
  public threadId!: UUID
  public isVerified: boolean = false

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
        `Verified DRPC response record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(
          ', '
        )}.`
      )
    }
  }
}
