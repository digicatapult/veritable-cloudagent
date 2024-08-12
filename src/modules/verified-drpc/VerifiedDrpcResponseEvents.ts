import type { BaseEvent } from '@credo-ts/core'
import type { VerifiedDrpcRecord } from './repository/index.js'

export enum VerifiedDrpcResponseEventTypes {
  VerifiedDrpcResponseStateChanged = 'VerifiedDrpcResponseStateChanged',
}
export interface VerifiedDrpcResponseStateChangedEvent extends BaseEvent {
  type: typeof VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged
  payload: {
    verifiedDrpcMessageRecord: VerifiedDrpcRecord
  }
}
