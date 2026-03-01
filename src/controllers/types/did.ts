/**
 * DID Resolution, Creation, and Management types.
 */
import type {
  DidDocument,
  DidDocumentKey,
  DidDocumentMetadata,
  DidRegistrationExtraOptions,
  DidRegistrationSecretOptions,
  DidResolutionMetadata,
} from '@credo-ts/core'
import type { DID } from './common.js'

type DidDocumentLike = DidDocument | Record<string, unknown>

export interface DidResolutionResultProps {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

export interface ImportDidOptions {
  did: DID
  didDocument?: DidDocument
  keys?: DidDocumentKey[]
  overwrite?: boolean
}

export interface DidCreateOptions {
  method?: string
  did?: DID
  // Pass-through options/secret to method-specific Credo registrars.
  // In Credo v0.6 these are intentionally open `Record<string, unknown>` maps.
  options?: DidRegistrationExtraOptions
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocument
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
