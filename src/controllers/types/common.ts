/**
 * Common shared type definitions and TSOA helpers.
 */
/**
 * Stringified UUIDv4.
 * @pattern [0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}
 * @example "52907745-7672-470e-a803-a2f8feb52944"
 */
export type UUID = string

/**
 * W3C Decentralized Identifier format v1.0
 * @pattern did:[A-Za-z0-9:]+
 * @example "did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL"
 */
export type DID = string

/**
 * @example "1.0.0"
 */
export type Version = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:3:CL:20:tag"
 */
export type CredentialDefinitionId = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0"
 */
export type SchemaId = string

/**
 * Recursive JSON types for TSOA compatibility.
 * Defined locally to avoid TSOA errors with imported specific types.
 *
 * NOTE: The extensive type and interface definitions in this file (specifically explicitly
 * recursive types like ApiJsonObject) are required to satisfy TSOA's schema generation.
 * TSOA struggles with generic 'Record<string, any>' or complex union types imported
 * from @credo-ts/core, often throwing 'Index Type' or 'Reference' errors during spec generation.
 * By defining strict, self-contained recursive structures here, we ensure Swagger/OpenAPI
 * specs are generated correctly.
 */
export type ApiJsonValue = string | number | boolean | null | ApiJsonObject | ApiJsonArray | undefined
export type ApiJsonArray = Array<ApiJsonValue>
export interface ApiJsonObject {
  [key: string]: ApiJsonValue
}

export type GenericRecord = ApiJsonObject
