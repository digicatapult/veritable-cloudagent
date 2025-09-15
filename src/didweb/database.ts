import type PinoLogger from '../utils/logger.js'

import { Pool, type PoolConfig } from 'pg'

export interface DatabaseConfig {
  host: string
  port: number
  username: string
  password: string
  database?: string
}

export interface DidDocumentRecord {
  did: string
  didDocument: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export class DidWebDatabase {
  private pool: Pool
  private logger: PinoLogger

  constructor(config: DatabaseConfig, logger: PinoLogger) {
    this.logger = logger.child({ component: 'did-web-database' })
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database || 'postgres-veritable-cloudagent',
      max: 10,
      idleTimeoutMillis: 30000,
    }
    
    this.pool = new Pool(poolConfig)
    this.pool.on('error', (err) => {
      this.logger.error(`Database pool error: ${err}`)
    })
  }

  async init(): Promise<void> {
    try {
      await this.createTable()
      this.logger.info('DID documents table initialized')
    } catch (error) {
      this.logger.error(`Failed to initialize database: ${error}`)
      throw error
    }
  }

  private async createTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS did_documents (
        did TEXT PRIMARY KEY,
        did_document JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_did_documents_created_at ON did_documents(created_at);
    `
    
    await this.pool.query(createTableQuery)
  }

  async storeDidDocument(did: string, didDocument: Record<string, unknown>): Promise<void> {
    const query = `
      INSERT INTO did_documents (did, did_document, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (did) 
      DO UPDATE SET did_document = $2, updated_at = CURRENT_TIMESTAMP
    `
    
    try {
      await this.pool.query(query, [did, JSON.stringify(didDocument)])
      this.logger.debug(`Stored DID document for: ${did}`)
    } catch (error) {
      this.logger.error(`Failed to store DID document for ${did}: ${error}`)
      throw error
    }
  }

  async getDidDocument(did: string): Promise<DidDocumentRecord | null> {
    const query = 'SELECT did, did_document, created_at, updated_at FROM did_documents WHERE did = $1'
    
    try {
      const result = await this.pool.query(query, [did])
      if (result.rows.length === 0) {
        return null
      }
      
      const row = result.rows[0]
      return {
        did: row.did,
        didDocument: row.did_document,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    } catch (error) {
      this.logger.error(`Failed to get DID document for ${did}: ${error}`)
      throw error
    }
  }

  async listDidDocuments(): Promise<string[]> {
    const query = 'SELECT did FROM did_documents ORDER BY created_at DESC'
    
    try {
      const result = await this.pool.query(query)
      return result.rows.map(row => row.did)
    } catch (error) {
      this.logger.error(`Failed to list DID documents: ${error}`)
      throw error
    }
  }

  async deleteDidDocument(did: string): Promise<boolean> {
    const query = 'DELETE FROM did_documents WHERE did = $1'
    
    try {
      const result = await this.pool.query(query, [did])
      const deleted = result.rowCount !== null && result.rowCount > 0
      if (deleted) {
        this.logger.debug(`Deleted DID document for: ${did}`)
      }
      return deleted
    } catch (error) {
      this.logger.error(`Failed to delete DID document for ${did}: ${error}`)
      throw error
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
    this.logger.info('Database connection pool closed')
  }
}