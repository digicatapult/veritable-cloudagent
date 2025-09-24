import { Agent, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import fs from 'fs/promises'
import { JWK } from 'ts-jose'
import { Env } from '../env.js'
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
  private env: Env
  private logger: PinoLogger

  constructor(agent: Agent, env: Env, logger: PinoLogger) {
    this.agent = agent
    this.env = env
    this.logger = logger
  }

  /**
   * Validates if a DID ID follows the did:web specification
   */
  private validateDidWebId(didId: string): boolean {
    // did:web format: did:web:domain
    const didWebRegex = /^did:web:[a-zA-Z0-9.-]+(?::[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%]+)?$/
    return didWebRegex.test(didId)
  }
  /**
   * Validates if a service endpoint is a valid localhost URL with optional percent-encoded port
   */
  private validateServiceEndpoint(endpoint: string): boolean {
    // Allow http(s)://localhost or http(s)://localhost%3Aport
    const regex = /^https?:\/\/localhost(%3A\d+)?(\/.*)?$/
    // Disallow raw colon in localhost:port
    if (/^https?:\/\/localhost:\d+/.test(endpoint)) return false
    return regex.test(endpoint)
  }

  /**
   * Generates a DID:web document with cryptographic material
   */
  async generateDidWebDocument(): Promise<DidWebGenerationResult> {
    const didId = this.env.get('DID_WEB_ID')
    const serviceEndpoint = this.env.get('DID_WEB_SERVICE_ENDPOINT')

    // Validate inputs
    if (!didId) {
      throw new Error('DID_WEB_ID environment variable is required')
    }
    if (!serviceEndpoint) {
      throw new Error('DID_WEB_SERVICE_ENDPOINT environment variable is required')
    }

    if (!this.validateDidWebId(didId)) {
      throw new Error(`Invalid DID:web ID format: ${didId}`)
    }
    if (!this.validateServiceEndpoint(serviceEndpoint)) {
      throw new Error(`Invalid service endpoint format: ${serviceEndpoint}`)
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
      const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
      await fs.writeFile(didFilePath, JSON.stringify(didWebDocument, null, 2), 'utf-8')
      this.logger.info(`DID:web document saved to ${didFilePath}`)
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error('Failed to save DID:web document locally:', err)
      } else if (err !== null) {
        this.logger.error('Failed to save DID:web document locally:', err)
      }

      throw new Error('Failed to save DID:web document locally')
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
      if (error instanceof Error) {
        this.logger.error(`Failed to register DID:web ${result.did}:`, error)
      } else if (error !== null) {
        this.logger.error(`Failed to register DID:web ${result.did}:`, error)
      }
      throw new Error('Failed to register DID:web')
    }
  }

  /**
   * Main method to generate and register DID:web if enabled and not already exists
   */
  async generateAndRegisterIfNeeded(): Promise<void> {
    const isEnabled = this.env.get('ENABLE_DID_WEB_GENERATION')

    if (!isEnabled) {
      this.logger.debug('DID:web generation is disabled')
      return
    }

    const didId = this.env.get('DID_WEB_ID')
    if (!didId) {
      this.logger.warn('DID:web generation is enabled but DID_WEB_ID is not set')
      return
    }

    // Check if DID:web already exists
    const exists = await this.doesDidWebExist(didId)
    if (exists) {
      this.logger.info(`DID:web ${didId} already exists, skipping generation`)
      return
    }

    try {
      const result = await this.generateDidWebDocument()

      // Import did to the agent
      await this.importDidWeb(result)

      this.logger.info(`DID:web document generated and registered successfully: ${didId}`)
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to generate and register DID:web:', error)
      } else if (error !== null) {
        this.logger.error('Failed to generate and register DID:web:', error)
      }
      throw new Error('Failed to generate and register DID:web')
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
