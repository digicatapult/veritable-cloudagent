import type {
  AnonCredsProofFormat,
  AnonCredsProofRequestRestriction,
  AnonCredsRequestProofFormat,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
} from '@credo-ts/anoncreds'
import type { DifPresentationExchangeProofFormat, GetProofFormatDataReturn, ProofFormatPayload } from '@credo-ts/core'

import type {
  AcceptProofRequestOptions,
  AnonCredsProofRequestRestrictionOptions,
  AnonCredsRequestProofFormatOptions,
  PresentationExchangeCreateRequest,
  ProofFormats,
  SimpleProofFormats,
} from '../controllers/types/index.js'
import { maybeMapValues } from './helpers.js'

type AgentProofFormats = [AnonCredsProofFormat, DifPresentationExchangeProofFormat]
type AgentPresentationDefinition =
  DifPresentationExchangeProofFormat['proofFormats']['createRequest']['presentationDefinition']

type ValidationFieldError = { message: string; value?: unknown }

/**
 * Validates that a PEX presentation definition stays within a conservative “v1-compatible profile”.
 *
 * Why: Credo TS v0.5.x’s PEX type surface is V1-shaped, while controller DTOs intentionally use
 * permissive JSON-ish types to keep TSOA stable. This validator makes the runtime contract explicit
 * and returns a 422 for unknown / v2-only-ish constructs.
 */

export const validatePexV1Presentation = (value: unknown): Record<string, ValidationFieldError> | null => {
  const fieldPath = 'proofFormats.presentationExchange.presentationDefinition'
  const errors: Record<string, ValidationFieldError> = {}
  const addError = (field: string, message: string, errorValue?: unknown) => {
    if (errors[field]) return
    errors[field] = { message, value: errorValue }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    addError(fieldPath, 'presentationDefinition must be an object', value)
    return errors
  }

  const presentationDefinition = value as Record<string, unknown>

  const allowedTopLevelKeys = new Set(['id', 'input_descriptors', 'name', 'purpose', 'format'])
  for (const key of Object.keys(presentationDefinition)) {
    if (key === 'submission_requirements') {
      addError(
        `${fieldPath}.submission_requirements`,
        'submission_requirements is not supported on the current PEX profile',
        presentationDefinition[key]
      )
      continue
    }
    if (!allowedTopLevelKeys.has(key)) {
      addError(`${fieldPath}.${key}`, 'Unexpected property', presentationDefinition[key])
    }
  }

  const id = presentationDefinition.id
  if (typeof id !== 'string' || id.length === 0) {
    addError(`${fieldPath}.id`, 'id must be a non-empty string', id)
  }

  const inputDescriptors = presentationDefinition.input_descriptors
  if (!Array.isArray(inputDescriptors)) {
    addError(`${fieldPath}.input_descriptors`, 'input_descriptors must be an array', inputDescriptors)
    return Object.keys(errors).length > 0 ? errors : null
  }

  const inputDescriptorArray = inputDescriptors as unknown[]

  const allowedDescriptorKeys = new Set(['id', 'name', 'purpose', 'group', 'constraints', 'format'])
  for (const [index, descriptor] of inputDescriptorArray.entries()) {
    const descriptorPath = `${fieldPath}.input_descriptors[${index}]`
    if (typeof descriptor !== 'object' || descriptor === null || Array.isArray(descriptor)) {
      addError(descriptorPath, 'input descriptor must be an object', descriptor)
      continue
    }

    const descriptorRecord = descriptor as Record<string, unknown>

    for (const key of Object.keys(descriptorRecord)) {
      if (!allowedDescriptorKeys.has(key)) {
        addError(`${descriptorPath}.${key}`, 'Unexpected property', descriptorRecord[key])
      }
    }

    const descriptorId = descriptorRecord.id
    if (typeof descriptorId !== 'string' || descriptorId.length === 0) {
      addError(`${descriptorPath}.id`, 'id must be a non-empty string', descriptorId)
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export const transformAnonCredsAttributeMarkers = (attributes?: { [key: string]: boolean }) => {
  if (!attributes) {
    return undefined
  }

  return Object.entries(attributes).reduce<{ [key in `attr::${string}::marker`]: '1' | '0' }>(
    (acc, [attr, val]) => ({
      [`attr::${attr}::marker`]: val ? '1' : '0',
      ...acc,
    }),
    {}
  )
}

export const transformAnonCredsAttributeValues = (attributeValues?: { [key in string]: string }) => {
  if (!attributeValues) {
    return undefined
  }

  return Object.entries(attributeValues).reduce<{ [key in `attr::${string}::value`]: string }>(
    (acc, [attr, val]) => ({
      [`attr::${attr}::value`]: val,
      ...acc,
    }),
    {}
  )
}

export const transformAnonCredsRestriction = ({
  attributeValues,
  attributeMarkers,
  ...others
}: AnonCredsProofRequestRestrictionOptions): AnonCredsProofRequestRestriction => ({
  ...transformAnonCredsAttributeMarkers(attributeMarkers),
  ...transformAnonCredsAttributeValues(attributeValues),
  ...others,
})

export const transformAnonCredsProofFormat = (
  proofFormat?: AnonCredsRequestProofFormatOptions
): AnonCredsRequestProofFormat | undefined => {
  if (!proofFormat) {
    return undefined
  }

  const { requested_attributes, requested_predicates, ...rest } = proofFormat

  return {
    ...rest,
    requested_attributes: maybeMapValues(
      ({ restrictions, ...other }) => ({
        restrictions: restrictions?.map(transformAnonCredsRestriction),
        ...other,
      }),
      requested_attributes
    ),
    requested_predicates: maybeMapValues(
      ({ restrictions, ...other }) => ({
        restrictions: restrictions?.map(transformAnonCredsRestriction),
        ...other,
      }),
      requested_predicates
    ),
  }
}

export const transformProofFormats = (proofFormats: {
  anoncreds?: AnonCredsRequestProofFormatOptions
  presentationExchange?: PresentationExchangeCreateRequest
}): ProofFormatPayload<AgentProofFormats, 'createRequest'> => {
  return {
    ...(proofFormats.anoncreds ? { anoncreds: transformAnonCredsProofFormat(proofFormats.anoncreds) } : {}),
    ...(proofFormats.presentationExchange
      ? {
          presentationExchange: {
            ...proofFormats.presentationExchange,
            presentationDefinition: proofFormats.presentationExchange
              .presentationDefinition as AgentPresentationDefinition,
          },
        }
      : {}),
  }
}

export const transformProposeProofFormats = (
  proofFormats: ProofFormatPayload<ProofFormats, 'createProposal'>
): ProofFormatPayload<AgentProofFormats, 'createProposal'> => {
  return {
    ...(proofFormats.anoncreds ? { anoncreds: proofFormats.anoncreds } : {}),
    ...(proofFormats.presentationExchange
      ? {
          presentationExchange: {
            presentationDefinition: proofFormats.presentationExchange
              .presentationDefinition as AgentPresentationDefinition,
          },
        }
      : {}),
  }
}

/**
 * Checks if the provided proof formats match the simplified format structure.
 *
 * @param formats The proof formats to check.
 * @returns True if the formats match the SimpleProofFormats structure, false otherwise.
 */
export const isSimpleAnonCredsProofFormats = (
  formats: AcceptProofRequestOptions['proofFormats']
): formats is SimpleProofFormats => {
  if (!formats || !('anoncreds' in formats)) return false

  const anoncreds = (formats as { anoncreds: unknown }).anoncreds as {
    attributes?: Record<string, unknown>
    predicates?: Record<string, unknown>
  }

  const hasAttributes = !!anoncreds?.attributes && Object.keys(anoncreds.attributes).length > 0
  const hasPredicates = !!anoncreds?.predicates && Object.keys(anoncreds.predicates).length > 0

  if (!hasAttributes && !hasPredicates) return false

  const hasForbiddenKeys = (entry: unknown) =>
    typeof entry === 'object' &&
    entry !== null &&
    ('credentialInfo' in (entry as object) || 'timestamp' in (entry as object))

  const isValidEntry = (entry: unknown, requiredKeys: string[]) => {
    if (typeof entry !== 'object' || entry === null) return false

    const obj = entry as Record<string, unknown>
    const keys = Object.keys(obj)

    // Must contain all required keys, no forbidden keys, and no unexpected keys
    const hasAllRequired = requiredKeys.every((k) => k in obj)
    const onlyExpectedKeys = keys.every((k) => requiredKeys.includes(k))

    return hasAllRequired && onlyExpectedKeys && !hasForbiddenKeys(entry)
  }

  if (
    hasAttributes &&
    !Object.values(anoncreds.attributes!).every((a) => isValidEntry(a, ['credentialId', 'revealed']))
  ) {
    return false
  }

  if (hasPredicates && !Object.values(anoncreds.predicates!).every((p) => isValidEntry(p, ['credentialId']))) {
    return false
  }

  return true
}

/**
 * Redacts sensitive information from proof formats for logging purposes.
 *
 * @param formats The proof formats to redact.
 * @returns A redacted copy of the proof formats.
 */
export const redactProofFormats = (
  formats: ProofFormatPayload<ProofFormats, 'acceptRequest'>
): Record<string, unknown> => {
  const anoncreds = formats.anoncreds
  if (!anoncreds) return formats as Record<string, unknown>

  const attributes = anoncreds.attributes
    ? Object.fromEntries(
        Object.entries(anoncreds.attributes).map(([key, value]) => {
          if (value && typeof value === 'object') {
            return [key, { ...value, credentialInfo: '[REDACTED]', value: '[REDACTED]' }]
          }
          return [key, value]
        })
      )
    : undefined

  const predicates = anoncreds.predicates
    ? Object.fromEntries(
        Object.entries(anoncreds.predicates).map(([key, value]) => {
          if (value && typeof value === 'object') {
            return [key, { ...value, credentialInfo: '[REDACTED]' }]
          }
          return [key, value]
        })
      )
    : undefined

  return {
    ...formats,
    anoncreds: {
      ...anoncreds,
      attributes,
      predicates,
    },
  } as Record<string, unknown>
}

/**
 * Simplifies the proof content by flattening the structure and extracting relevant attribute values.
 *
 * @param formatData The raw proof format data containing request and presentation details.
 * @returns A simplified record of attribute names and their revealed values.
 */
export const simplifyAnonCredsProofContent = (
  formatData: GetProofFormatDataReturn<[AnonCredsProofFormat, DifPresentationExchangeProofFormat]>
): Record<string, unknown> => {
  const request = formatData.request?.anoncreds
  const presentation = formatData.presentation?.anoncreds

  if (!request || !presentation) {
    return {}
  }
  const simplified: Record<string, unknown> = {}
  const { requested_attributes = {} } = request
  const { revealed_attrs = {}, revealed_attr_groups = {} } = presentation.requested_proof || {}

  for (const [referent, reqAttr] of Object.entries(requested_attributes)) {
    const { name, names } = reqAttr as AnonCredsRequestedAttribute

    if (name && revealed_attrs[referent]) {
      simplified[name] = revealed_attrs[referent].raw
    } else if (names && revealed_attr_groups[referent]) {
      const group = revealed_attr_groups[referent]
      names.forEach((n) => {
        if (group.values[n]) simplified[n] = group.values[n].raw
      })
    }
  }

  return simplified
}

/**
 * Hydrates requested attributes with matching credentials from the available set.
 *
 * @param requested Map of requested attributes with credential IDs and revealed status.
 * @param available Map of available credentials for each attribute.
 * @returns A map of hydrated attributes.
 */
export const hydrateAnonCredsAttributes = (
  requested: Record<string, { credentialId: string; revealed: boolean }> | undefined,
  available: Record<string, AnonCredsRequestedAttributeMatch[]> | undefined
): { hydrated: Record<string, AnonCredsRequestedAttributeMatch>; errors: string[] } => {
  const hydrated: Record<string, AnonCredsRequestedAttributeMatch> = {}
  const errors: string[] = []
  if (!requested || !available) return { hydrated, errors }

  for (const [key, value] of Object.entries(requested)) {
    const match = available[key]?.find((m) => m.credentialId === value.credentialId)
    if (match) {
      if (value.revealed !== match.revealed) {
        errors.push(
          `Attribute '${key}' cannot be ${value.revealed ? 'revealed' : 'hidden'}. The proof request or credential requires this attribute to be ${!value.revealed ? 'revealed' : 'hidden'}.`
        )
      } else {
        hydrated[key] = { ...match, revealed: value.revealed }
      }
    }
  }
  return { hydrated, errors }
}

/**
 * Hydrates requested predicates with matching credentials from the available set.
 *
 * @param requested Map of requested predicates with credential IDs.
 * @param available Map of available credentials for each predicate.
 * @returns A map of hydrated predicates.
 */
export const hydrateAnonCredsPredicates = (
  requested: Record<string, { credentialId: string }> | undefined,
  available: Record<string, AnonCredsRequestedPredicateMatch[]> | undefined
): Record<string, AnonCredsRequestedPredicateMatch> => {
  const hydrated: Record<string, AnonCredsRequestedPredicateMatch> = {}
  if (!requested || !available) return hydrated

  for (const [key, value] of Object.entries(requested)) {
    const match = available[key]?.find((m) => m.credentialId === value.credentialId)
    if (match) {
      hydrated[key] = match
    }
  }
  return hydrated
}

/**
 * Identifies credentials that were requested but not found in the hydrated set.
 *
 * @param requested Map of requested items with credential IDs.
 * @param hydrated Map of hydrated items.
 * @returns A list of missing credentials.
 */
export const getMissingAnonCredsCredentials = (
  requested: Record<string, { credentialId: string }> | undefined,
  hydrated: Record<string, { credentialId: string }>
): { name: string; credentialId: string }[] => {
  if (!requested) return []
  return Object.entries(requested)
    .filter(([key, value]) => {
      const h = hydrated[key]
      return !h || h.credentialId !== value.credentialId
    })

    .map(([name, value]) => ({ name, credentialId: value.credentialId }))
}
