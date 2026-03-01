/**
 * DID Resolution, Creation, and Management types.
 */
import type {
  DidDocument,
  DidDocumentMetadata,
  DidRegistrationSecretOptions,
  DidResolutionMetadata,
} from '@credo-ts/core'
import type { DID } from './common.js'

export type { DidCreateOptions, ImportDidOptions } from '@credo-ts/core'

type DidDocumentLike = DidDocument | Record<string, unknown>

export interface DidResolutionResultProps {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

export interface DidOperationStateFinished {
  state: 'finished'
  did: DID
  secret?: DidRegistrationSecretOptions
  didDocument: DidDocumentLike
}
export interface DidOperationStateFailed {
  state: 'failed'
  did?: DID
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocumentLike
  reason: string
}
export interface DidOperationStateWait {
  state: 'wait'
  did?: DID
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocumentLike
}
export interface DidOperationStateActionBase {
  state: 'action'
  action: string
  did?: DID
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocumentLike
}

export type DidCreateResult = DidOperationStateWait | DidOperationStateActionBase | DidOperationStateFinished
