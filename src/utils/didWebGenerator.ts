import {
  Agent,
  DidCommV1Service,
  DidDocument,
  DidDocumentBuilder,
  Ed25519Signature2020,
  JsonTransformer,
  Kms,
  SECURITY_X25519_CONTEXT_URL,
  getEd25519VerificationKey2020,
  getX25519KeyAgreementKey2019,
  parseDid,
  type DidDocumentKey,
} from '@credo-ts/core'
import { Logger } from 'pino'

export interface DidWebGenerationResult {
  did: string
  didDocument: DidDocument
  keys: DidDocumentKey[]
}

export class DidWebDocGenerator {
  private agent: Agent
  private logger: Logger

  constructor(agent: Agent, logger: Logger) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-generator' })
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    let parsedDid: ReturnType<typeof parseDid> // Wrap CredoError type
    try {
      parsedDid = parseDid(didId)
    } catch (error) {
      throw new Error(`Invalid DID identifier '${didId}'`, { cause: error })
    }

    if (parsedDid.method !== 'web' || parsedDid.did !== didId) {
      throw new Error(`Expected a did:web identifier, received '${didId}'`)
    }

    const authenticationKeyFragment = '#auth-key'
    const assertionKeyFragment = '#assertion-key'
    const keyAgreementKeyFragment = '#agreement-key'
    const authenticationKeyId = `${didId}${authenticationKeyFragment}`
    const assertionKeyId = `${didId}${assertionKeyFragment}`
    const keyAgreementKeyId = `${didId}${keyAgreementKeyFragment}`
    const didCommServiceId = `${didId}#did-communication`
    const kms = this.agent.kms

    const authenticationKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const assertionKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const keyAgreementKey = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })

    const authenticationPublicJwk = Kms.PublicJwk.fromPublicJwk(authenticationKey.publicJwk)
    const assertionPublicJwk = Kms.PublicJwk.fromPublicJwk(assertionKey.publicJwk)
    const keyAgreementPublicJwk = Kms.PublicJwk.fromPublicJwk(keyAgreementKey.publicJwk)

    const authenticationVerificationMethod = getEd25519VerificationKey2020({
      id: authenticationKeyId,
      publicJwk: authenticationPublicJwk,
      controller: didId,
    })

    const assertionVerificationMethod = getEd25519VerificationKey2020({
      id: assertionKeyId,
      publicJwk: assertionPublicJwk,
      controller: didId,
    })

    const keyAgreementVerificationMethod = getX25519KeyAgreementKey2019({
      id: keyAgreementKeyId,
      publicJwk: keyAgreementPublicJwk,
      controller: didId,
    })

    const didWebDocument = new DidDocumentBuilder(didId)
      .addContext(Ed25519Signature2020.CONTEXT_URL)
      .addContext(SECURITY_X25519_CONTEXT_URL)
      .addVerificationMethod(authenticationVerificationMethod)
      .addVerificationMethod(assertionVerificationMethod)
      .addVerificationMethod(keyAgreementVerificationMethod)
      .addAuthentication(authenticationKeyId)
      .addAssertionMethod(assertionKeyId)
      .addKeyAgreement(keyAgreementKeyId)
      .addCapabilityInvocation(authenticationKeyId)
      .addService(
        new DidCommV1Service({
          id: didCommServiceId,
          recipientKeys: [authenticationKeyId],
          routingKeys: [],
          serviceEndpoint: serviceEndpoint,
        })
      )
      .build()
    const validatedDidWebDocument = JsonTransformer.fromJSON(didWebDocument.toJSON(), DidDocument)

    this.logger.info(`Successfully generated DID:web document for ${didId}`)

    return {
      did: didId,
      didDocument: validatedDidWebDocument,
      keys: [
        {
          didDocumentRelativeKeyId: authenticationKeyFragment,
          kmsKeyId: authenticationKey.keyId,
        },
        {
          didDocumentRelativeKeyId: assertionKeyFragment,
          kmsKeyId: assertionKey.keyId,
        },
        {
          didDocumentRelativeKeyId: keyAgreementKeyFragment,
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
