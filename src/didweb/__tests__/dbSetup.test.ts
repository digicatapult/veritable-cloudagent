import { expect } from 'chai'
import { Client } from 'pg'
import sinon from 'sinon'
import PinoLogger from '../../utils/logger.js'
import { DatabaseSetupConfig, ensureDatabaseExists } from '../dbSetup.js'

describe('Database Setup', () => {
  let logger: PinoLogger['logger']
  let mockClient: sinon.SinonStubbedInstance<Client>

  beforeEach(() => {
    logger = new PinoLogger('silent').logger

    // Create a stubbed pg Client
    mockClient = sinon.createStubInstance(Client)

    // Stub the Client constructor
    sinon.stub(Client.prototype, 'connect').callsFake(() => mockClient.connect())
    sinon.stub(Client.prototype, 'query').callsFake((...args) => mockClient.query(...args))
    sinon.stub(Client.prototype, 'end').callsFake(() => mockClient.end())
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('ensureDatabaseExists', () => {
    const validConfig: DatabaseSetupConfig = {
      host: 'localhost',
      user: 'postgres',
      password: 'postgres',
      port: 5432,
      targetDatabase: 'test-db',
    }

    it('should create database when it does not exist', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [] }) // Database doesn't exist
      mockClient.query.onSecondCall().resolves({ rows: [] }) // CREATE DATABASE query
      mockClient.end.resolves()

      await ensureDatabaseExists(validConfig, logger)

      expect(mockClient.connect.calledOnce).to.equal(true)
      expect(mockClient.query.calledTwice).to.equal(true)
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.query.firstCall.args[1]).to.deep.equal(['test-db'])
      expect(mockClient.query.secondCall.args[0]).to.equal('CREATE DATABASE "test-db"')
      expect(mockClient.end.calledOnce).to.equal(true)
    })

    it('should skip creation when database already exists', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [{ '?column?': 1 }] }) // Database exists
      mockClient.end.resolves()

      await ensureDatabaseExists(validConfig, logger)

      expect(mockClient.connect.calledOnce).to.equal(true)
      expect(mockClient.query.calledOnce).to.equal(true)
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.end.calledOnce).to.equal(true)
    })

    it('should handle database names with quotes correctly', async () => {
      const configWithQuotes: DatabaseSetupConfig = {
        ...validConfig,
        targetDatabase: 'test"db"name',
      }

      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [] })
      mockClient.query.onSecondCall().resolves({ rows: [] })
      mockClient.end.resolves()

      await ensureDatabaseExists(configWithQuotes, logger)

      expect(mockClient.query.secondCall.args[0]).to.equal('CREATE DATABASE "test""db""name"')
    })

    it('should throw error for invalid configuration - missing host', async () => {
      const invalidConfig = { ...validConfig, host: '' }

      try {
        await ensureDatabaseExists(invalidConfig, logger)
        expect.fail('Should have thrown error for invalid config')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.equal('Database host is required')
      }
    })

    it('should throw error for invalid configuration - invalid port', async () => {
      const invalidConfig = { ...validConfig, port: -1 }

      try {
        await ensureDatabaseExists(invalidConfig, logger)
        expect.fail('Should have thrown error for invalid port')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.contain('Invalid database port: -1')
      }
    })

    it('should throw error for invalid configuration - port too high', async () => {
      const invalidConfig = { ...validConfig, port: 70000 }

      try {
        await ensureDatabaseExists(invalidConfig, logger)
        expect.fail('Should have thrown error for invalid port')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.contain('Invalid database port: 70000')
      }
    })

    it('should handle connection errors gracefully', async () => {
      mockClient.connect.rejects(new Error('ECONNREFUSED'))
      mockClient.end.resolves()

      try {
        await ensureDatabaseExists(validConfig, logger)
        expect.fail('Should have thrown connection error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.equal('ECONNREFUSED')
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle authentication errors gracefully', async () => {
      mockClient.connect.resolves()
      mockClient.query.rejects(new Error('authentication failed for user'))
      mockClient.end.resolves()

      try {
        await ensureDatabaseExists(validConfig, logger)
        expect.fail('Should have thrown authentication error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.contain('authentication failed')
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle permission errors gracefully', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [] })
      mockClient.query.onSecondCall().rejects(new Error('permission denied to create database'))
      mockClient.end.resolves()

      try {
        await ensureDatabaseExists(validConfig, logger)
        expect.fail('Should have thrown permission error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.contain('permission denied')
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle end() errors gracefully', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [{ '?column?': 1 }] })
      mockClient.end.rejects(new Error('Connection already closed'))

      // Should not throw even if end() fails
      await ensureDatabaseExists(validConfig, logger)

      expect(mockClient.end.calledOnce).to.equal(true)
    })
  })
})
