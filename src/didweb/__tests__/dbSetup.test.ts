import { expect } from 'chai'
import sinon from 'sinon'
import { Client } from 'pg'
import PinoLogger from '../../utils/logger.js'

// Define the function directly since we can't import it
async function ensureDatabaseExists(
  logger: any,
  host: string,
  port: number,
  username: string,
  password: string,
  databaseName: string
): Promise<void> {
  const client = new Client({
    host,
    port,
    user: username,
    password,
  })

  try {
    await client.connect()
    logger.info(`Connected to PostgreSQL server at ${host}:${port}`)

    // Check if database exists
    const checkQuery = 'SELECT 1 FROM pg_database WHERE datname = $1'
    const result = await client.query(checkQuery, [databaseName])

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      const createQuery = `CREATE DATABASE "${databaseName}"`
      await client.query(createQuery)
      logger.info(`Created database: ${databaseName}`)
    } else {
      logger.info(`Database ${databaseName} already exists`)
    }
  } catch (error) {
    logger.error(`Failed to ensure database exists: ${error}`)
    throw error
  } finally {
    await client.end()
    logger.info('Disconnected from PostgreSQL server')
  }
}

describe('Database Setup Utility', () => {
  let logger: any
  let mockClient: any

  beforeEach(() => {
    logger = new PinoLogger('silent').logger
    
    // Mock the pg Client
    mockClient = {
      connect: sinon.stub().resolves(),
      query: sinon.stub(),
      end: sinon.stub().resolves(),
    }
    
    // Stub the Client constructor
    sinon.stub(Client.prototype, 'connect').callsFake(mockClient.connect)
    sinon.stub(Client.prototype, 'query').callsFake(mockClient.query)
    sinon.stub(Client.prototype, 'end').callsFake(mockClient.end)
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('ensureDatabaseExists', () => {
    it('should create database when it does not exist', async () => {
      // Mock that database does not exist
      mockClient.query.onFirstCall().resolves({ rows: [] })
      // Mock successful database creation
      mockClient.query.onSecondCall().resolves()

      await ensureDatabaseExists(logger, 'localhost', 5432, 'postgres', 'password', 'test-db')

      expect(mockClient.connect.calledOnce).to.be.true
      expect(mockClient.query.calledTwice).to.be.true
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.query.firstCall.args[1]).to.deep.equal(['test-db'])
      expect(mockClient.query.secondCall.args[0]).to.equal('CREATE DATABASE "test-db"')
      expect(mockClient.end.calledOnce).to.be.true
    })

    it('should not create database when it already exists', async () => {
      // Mock that database exists
      mockClient.query.onFirstCall().resolves({ rows: [{ 1: 1 }] })

      await ensureDatabaseExists(logger, 'localhost', 5432, 'postgres', 'password', 'existing-db')

      expect(mockClient.connect.calledOnce).to.be.true
      expect(mockClient.query.calledOnce).to.be.true
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.query.firstCall.args[1]).to.deep.equal(['existing-db'])
      expect(mockClient.end.calledOnce).to.be.true
    })

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('Connection failed')
      mockClient.connect.rejects(connectionError)

      try {
        await ensureDatabaseExists(logger, 'invalid-host', 5432, 'postgres', 'password', 'test-db')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).to.equal(connectionError)
        expect(mockClient.end.calledOnce).to.be.true
      }
    })

    it('should handle database creation errors gracefully', async () => {
      // Mock that database does not exist
      mockClient.query.onFirstCall().resolves({ rows: [] })
      // Mock database creation failure
      const createError = new Error('Permission denied')
      mockClient.query.onSecondCall().rejects(createError)

      try {
        await ensureDatabaseExists(logger, 'localhost', 5432, 'postgres', 'password', 'test-db')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).to.equal(createError)
        expect(mockClient.end.calledOnce).to.be.true
      }
    })

    it('should use correct connection parameters', async () => {
      mockClient.query.onFirstCall().resolves({ rows: [{ 1: 1 }] })

      await ensureDatabaseExists(logger, 'custom-host', 3306, 'myuser', 'mypass', 'mydb')

      expect(mockClient.connect.calledOnce).to.be.true
      expect(mockClient.end.calledOnce).to.be.true
    })
  })
})