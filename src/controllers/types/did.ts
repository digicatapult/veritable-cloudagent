/**
 * DID Resolution, Creation, and Management types.
 */
import type { DidDocument, DidRegistrationSecretOptions } from '@credo-ts/core'
import type { DID } from './common.js'

export type { DidCreateOptions, DidResolutionResult, ImportDidOptions } from '@credo-ts/core'

type DidDocumentLike = DidDocument | Record<string, unknown>

interface DidOperationStateBase {
  did?: DID
  secret?: DidRegistrationSecretOptions
  didDocument?: DidDocumentLike
}

export interface DidOperationStateFinished extends Omit<DidOperationStateBase, 'didDocument'> {
  state: 'finished'
  did: DID
  didDocument: DidDocumentLike
}
export interface DidOperationStateFailed extends DidOperationStateBase {
  state: 'failed'
  reason: string
}
export interface DidOperationStateWait extends DidOperationStateBase {
  state: 'wait'
}
export interface DidOperationStateActionBase extends DidOperationStateBase {
  state: 'action'
  action: string
}

export type DidCreateResult = DidOperationStateWait | DidOperationStateActionBase | DidOperationStateFinished
