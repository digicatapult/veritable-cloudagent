import type { VerifiedDrpcRecord } from './repository'
import type { BaseEvent } from '@credo-ts/core'

export enum VerifiedDrpcResponseEventTypes {
  VerifiedDrpcResponseStateChanged = 'VerifiedDrpcResponseStateChanged',
}
export interface VerifiedDrpcResponseStateChangedEvent extends BaseEvent {
  type: typeof VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged
  payload: {
    verifiedDrpcMessageRecord: VerifiedDrpcRecord
  }
}
