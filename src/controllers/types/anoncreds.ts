/**
 * Hyperledger AnonCreds credential and schema types.
 */
import type {
  AnonCredsCredentialDefinition,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsRequestProofFormat,
  AnonCredsSchema,
} from '@credo-ts/anoncreds'
import type { CredentialDefinitionId, DID, SchemaId, UUID, Version } from './common.js'

export interface AnonCredsProofRequestRestrictionOptions {
  schema_id?: SchemaId
  schema_issuer_id?: DID
  schema_name?: string
  schema_version?: Version
  issuer_id?: DID
  cred_def_id?: CredentialDefinitionId
  rev_reg_id?: string
  schema_issuer_did?: DID
  issuer_did?: DID
  attributeValues?: {
    [key: string]: string
  }
  attributeMarkers?: {
    [key: string]: boolean
  }
}

/**
 * Extends upstream type but overrides `restrictions` to use our API-friendly `AnonCredsProofRequestRestrictionOptions`.
 */
export interface AnonCredsRequestedAttributeOptions extends Omit<AnonCredsRequestedAttribute, 'restrictions'> {
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
}

/**
 * Extends upstream type but overrides `restrictions` to use our API-friendly `AnonCredsProofRequestRestrictionOptions`.
 */
export interface AnonCredsRequestedPredicateOptions extends Omit<AnonCredsRequestedPredicate, 'restrictions'> {
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
}

/**
 * Extends upstream type but overrides attributes/predicates to use our API-friendly Options types.
 */
export interface AnonCredsRequestProofFormatOptions extends Omit<
  AnonCredsRequestProofFormat,
  'requested_attributes' | 'requested_predicates'
> {
  requested_attributes?: {
    [key: string]: AnonCredsRequestedAttributeOptions
  }
  requested_predicates?: {
    [key: string]: AnonCredsRequestedPredicateOptions
  }
}

export interface AnonCredsSchemaResponse extends AnonCredsSchema {
  id: UUID
}

export interface AnonCredsCredentialDefinitionResponse extends AnonCredsCredentialDefinition {
  id: UUID
}
