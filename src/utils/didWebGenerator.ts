import { Agent, DidDocument, JsonTransformer } from '@credo-ts/core'
import { Logger } from 'pino'

export interface DidWebGenerationResult {
  did: string
  didDocument: DidDocument
  keys: Array<{ didDocumentRelativeKeyId: string; kmsKeyId: string }>
}

export class DidWebDocGenerator {
  private agent: Agent
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-generator' })
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    const kms = this.agent.kms

    const authenticationKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const assertionKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const keyAgreementKey = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })

    if (!authenticationKey.publicJwk.x || !assertionKey.publicJwk.x || !keyAgreementKey.publicJwk.x) {
      throw new Error('Invalid key material returned from KMS')
    }

    const didWebDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      id: didId,
      verificationMethod: [
        {
          id: `${didId}#auth-key`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: authenticationKey.publicJwk,
        },
        {
          id: `${didId}#assertion-key`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: assertionKey.publicJwk,
        },
        {
          id: `${didId}#agreement-key`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: keyAgreementKey.publicJwk,
        },
      ],
      authentication: [`${didId}#auth-key`],
      assertionMethod: [`${didId}#assertion-key`],
      keyAgreement: [`${didId}#agreement-key`],
      capabilityInvocation: [`${didId}#auth-key`],
      service: [
        {
          id: `${didId}#did-communication`,
          type: 'did-communication',
          priority: 0,
          recipientKeys: [`${didId}#auth-key`],
          routingKeys: [],
          serviceEndpoint: serviceEndpoint,
        },
      ],
    }

    this.logger.info(`Successfully generated DID:web document for ${didId}`)

    return {
      did: didId,
      didDocument: JsonTransformer.fromJSON(didWebDocument, DidDocument),
      keys: [
        {
          didDocumentRelativeKeyId: '#auth-key',
          kmsKeyId: authenticationKey.keyId,
        },
        {
          didDocumentRelativeKeyId: '#assertion-key',
          kmsKeyId: assertionKey.keyId,
        },
        {
          didDocumentRelativeKeyId: '#agreement-key',
          kmsKeyId: keyAgreementKey.keyId,
        },
      ],
    }
  }

  /**
   * Main method to generate and register did:web
   */
  async generateAndRegister(
    didWebDomain: string,
    serviceEndpoint: string,
    didGenerationEnabled: boolean,
    uploadDidToServer: (document: DidDocument) => Promise<void>
  ): Promise<DidWebGenerationResult | void> {
    if (!didGenerationEnabled) {
      this.logger.debug('DID:web generation is disabled')
      return
    }
    if (!didWebDomain) {
      throw new Error('DID_WEB_DOMAIN environment variable is required')
    }
    if (!serviceEndpoint) {
      throw new Error('DID_WEB_SERVICE_ENDPOINT environment variable is required')
    }
    const did = `did:web:${didWebDomain}`
    const alreadyImported = await this.isDidWebAlreadyImported(did)
    if (alreadyImported) {
      this.logger.info(`DID:web ${did} already exists in agent, skipping generation`)
      return
    }
    this.logger.info(`${did} not found in agent, generating new document`)

    try {
      const generated = await this.generateDidWebDocument(did, serviceEndpoint)
      await uploadDidToServer(generated.didDocument)

      // Import the DID Document. Keys are already in the wallet, so we don't need to pass privateKeys.
      await this.agent.dids.import({
        did: generated.did,
        didDocument: generated.didDocument,
        keys: generated.keys,
        overwrite: true,
      })
      this.logger.info(`Successfully registered DID:web ${generated.did} with agent`)
    } catch (error) {
      this.logger.error(error, 'Failed to generate and register DID:web')
      throw error
    }
  }

  /**
   * Checks if a DID:web document already exists in the agent
   */
  public async isDidWebAlreadyImported(did: string): Promise<boolean> {
    this.logger.info(`Checking if ${did} is already imported in agent`)

    const importedDids = await this.agent.dids.getCreatedDids({ did })
    return importedDids.length > 0
  }
}
