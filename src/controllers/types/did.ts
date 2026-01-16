/**
 * DID Resolution, Creation, and Management types.
 */
import type { DidDocument, DidDocumentMetadata, DidResolutionMetadata, KeyType } from '@credo-ts/core'
import type { DID } from './common.js'

export interface DidResolutionResultProps {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

interface PrivateKey {
  keyType: KeyType
  privateKey: string
}

export interface ImportDidOptions {
  did: DID
  didDocument?: DidDocument
  privateKeys?: PrivateKey[]
  overwrite?: boolean
}

export interface DidCreateOptions {
  method?: string
  did?: DID
  options?: { [x: string]: unknown }
  secret?: { [x: string]: unknown }
  didDocument?: DidDocument
}

export interface DidOperationStateFinished {
  state: 'finished'
  did: DID
  secret?: { [x: string]: unknown }
  didDocument: { [x: string]: unknown }
}
export interface DidOperationStateFailed {
  state: 'failed'
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
  reason: string
}
export interface DidOperationStateWait {
  state: 'wait'
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
}
export interface DidOperationStateActionBase {
  state: 'action'
  action: string
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
}

export type DidCreateResult = DidOperationStateWait | DidOperationStateActionBase | DidOperationStateFinished
