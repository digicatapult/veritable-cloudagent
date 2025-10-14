import { Agent, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import { DIDDocument } from 'did-resolver'
import { Logger } from 'pino'
import { JWK } from 'ts-jose'

export interface DidWebGenerationResult {
  did: string
  didDocument: DIDDocument
  privateSigningKey: string
  privateEncryptionKey: string
  publicEncryptionKey: string
}

interface KeyPairResult {
  publicKeyJwk: {
    kty: string
    crv: KeyType.Ed25519 | KeyType.X25519
    x: string
  }
  privateKeyB64Url: string
}

export class DidWebDocGenerator {
  private agent: Agent
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-generator' })
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    const signingJwk = await JWK.generate('EdDSA', { crv: 'Ed25519', use: 'sig', kid: 'owner' })
    const encryptionJwk = await JWK.generate('ECDH-ES', { crv: 'X25519', use: 'enc', kid: 'owner' })

    const signingKeyPair = await this.extractKeyComponents(signingJwk)
    const encryptionKeyPair = await this.extractKeyComponents(encryptionJwk)

    // Assemble the DID:web document
    const didWebDocument: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      id: didId,
      verificationMethod: [
        {
          id: `${didId}#owner`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: signingKeyPair.publicKeyJwk,
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
          publicKeyJwk: encryptionKeyPair.publicKeyJwk,
        },
      ],
    }

    this.logger.info(`Successfully generated DID:web document for ${didId}`)

    return {
      did: didId,
      didDocument: didWebDocument,
      privateSigningKey: signingKeyPair.privateKeyB64Url,
      privateEncryptionKey: encryptionKeyPair.privateKeyB64Url,
      publicEncryptionKey: encryptionKeyPair.publicKeyJwk.x,
    }
  }

  async importDidWeb(result: DidWebGenerationResult): Promise<void> {
    try {
      await this.agent.dids.import({
        did: result.did,
        privateKeys: [
          {
            keyType: KeyType.Ed25519,
            privateKey: TypedArrayEncoder.fromBase64(result.privateSigningKey),
          },
          {
            keyType: KeyType.X25519,
            privateKey: TypedArrayEncoder.fromBase64(result.privateEncryptionKey),
          },
        ],
        overwrite: true,
      })
      this.logger.info(`Successfully registered DID:web ${result.did} with agent`)
    } catch (error) {
      this.logger.error(error, `Failed to register DID:web ${result.did}:`)
      throw error
    }
  }

  private async extractKeyComponents(jwk: JWK): Promise<KeyPairResult> {
    const publicJwk = (await jwk.toPublic()).toObject()
    const privateKeyB64Url = jwk.toObject(true).d!

    if (!publicJwk.x) {
      throw new Error(`JWK public key is missing required property for ${publicJwk.kty}`)
    }

    return {
      publicKeyJwk: {
        kty: publicJwk.kty,
        crv: publicJwk.crv as KeyType.Ed25519 | KeyType.X25519,
        x: publicJwk.x,
      },
      privateKeyB64Url,
    }
  }

  /**
   * Main method to generate and register did:web
   */
  async generateAndRegister(
    didWebDomain: string,
    serviceEndpoint: string,
    didGenerationEnabled: boolean,
    uploadDidToServer: (document: DIDDocument) => Promise<void>
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
      await this.importDidWeb(generated)
    } catch (error) {
      this.logger.error(error, 'Failed to generate and register DID:web:')
      throw error
    }
  }

  /**
   * Checks if a DID:web document already exists in the agent
   */
  public async isDidWebAlreadyImported(did: string): Promise<boolean> {
    this.logger.info(`Checking if ${did} is already imported in agent`)

    const importedDids = await this.agent.dids.getCreatedDids()
    return importedDids.some((d) => d.did === did)
  }
}
