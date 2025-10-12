import { type Agent } from '@credo-ts/core'
import { expect } from 'chai'
import { Client } from 'pg'
import sinon from 'sinon'
import { container } from 'tsyringe'
import { DidWebDocument } from '../../utils/didWebGenerator.js'
import PinoLogger from '../../utils/logger.js'
import Database from '../db.js'
import { DidWebServer } from '../server.js'

interface DidWebServerTestInterface {
  db?: Database
  initialiseDatabase(): Promise<void>
}

// Helper function to create a type-safe mock Database with Sinon stubs
function createMockDatabase(): Database & { upsert: sinon.SinonStub; get: sinon.SinonStub } {
  const mockDatabase = {
    upsert: sinon.stub().resolves(),
    get: sinon.stub().resolves([]),
  }
  return mockDatabase as unknown as Database & { upsert: sinon.SinonStub; get: sinon.SinonStub }
}

const didWebDomain = 'localhost%3A8443' // Default from env.ts devDefault
const did = {
  id: `did:web:${didWebDomain}`,
} as DidWebDocument
const logger = new PinoLogger('silent').logger

describe('DidWebServer', () => {
  let server: DidWebServer
  let mockDatabase: Database & { upsert: sinon.SinonStub; get: sinon.SinonStub }

  beforeEach(() => {
    // Create a mock database instance
    mockDatabase = createMockDatabase()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with environment-based configuration', () => {
      server = new DidWebServer(logger)
      expect(server).to.be.instanceOf(DidWebServer)
    })
  })

  describe('setDidGenerator', () => {
    beforeEach(() => {
      server = new DidWebServer(logger)
    })

    it('should set DID generator function', () => {
      const mockGenerator = sinon.stub().resolves(did)
      server.setDidGenerator(mockGenerator)
      expect(mockGenerator.called).to.equal(false)
    })
  })

  describe('reqPath to DID', () => {
    beforeEach(() => {
      server = new DidWebServer(logger)
    })

    it('should convert /.well-known/did.json to correct DID', () => {
      const result = server.reqPathToDid('/.well-known/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}`)
    })

    it('should convert /did.json to correct DID', () => {
      const result = server.reqPathToDid('/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}`)
    })

    it('should convert nested path to correct DID', () => {
      const result = server.reqPathToDid('/path/to/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}:path:to`)
    })

    it('should throw error for invalid path', () => {
      expect(() => server.reqPathToDid('/invalid/path')).to.throw('Invalid DID URL path: /invalid/path')
    })
  })

  describe('upsertDid', () => {
    beforeEach(() => {
      server = new DidWebServer(logger)
      // Manually set the database for testing - cast to test interface for type safety
      ;(server as unknown as DidWebServerTestInterface).db = mockDatabase
    })

    it('should successfully upload DID document', async () => {
      await server.upsertDid(did)
      expect(mockDatabase.upsert.calledOnceWith('did_web', { did: did.id, document: did }, 'did')).to.equal(true)
    })

    it('should throw error when database not initialized', async () => {
      // Create a new server without setting the database
      const serverWithoutDb = new DidWebServer(logger)
      try {
        await serverWithoutDb.upsertDid(did)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect((error as Error).message).to.equal('Database not initialized')
      }
    })
  })

  describe('createAndStart static factory', () => {
    let startSpy: sinon.SinonSpy

    beforeEach(() => {
      // Spy on the start method
      startSpy = sinon.stub(DidWebServer.prototype, 'start').resolves()
    })

    it('should create and start server without agent', async () => {
      const server = await DidWebServer.createAndStart(logger)

      expect(server).to.be.instanceOf(DidWebServer)
      expect(startSpy.calledOnce).to.equal(true)
    })

    it('should create and start server with agent', async () => {
      // Create a minimal mock agent that satisfies the type requirements
      const mockAgent = {} as unknown as Agent

      const server = await DidWebServer.createAndStart(logger, mockAgent)

      expect(server).to.be.instanceOf(DidWebServer)
      expect(startSpy.calledOnce).to.equal(true)
    })
  })
})

describe('Database Setup', () => {
  let server: DidWebServer
  let mockClient: sinon.SinonStubbedInstance<Client>

  beforeEach(() => {
    // Create a stubbed pg Client
    mockClient = sinon.createStubInstance(Client)

    // Stub the Client constructor and prototype methods to avoid real database connections
    sinon.stub(Client.prototype, 'connect').callsFake(() => mockClient.connect())
    sinon.stub(Client.prototype, 'query').callsFake((...args) => mockClient.query(...args))
    sinon.stub(Client.prototype, 'end').callsFake(() => mockClient.end())

    server = new DidWebServer(logger)
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('PostgreSQL storage', () => {
    beforeEach(() => {
      // The test environment already has STORAGE_TYPE=postgres set
    })

    it('should create database when it does not exist', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [] }) // Database doesn't exist
      mockClient.query.onSecondCall().resolves({ rows: [] }) // CREATE DATABASE query
      mockClient.end.resolves()

      // Call the private method through type-safe interface
      await (server as unknown as DidWebServerTestInterface).initialiseDatabase()

      expect(mockClient.connect.calledOnce).to.equal(true)
      expect(mockClient.query.calledTwice).to.equal(true)
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.query.firstCall.args[1]).to.deep.equal(['did-web-server'])
      expect(mockClient.query.secondCall.args[0]).to.equal('CREATE DATABASE "did-web-server"')
      expect(mockClient.end.calledOnce).to.equal(true)
    })

    it('should not create database when it already exists', async () => {
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [{ exists: 1 }] }) // Database exists
      mockClient.end.resolves()

      await (server as unknown as DidWebServerTestInterface).initialiseDatabase()

      expect(mockClient.connect.calledOnce).to.equal(true)
      expect(mockClient.query.calledOnce).to.equal(true)
      expect(mockClient.query.firstCall.args[0]).to.equal('SELECT 1 FROM pg_database WHERE datname = $1')
      expect(mockClient.end.calledOnce).to.equal(true)
    })

    it('should handle connection errors gracefully', async () => {
      const connectionError = new Error('ECONNREFUSED: Connection refused')
      mockClient.connect.rejects(connectionError)
      mockClient.end.resolves()

      try {
        await (server as unknown as DidWebServerTestInterface).initialiseDatabase()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.equal(connectionError)
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle authentication errors with specific message', async () => {
      const authError = new Error('authentication failed for user "postgres"')
      mockClient.connect.rejects(authError)
      mockClient.end.resolves()

      try {
        await (server as unknown as DidWebServerTestInterface).initialiseDatabase()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.equal(authError)
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle permission denied errors with specific message', async () => {
      const permissionError = new Error('permission denied to create database')
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [] })
      mockClient.query.onSecondCall().rejects(permissionError)
      mockClient.end.resolves()

      try {
        await (server as unknown as DidWebServerTestInterface).initialiseDatabase()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.equal(permissionError)
        expect(mockClient.end.calledOnce).to.equal(true)
      }
    })

    it('should handle client.end() errors gracefully', async () => {
      const endError = new Error('Connection already closed')
      mockClient.connect.resolves()
      mockClient.query.onFirstCall().resolves({ rows: [{ exists: 1 }] })
      mockClient.end.rejects(endError)

      // Should not throw even if end() fails
      await (server as unknown as DidWebServerTestInterface).initialiseDatabase()

      expect(mockClient.connect.calledOnce).to.equal(true)
      expect(mockClient.query.calledOnce).to.equal(true)
      expect(mockClient.end.calledOnce).to.equal(true)
    })
  })

  describe('SQLite storage', () => {
    beforeEach(() => {
      // Mock environment to return 'sqlite' for STORAGE_TYPE
      const mockEnv = {
        get: sinon.stub().callsFake((key: string) => {
          if (key === 'STORAGE_TYPE') return 'sqlite'
          // Return default test values for other keys
          if (key === 'DID_WEB_DB_NAME') return 'did-web-server'
          if (key === 'POSTGRES_HOST') return 'localhost'
          if (key === 'POSTGRES_PORT') return 5432
          if (key === 'POSTGRES_USERNAME') return 'postgres'
          if (key === 'POSTGRES_PASSWORD') return 'postgres'
          return undefined
        }),
      }
      sinon.stub(container, 'resolve').returns(mockEnv)
    })

    it('should handle SQLite storage without database creation', async () => {
      // SQLite storage should not attempt any database operations
      await (server as unknown as DidWebServerTestInterface).initialiseDatabase()

      // Verify no PostgreSQL client methods were called
      expect(mockClient.connect.called).to.equal(false)
      expect(mockClient.query.called).to.equal(false)
      expect(mockClient.end.called).to.equal(false)
    })
  })

  describe('Unsupported storage type', () => {
    beforeEach(() => {
      // Mock environment to return unsupported storage type
      const mockEnv = {
        get: sinon.stub().callsFake((key: string) => {
          if (key === 'STORAGE_TYPE') return 'unsupported'
          return undefined
        }),
      }
      sinon.stub(container, 'resolve').returns(mockEnv)
    })

    it('should throw error for unsupported storage type', async () => {
      try {
        await (server as unknown as DidWebServerTestInterface).initialiseDatabase()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect((error as Error).message).to.equal('Unsupported storage type: unsupported')
      }
    })
  })
})
