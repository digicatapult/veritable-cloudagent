import type { GetCredentialFormatDataReturn } from '@credo-ts/didcomm'

import type { CredentialFormatData, CredentialFormats } from '../controllers/types/index.js'

type ValidationFieldError = { message: string; value?: unknown }

const isJsonLdContextEntry = (entry: unknown): boolean => {
  if (typeof entry === 'string') {
    return entry.length > 0
  }

  return typeof entry === 'object' && entry !== null && !Array.isArray(entry)
}

const hasUnsupportedJsonValue = (value: unknown, seen: WeakSet<object>): boolean => {
  if (value === null) return false

  const valueType = typeof value
  if (valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    return true
  }

  if (valueType !== 'object') {
    return false
  }

  if (seen.has(value as object)) {
    return true
  }

  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.some((item) => hasUnsupportedJsonValue(item, seen))
  }

  return Object.values(value as Record<string, unknown>).some((entry) => hasUnsupportedJsonValue(entry, seen))
}

const toJsonCompatibleObject = (obj: unknown): Record<string, unknown> | undefined => {
  if (obj === undefined || obj === null) {
    return undefined
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new TypeError('Credential format data must be a JSON object')
  }

  if (hasUnsupportedJsonValue(obj, new WeakSet<object>())) {
    throw new TypeError('Credential format data contains unsupported JSON values')
  }

  return obj as Record<string, unknown>
}

export const validateJsonLdCredentialProfile = (
  value: unknown,
  fieldPath = 'credentialFormats.jsonld'
): Record<string, ValidationFieldError> | null => {
  const errors: Record<string, ValidationFieldError> = {}
  const addError = (field: string, message: string, errorValue?: unknown) => {
    if (errors[field]) return
    errors[field] = { message, value: errorValue }
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    addError(fieldPath, 'jsonld credential format must be an object', value)
    return errors
  }

  const jsonld = value as Record<string, unknown>
  const credential = jsonld.credential
  if (typeof credential !== 'object' || credential === null || Array.isArray(credential)) {
    addError(`${fieldPath}.credential`, 'credential must be an object', credential)
    return errors
  }

  const credentialRecord = credential as Record<string, unknown>

  const context = credentialRecord['@context']
  if (typeof context === 'string') {
    if (context.length === 0) {
      addError(`${fieldPath}.credential.@context`, '@context string must be non-empty', context)
    }
  } else if (Array.isArray(context)) {
    if (context.length === 0 || !context.every((entry) => isJsonLdContextEntry(entry))) {
      addError(
        `${fieldPath}.credential.@context`,
        '@context array entries must be non-empty strings or context objects',
        context
      )
    }
  } else if (typeof context === 'object' && context !== null && !Array.isArray(context)) {
    // valid JSON-LD object context
  } else {
    addError(
      `${fieldPath}.credential.@context`,
      '@context must be a string, object, or array of context entries',
      context
    )
  }

  const typeValue = credentialRecord.type
  if (typeof typeValue === 'string') {
    if (typeValue.length === 0) {
      addError(`${fieldPath}.credential.type`, 'type string must be non-empty', typeValue)
    }
  } else if (Array.isArray(typeValue)) {
    if (typeValue.length === 0 || !typeValue.every((entry) => typeof entry === 'string' && entry.length > 0)) {
      addError(`${fieldPath}.credential.type`, 'type array must contain non-empty strings', typeValue)
    }
  } else {
    addError(`${fieldPath}.credential.type`, 'type must be a string or string[]', typeValue)
  }

  if ('credentialSubject' in credentialRecord) {
    const subject = credentialRecord.credentialSubject
    if (typeof subject !== 'object' || subject === null || Array.isArray(subject)) {
      addError(`${fieldPath}.credential.credentialSubject`, 'credentialSubject must be an object', subject)
    }
  }

  if ('options' in jsonld) {
    const options = jsonld.options
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      addError(`${fieldPath}.options`, 'options must be an object when provided', options)
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function transformToCredentialFormatData(
  formatData: GetCredentialFormatDataReturn<CredentialFormats>
): CredentialFormatData {
  return {
    proposalAttributes: formatData.proposalAttributes,
    offerAttributes: formatData.offerAttributes,
    proposal: toJsonCompatibleObject(formatData.proposal),
    offer: toJsonCompatibleObject(formatData.offer),
    request: toJsonCompatibleObject(formatData.request),
    credential: toJsonCompatibleObject(formatData.credential),
  }
}
