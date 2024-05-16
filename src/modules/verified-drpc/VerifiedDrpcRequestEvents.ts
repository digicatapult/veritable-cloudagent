import type { VerifiedDrpcRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

export enum VerifiedDrpcRequestEventTypes {
  VerifiedDrpcRequestStateChanged = 'VerifiedDrpcRequestStateChanged',
}
export interface VerifiedDrpcRequestStateChangedEvent extends BaseEvent {
  type: typeof VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged
  payload: {
    verifiedDrpcMessageRecord: VerifiedDrpcRecord
  }
}
