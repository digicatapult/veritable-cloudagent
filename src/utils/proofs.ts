import type { AnonCredsProofRequestRestriction, AnonCredsRequestProofFormat } from '@credo-ts/anoncreds'

import type {
  AnonCredsProofRequestRestrictionOptions,
  AnonCredsRequestProofFormatOptions,
} from '../controllers/types.js'
import { maybeMapValues } from './helpers.js'

export const transformAttributeMarkers = (attributes?: { [key: string]: boolean }) => {
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

export const transformAttributeValues = (attributeValues?: { [key in string]: string }) => {
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

export const transformRestriction = ({
  attributeValues,
  attributeMarkers,
  ...others
}: AnonCredsProofRequestRestrictionOptions): AnonCredsProofRequestRestriction => ({
  ...transformAttributeMarkers(attributeMarkers),
  ...transformAttributeValues(attributeValues),
  ...others,
})

export const transformProofFormat = (
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
        restrictions: restrictions?.map(transformRestriction),
        ...other,
      }),
      requested_attributes
    ),
    requested_predicates: maybeMapValues(
      ({ restrictions, ...other }) => ({
        restrictions: restrictions?.map(transformRestriction),
        ...other,
      }),
      requested_predicates
    ),
  }
}
