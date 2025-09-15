import type { RestAgent } from '../agent.js'
import type PinoLogger from '../utils/logger.js'

import { KeyType, TypedArrayEncoder } from '@credo-ts/core'
import { container } from 'tsyringe'

import { Env } from '../env.js'
import { DatabaseConfig, DidWebDatabase } from './database.js'
import { MockDidWebDatabase } from './mock-database.js'

export interface StoredDidDocument {
  did: string
  didDocument: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export class DidWebService {
  private agent: RestAgent
  private logger: PinoLogger
  private database: DidWebDatabase | MockDidWebDatabase

  constructor(agent: RestAgent, logger: PinoLogger, databaseConfig?: DatabaseConfig, useMockDatabase?: boolean) {
    this.agent = agent
    this.logger = logger.child({ component: 'did-web-service' })
    
    if (useMockDatabase) {
      this.database = new MockDidWebDatabase(this.logger)
    } else {
      // If no database config provided, get it from environment
      if (!databaseConfig) {
        const env = container.resolve(Env)
        databaseConfig = {
          host: env.get('POSTGRES_HOST'),
          port: parseInt(env.get('POSTGRES_PORT'), 10),
          username: env.get('POSTGRES_USERNAME'),
          password: env.get('POSTGRES_PASSWORD'),
          database: 'postgres-veritable-cloudagent',
        }
      }
      
      this.database = new DidWebDatabase(databaseConfig, this.logger)
    }
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    await this.database.init()
  }

  /**
   * Ensures a DID document exists for the given DID. If it doesn't exist,
   * creates one with generated keys.
   */
  async ensureDidExists(didId: string): Promise<void> {
    if (!didId) {
      throw new Error('DID ID is required')
    }

    try {
      // Check if DID already exists in storage
      const existingDoc = await this.getDidDocument(didId)
      if (existingDoc) {
        this.logger.info(`DID document already exists for: ${didId}`)
        return
      }

      this.logger.info(`Creating DID document for: ${didId}`)
      await this.createAndStoreDidDocument(didId)
    } catch (error) {
      this.logger.error(`Error ensuring DID exists: ${error}`)
      throw error
    }
  }

  /**
   * Retrieves a DID document by DID identifier
   */
  async getDidDocument(didId: string): Promise<Record<string, unknown> | null> {
    try {
      const record = await this.database.getDidDocument(didId)
      if (record) {
        this.logger.debug(`Retrieved DID document from database for: ${didId}`)
        return record.didDocument
      }

      this.logger.debug(`DID document not found for: ${didId}`)
      return null
    } catch (error) {
      this.logger.error(`Error retrieving DID document: ${error}`)
      throw error
    }
  }

  /**
   * Stores or updates a DID document
   */
  async storeDidDocument(didId: string, didDocument: Record<string, unknown>): Promise<void> {
    try {
      await this.database.storeDidDocument(didId, didDocument)
      this.logger.info(`Stored DID document for: ${didId}`)
    } catch (error) {
      this.logger.error(`Error storing DID document: ${error}`)
      throw error
    }
  }

  /**
   * Creates a new DID document with generated keys and imports it into the agent
   */
  private async createAndStoreDidDocument(didId: string): Promise<void> {
    try {
      // Create a did:key first to generate keys, then convert to did:web
      const { didState } = await this.agent.dids.create({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519
        }
      })

      if (didState.state !== 'finished' || !didState.didDocument) {
        throw new Error('Failed to create DID')
      }

      // Extract the public key from the created DID document
      const verificationMethod = didState.didDocument.verificationMethod?.[0]
      if (!verificationMethod) {
        throw new Error('No verification method found in created DID')
      }

      // Get the public key in JWK format
      let publicKeyJwk: any
      if ('publicKeyBase58' in verificationMethod && verificationMethod.publicKeyBase58) {
        // Convert base58 to base64url for JWK format
        const publicKeyBytes = TypedArrayEncoder.fromBase58(verificationMethod.publicKeyBase58)
        const publicKeyBase64 = TypedArrayEncoder.toBase64URL(publicKeyBytes)
        publicKeyJwk = {
          kty: 'OKP',
          crv: 'Ed25519',
          x: publicKeyBase64
        }
      } else if ('publicKeyJwk' in verificationMethod && verificationMethod.publicKeyJwk) {
        publicKeyJwk = verificationMethod.publicKeyJwk
      } else {
        throw new Error('Unsupported public key format')
      }

      // Create the DID document based on the did:web format
      const didDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/jws-2020/v1'
        ],
        id: didId,
        verificationMethod: [
          {
            id: `${didId}#owner`,
            type: 'JsonWebKey2020',
            controller: didId,
            publicKeyJwk
          }
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
            serviceEndpoint: this.agent.config.endpoints[0] || 'http://localhost:5002'
          }
        ]
      }

      // Store the DID document for serving
      await this.storeDidDocument(didId, didDocument)

      this.logger.info(`Created and stored DID document for: ${didId}`)
    } catch (error) {
      this.logger.error(`Error creating DID document: ${error}`)
      throw error
    }
  }

  /**
   * Lists all stored DID documents
   */
  async listDidDocuments(): Promise<string[]> {
    return await this.database.listDidDocuments()
  }

  /**
   * Deletes a DID document
   */
  async deleteDidDocument(didId: string): Promise<boolean> {
    try {
      const deleted = await this.database.deleteDidDocument(didId)
      
      if (deleted) {
        this.logger.info(`Deleted DID document for: ${didId}`)
      }
      
      return deleted
    } catch (error) {
      this.logger.error(`Error deleting DID document: ${error}`)
      throw error
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.database.close()
  }
}