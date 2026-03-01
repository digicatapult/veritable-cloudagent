/**
 * Proof Presentation (Request, Proposal) types.
 *
 * NOTE: Proof DTOs remain local controller-boundary types by design.
 * We keep stage-specific request shapes and simplified accept-request payload support
 * (`SimpleProofFormats`) to preserve API behaviour and avoid leaking deeper PEX/Sphereon
 * model graphs into TSOA-generated schemas.
 */
import type { AnonCredsRequestedAttributeMatch, AnonCredsRequestedPredicateMatch } from '@credo-ts/anoncreds'
import type {
  DidCommAutoAcceptProof,
  DidCommProofExchangeRecord,
  DidCommProofFormatPayload,
  ProofsProtocolVersionType,
} from '@credo-ts/didcomm'
import type { AnonCredsRequestProofFormatOptions } from './anoncreds.js'
import type { UUID } from './common.js'
import type { PresentationExchangeAcceptProposal, PresentationExchangeCreateRequest } from './pex.js'
import type { ProofFormats, ProofProtocols } from './protocols.js'

export interface ProofRequestMessageResponse {
  message: string
  proofRecord: DidCommProofExchangeRecord
}

export interface ProposeProofOptions {
  connectionId: UUID
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: DidCommProofFormatPayload<ProofFormats, 'createProposal'>
  goalCode?: string
  parentThreadId?: UUID
  autoAcceptProof?: DidCommAutoAcceptProof
  comment?: string
}

export interface SimpleProofFormats {
  /**
   * API-friendly simplified credential selection input for accept-request.
   * This intentionally diverges from full proof-format payloads and is validated
   * via `isSimpleAnonCredsProofFormats` in `src/utils/proofs.ts`.
   */
  anoncreds?: {
    attributes?: Record<
      string,
      {
        /**
         * The ID of the credential to use for this attribute.
         * NOTE: This object must contain EXACTLY 'credentialId' and 'revealed' keys.
         * Additional properties are not allowed and will cause validation failure.
         *
         * TO EXTEND: If adding new properties, you MUST update the validation logic
         * in `src/utils/proofs.ts` (isSimpleProofFormats method) to accept the new key count.
         */
        credentialId: string
        /**
         * Whether to reveal the attribute value.
         */
        revealed: boolean
      }
    >
    predicates?: Record<
      string,
      {
        /**
         * The ID of the credential to use for this predicate.
         * NOTE: This object must contain EXACTLY 'credentialId' key.
         * Additional properties are not allowed and will cause validation failure.
         *
         * TO EXTEND: If adding new properties, you MUST update the validation logic
         * in `src/utils/proofs.ts` (isSimpleProofFormats method) to accept the new key count.
         */
        credentialId: string
      }
    >
  }
}

export interface AcceptProofProposalOptions {
  proofFormats?: {
    /**
     * Stage-correct accept-proposal payload.
     * Credo TS v0.6.x expects only name/version here (not a full proof request).
     */
    anoncreds?: {
      name?: string
      version?: string
    }
    presentationExchange?: PresentationExchangeAcceptProposal
  }
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: DidCommAutoAcceptProof
  comment?: string
}

export interface NegotiateProofProposalOptions {
  proofFormats: {
    anoncreds?: AnonCredsRequestProofFormatOptions
    presentationExchange?: PresentationExchangeCreateRequest
  }
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: DidCommAutoAcceptProof
  comment?: string
}

export interface MatchingCredentialsResponse {
  proofFormats: {
    anoncreds?: {
      attributes?: Record<string, AnonCredsRequestedAttributeMatch[]>
      predicates?: Record<string, AnonCredsRequestedPredicateMatch[]>
    }
  }
}

export interface AcceptProofRequestOptions {
  useReturnRoute?: boolean
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: DidCommAutoAcceptProof
  comment?: string
  proofFormats?: DidCommProofFormatPayload<ProofFormats, 'acceptRequest'> | SimpleProofFormats
}

export interface CreateProofRequestOptions {
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: {
    anoncreds?: AnonCredsRequestProofFormatOptions
    presentationExchange?: PresentationExchangeCreateRequest
  }
  goalCode?: string
  parentThreadId?: UUID
  willConfirm?: boolean
  autoAcceptProof?: DidCommAutoAcceptProof
  comment?: string
}

export interface RequestProofOptions extends CreateProofRequestOptions {
  connectionId: UUID
}
