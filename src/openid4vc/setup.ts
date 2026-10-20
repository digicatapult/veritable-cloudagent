import type { RestAgent } from '../agent.js'
import { openId4VcCredentialConfiguration, type OpenId4VcConfig } from './config.js'

export const setupOpenId4VcResources = async (agent: RestAgent, config: OpenId4VcConfig): Promise<void> => {
  const openid4vc = agent.openid4vc
  if (!openid4vc) {
    throw new Error('OpenID4VC Credo module was not registered')
  }

  if (config.issuerEnabled) {
    const issuerApi = openid4vc.issuer
    if (!issuerApi) {
      throw new Error('OpenID4VC issuer is enabled but its Credo API is unavailable')
    }

    const issuers = await issuerApi.getAllIssuers()
    if (!issuers.some(({ issuerId }) => issuerId === config.issuerId)) {
      await issuerApi.createIssuer({
        issuerId: config.issuerId,
        credentialConfigurationsSupported: {
          verifiableCredential: openId4VcCredentialConfiguration,
        },
        authorizationServerConfigs: [],
      })
    }
  }

  if (config.verifierEnabled) {
    const verifierApi = openid4vc.verifier
    if (!verifierApi) {
      throw new Error('OpenID4VC verifier is enabled but its Credo API is unavailable')
    }

    const verifiers = await verifierApi.getAllVerifiers()
    if (!verifiers.some(({ verifierId }) => verifierId === config.verifierId)) {
      await verifierApi.createVerifier({ verifierId: config.verifierId })
    }
  }
}
