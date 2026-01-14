import { Agent, DidDocument, getJwkFromKey, JsonTransformer, KeyType } from '@credo-ts/core'
import { Logger } from 'pino'

export interface DidWebGenerationResult {
  did: string
  didDocument: DidDocument
  publicEncryptionKey: string
}

export class DidWebDocGenerator {
  private agent: Agent
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-generator' })
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    // Generate keys directly in the wallet
    const signingKey = await this.agent.wallet.createKey({ keyType: KeyType.Ed25519 })
    const encryptionKey = await this.agent.wallet.createKey({ keyType: KeyType.X25519 })

    const signingKeyJwk = getJwkFromKey(signingKey)
    const encryptionKeyJwk = getJwkFromKey(encryptionKey)

    // Assemble the DID:web document
    // This is a plain object that will be transformed and hydrated within credo-ts
    const didWebDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      id: didId,
      verificationMethod: [
        {
          id: `${didId}#owner`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: { ...signingKeyJwk.toJson(), kid: 'owner' },
        },
      ],
      authentication: [`${didId}#owner`],
      assertionMethod: [`${didId}#owner`],
      service: [
        {
          id: `${didId}#did-communication`,
          type: 'did-communication',
          priority: 0,
          recipientKeys: [`${didId}#owner`],
          routingKeys: [],
          serviceEndpoint: serviceEndpoint,
        },
      ],
      keyAgreement: [
        {
          id: `${didId}#encryption`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: { ...encryptionKeyJwk.toJson(), kid: 'encryption' },
        },
      ],
    }

    this.logger.info(`Successfully generated DID:web document for ${didId}`)

    if (!encryptionKeyJwk.x) {
      throw new Error('Generated X25519 encryption key is missing required "x" property')
    }

    return {
      did: didId,
      didDocument: JsonTransformer.fromJSON(didWebDocument, DidDocument),
      publicEncryptionKey: encryptionKeyJwk.x,
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
