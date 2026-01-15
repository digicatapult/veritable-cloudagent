import type { AnonCredsRequestedAttributeMatch, AnonCredsRequestedPredicateMatch } from '@credo-ts/anoncreds'
import type {
  AutoAcceptProof,
  ProofExchangeRecord,
  ProofFormatPayload,
  ProofsProtocolVersionType,
} from '@credo-ts/core'
import type { AnonCredsRequestProofFormatOptions } from './anoncreds'
import type { UUID } from './common'
import type { ProofFormats, ProofProtocols } from './protocols'

export interface ProofRequestMessageResponse {
  message: string
  proofRecord: ProofExchangeRecord
}

export interface ProposeProofOptions {
  connectionId: UUID
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: ProofFormatPayload<ProofFormats, 'createProposal'>
  goalCode?: string
  parentThreadId?: UUID
  autoAcceptProof?: AutoAcceptProof
  comment?: string
}

export interface SimpleProofFormats {
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
    anoncreds?: AnonCredsRequestProofFormatOptions
  }
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: AutoAcceptProof
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
  autoAcceptProof?: AutoAcceptProof
  comment?: string
  proofFormats?: ProofFormatPayload<ProofFormats, 'acceptRequest'> | SimpleProofFormats
}

export interface CreateProofRequestOptions {
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: {
    [key in ProofFormats[number] as key['formatKey']]?: AnonCredsRequestProofFormatOptions
  }
  goalCode?: string
  parentThreadId?: UUID
  willConfirm?: boolean
  autoAcceptProof?: AutoAcceptProof
  comment?: string
}

export interface RequestProofOptions extends CreateProofRequestOptions {
  connectionId: UUID
}
