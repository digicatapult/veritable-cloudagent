import { Agent, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import fs from 'fs/promises'
import { JWK } from 'ts-jose'
import PinoLogger from './logger.js'

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
  private logger: PinoLogger

  constructor(agent: Agent, logger: PinoLogger) {
    this.agent = agent
    this.logger = logger
  }

  private validateDidWebId(didId: string): boolean {
    // did:web format: did:web:domain
    const didWebRegex = /^did:web:.*$/
    return didWebRegex.test(didId)
  }

  async generateDidWebDocument(didId: string, serviceEndpoint: string): Promise<DidWebGenerationResult> {
    if (!this.validateDidWebId(didId)) {
      throw new Error(`Invalid DID:web ID format: ${didId}`)
    }

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

    // Store the DID document as a JSON file in /public/dids
    try {
      const didFileName = didId.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
      const didDirPath = `${process.cwd()}/public/dids`
      const didFilePath = `${didDirPath}/${didFileName}`
      await fs.mkdir(didDirPath, { recursive: true })
      await fs.writeFile(didFilePath, JSON.stringify(didWebDocument, null, 2), 'utf-8')
      this.logger.info(`DID:web document saved to ${didFilePath}`)
    } catch (err) {
      if (err) {
        this.logger.error('Failed to save DID:web document locally:', err)
      }
      throw err
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
      if (error) {
        this.logger.error(`Failed to register DID:web ${result.did}:`, error)
      }
      throw error
    }
  }

  /**
   * Main method to generate and register DID:web if enabled and not already exists
   */
  async generateAndRegisterIfNeeded(
    didId: string,
    serviceEndpoint: string,
    didGenerationEnabled: boolean
  ): Promise<void> {
    if (didGenerationEnabled == false) {
      this.logger.debug('DID:web generation is disabled')
      return
    }
    if (!didId) {
      throw new Error('DID_WEB_ID environment variable is required')
    }
    if (!serviceEndpoint) {
      throw new Error('DID_WEB_SERVICE_ENDPOINT environment variable is required')
    }

    if (!this.validateDidWebId(didId)) {
      throw new Error(`Invalid DID:web ID format: ${didId}`)
    }

    // Check if DID:web already exists
    const exists = await this.doesDidWebExist(didId)
    if (exists) {
      this.logger.info(`DID:web ${didId} already exists, skipping generation`)
      return
    }

    try {
      const result = await this.generateDidWebDocument(didId, serviceEndpoint)

      // Import did to the agent
      await this.importDidWeb(result)

      this.logger.info(`DID:web document generated and registered successfully: ${didId}`)
    } catch (error) {
      if (error) {
        this.logger.error('Failed to generate and register DID:web:', error)
      }
      throw error
    }
  }
  /**
   * Checks if a DID:web document already exists in the public/dids directory
   */
  private async doesDidWebExist(didId: string): Promise<boolean> {
    const didFileName = didId.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
    const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
    try {
      await fs.access(didFilePath)
      return true
    } catch {
      return false
    }
  }
}
