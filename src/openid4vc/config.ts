import type { Express } from 'express'

import {
  OpenId4VciCredentialFormatProfile,
  type OpenId4VcIssuerModuleConfigOptions,
  type OpenId4VcModuleConfigOptions,
  type OpenId4VcVerifierModuleConfigOptions,
} from '@credo-ts/openid4vc'

export interface OpenId4VcConfig {
  issuerEnabled: boolean
  verifierEnabled: boolean
  publicBaseUrl: string
  issuerId: string
  verifierId: string
}

export const validateOpenId4VcConfig = (config: OpenId4VcConfig): void => {
  if (config.issuerEnabled && !config.issuerId) {
    throw new Error('OPENID4VC_ISSUER_ID is required when the issuer role is enabled')
  }
  if (config.verifierEnabled && !config.verifierId) {
    throw new Error('OPENID4VC_VERIFIER_ID is required when the verifier role is enabled')
  }
  if ((config.issuerEnabled || config.verifierEnabled) && !config.publicBaseUrl.trim()) {
    throw new Error('OPENID4VC_PUBLIC_BASE_URL is required when the issuer or verifier role is enabled')
  }
}

export const createOpenId4VcModuleOptions = (config: OpenId4VcConfig, app?: Express): OpenId4VcModuleConfigOptions => {
  validateOpenId4VcConfig(config)

  if ((config.issuerEnabled || config.verifierEnabled) && !app) {
    throw new Error('An Express application is required when the OpenID4VC issuer or verifier is enabled')
  }

  const issuer: OpenId4VcIssuerModuleConfigOptions | undefined = config.issuerEnabled
    ? {
        baseUrl: `${config.publicBaseUrl}/oid4vci`,
        credentialRequestToCredentialMapper: async () => {
          throw new Error('OpenID4VC credential issuance is not implemented')
        },
      }
    : undefined
  const verifier: OpenId4VcVerifierModuleConfigOptions | undefined = config.verifierEnabled
    ? {
        baseUrl: `${config.publicBaseUrl}/oid4vp`,
      }
    : undefined

  return {
    ...(app ? { app } : {}),
    ...(issuer ? { issuer } : {}),
    ...(verifier ? { verifier } : {}),
  }
}

export const openId4VcCredentialConfiguration = {
  format: OpenId4VciCredentialFormatProfile.SdJwtVc as const,
  scope: 'VerifiableCredential',
  vct: 'VerifiableCredential',
  cryptographic_binding_methods_supported: ['jwk'],
  credential_signing_alg_values_supported: ['ES256'],
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: ['ES256'],
    },
  },
}
