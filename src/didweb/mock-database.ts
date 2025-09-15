import type PinoLogger from '../utils/logger.js'

import { DidDocumentRecord } from './database.js'

/**
 * Mock database implementation for testing
 */
export class MockDidWebDatabase {
  private storage: Map<string, DidDocumentRecord> = new Map()
  private logger: PinoLogger

  constructor(logger: PinoLogger) {
    this.logger = logger.child({ component: 'mock-did-web-database' })
  }

  async init(): Promise<void> {
    this.logger.info('Mock DID documents storage initialized')
  }

  async storeDidDocument(did: string, didDocument: Record<string, unknown>): Promise<void> {
    const now = new Date()
    const record: DidDocumentRecord = {
      did,
      didDocument,
      createdAt: this.storage.has(did) ? this.storage.get(did)!.createdAt : now,
      updatedAt: now,
    }
    
    this.storage.set(did, record)
    this.logger.debug(`Mock stored DID document for: ${did}`)
  }

  async getDidDocument(did: string): Promise<DidDocumentRecord | null> {
    const record = this.storage.get(did)
    return record || null
  }

  async listDidDocuments(): Promise<string[]> {
    return Array.from(this.storage.keys())
  }

  async deleteDidDocument(did: string): Promise<boolean> {
    const existed = this.storage.has(did)
    this.storage.delete(did)
    if (existed) {
      this.logger.debug(`Mock deleted DID document for: ${did}`)
    }
    return existed
  }

  async close(): Promise<void> {
    this.storage.clear()
    this.logger.info('Mock database connection closed')
  }
}