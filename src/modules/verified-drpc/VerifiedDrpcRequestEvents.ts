import type { BaseEvent } from '@credo-ts/core'
import type { VerifiedDrpcRecord } from './repository/index.js'

export enum VerifiedDrpcRequestEventTypes {
  VerifiedDrpcRequestStateChanged = 'VerifiedDrpcRequestStateChanged',
}
export interface VerifiedDrpcRequestStateChangedEvent extends BaseEvent {
  type: typeof VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged
  payload: {
    verifiedDrpcMessageRecord: VerifiedDrpcRecord
  }
}
