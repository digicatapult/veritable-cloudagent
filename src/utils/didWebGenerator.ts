import { Agent, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import { Logger } from 'pino'
import { JWK } from 'ts-jose'

// Following the format we used for testing in the past
export interface DidWebDocument {
  '@context': string[]
  id: string
  verificationMethod: Array<{
    id: string
    type: string
    controller: string
    publicKeyJwk: {
      kty: string
      crv: KeyType.Ed25519
      x: string
    }
  }>
  authentication: string[]
  assertionMethod: string[]
  service: Array<{
    id: string
    type: string
    priority: number
    recipientKeys: string[]
    routingKeys: string[]
    serviceEndpoint: string
  }>
}

export interface DidWebGenerationResult {
  did: string
  didDocument: DidWebDocument
  privateKey: string
}

export class DidWebDocGenerator {
  private agent: Agent
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-generator' })
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    const key = await JWK.generate('EdDSA', { crv: 'Ed25519', use: 'sig', kid: 'owner' })

    const publicJwk = (await key.toPublic()).toObject() // { kty:'OKP', crv:'Ed25519', x:'...' }
    const privateJwk = key.toObject(true) // same as above + d

    // Will need the private key BYTES for import
    const privateKeyB64Url = privateJwk.d!
    if (!publicJwk.crv || !publicJwk.kty || !publicJwk.x) {
      throw new Error('JWK public key is missing required property or crv is not Ed25519')
    }
    const publicKeyJwk = {
      kty: publicJwk.kty,
      crv: publicJwk.crv as KeyType.Ed25519,
      x: publicJwk.x,
    }

    // Assemble the DID:web document
    const didWebDocument: DidWebDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      id: didId,
      verificationMethod: [
        {
          id: `${didId}#owner`,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk,
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
    }

    this.logger.info(`Successfully generated DID:web document for ${didId}`)

    return {
      did: didId,
      didDocument: didWebDocument,
      privateKey: privateKeyB64Url,
    }
  }

  async importDidWeb(result: DidWebGenerationResult): Promise<void> {
    try {
      await this.agent.dids.import({
        did: result.did,
        privateKeys: [
          {
            keyType: KeyType.Ed25519,
            privateKey: TypedArrayEncoder.fromBase64(result.privateKey),
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

  /**
   * Main method to generate and register did:web
   */
  async generateAndRegister(
    didWebDomain: string,
    serviceEndpoint: string,
    didGenerationEnabled: boolean,
    uploadDidToServer: (document: DidWebDocument) => Promise<void>
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
    const resolve = await this.agent.dids.resolve(did)

    return !!resolve.didDocument
  }
}
