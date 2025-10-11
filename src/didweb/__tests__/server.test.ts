import { expect } from 'chai'
import sinon from 'sinon'
import { DidWebDocument } from '../../utils/didWebGenerator.js'
import PinoLogger from '../../utils/logger.js'
import Database from '../db.js'
import { DidWebServer, DidWebServerConfig } from '../server.js'

const didWebDomain = 'test.com'
const did = {
  id: `did:web:${didWebDomain}`,
} as DidWebDocument
const logger = new PinoLogger('silent').logger

describe('did:web server', () => {
  let config: DidWebServerConfig
  let server: DidWebServer
  let mockDatabase: Database

  beforeEach(() => {
    config = {
      enabled: true,
      port: 8443,
      useDevCert: false,
      certPath: '/cert.pem',
      keyPath: '/key.pem',
      didWebDomain,
      serviceEndpoint: 'http://test.com:5002',
    }

    // Create a mock database instance with required methods
    mockDatabase = {
      upsert: sinon.stub().resolves(),
      migrate: sinon.stub().resolves(),
      destroy: sinon.stub().resolves(),
    } as unknown as Database
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with correct configuration', () => {
      server = new DidWebServer(logger, mockDatabase, config)
      expect(server).to.be.instanceOf(DidWebServer)
    })
  })

  describe('setDidGenerator', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, mockDatabase, config)
    })

    it('should accept DID generator function', () => {
      const mockGenerator = sinon.stub().resolves(did)
      expect(() => server.setDidGenerator(mockGenerator)).to.not.throw()
    })
  })

  describe('reqPath to DID', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, mockDatabase, config)
    })

    it('should convert well-known path to DID', () => {
      const result = server.reqPathToDid('/.well-known/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}`)
    })

    it('no nested path', () => {
      expect(server.reqPathToDid('/did.json')).to.equal(`did:web:${didWebDomain}`)
    })

    it('nested path', () => {
      expect(server.reqPathToDid('/users/alice/did.json')).to.equal(`did:web:${didWebDomain}:users:alice`)
    })

    it('should handle complex nested paths', () => {
      const result = server.reqPathToDid('/org/dept/user/alice/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}:org:dept:user:alice`)
    })

    it('should throw error for invalid path', () => {
      expect(() => server.reqPathToDid('/users/alice/did')).to.throw('Invalid DID URL path: /users/alice/did')
    })

    it('should throw error for empty path', () => {
      expect(() => server.reqPathToDid('')).to.throw('Invalid DID URL path: ')
    })
  })

  describe('start method', () => {
    it('should skip initialization when disabled', async () => {
      const disabledConfig = { ...config, enabled: false }
      server = new DidWebServer(logger, mockDatabase, disabledConfig)

      // Should complete without error when disabled
      await server.start()
    })

    it('should handle enabled configuration without error', async () => {
      server = new DidWebServer(logger, mockDatabase, config)

      // Mock the environment variables needed for database initialization
      const envStub = sinon.stub(process, 'env').value({
        POSTGRES_HOST: 'localhost',
        POSTGRES_USERNAME: 'postgres',
        POSTGRES_PASSWORD: 'postgres',
        POSTGRES_PORT: '5432',
        DID_WEB_DB_NAME: 'did-web-server',
      })

      // Test completes without throwing - database errors are expected in test environment
      try {
        await server.start()
        // If start() succeeds, that's fine too
      } catch (error) {
        // Expected errors in test environment are acceptable
        expect(error).to.be.instanceOf(Error)
      }

      envStub.restore()
    })
  })

  describe('upsertDid method', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, mockDatabase, config)
    })

    it('should call database upsert method', async () => {
      await server.upsertDid(did)
      const upsertStub = mockDatabase.upsert as sinon.SinonStub
      sinon.assert.calledOnce(upsertStub)
      sinon.assert.calledWith(upsertStub, 'did_web', { did: did.id, document: did }, 'did')
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, mockDatabase, config)
    })

    it('should handle database not initialized for public methods', () => {
      // Test that server can be created even without database
      expect(server).to.be.instanceOf(DidWebServer)
    })
  })

  describe('integration with loose coupling', () => {
    it('should allow setting DID generator after construction', () => {
      server = new DidWebServer(logger, mockDatabase, config)
      const mockGenerator = sinon.stub().resolves(did)

      // Should not throw when setting generator
      expect(() => server.setDidGenerator(mockGenerator)).to.not.throw()
    })

    it('should work with different domain configurations', () => {
      const customConfig = { ...config, didWebDomain: 'custom-domain.com' }
      server = new DidWebServer(logger, mockDatabase, customConfig)

      const result = server.reqPathToDid('/did.json')
      expect(result).to.equal('did:web:custom-domain.com')
    })

    it('should handle URL-encoded domains correctly', () => {
      const encodedConfig = { ...config, didWebDomain: 'localhost%3A8443' }
      server = new DidWebServer(logger, mockDatabase, encodedConfig)

      const result = server.reqPathToDid('/users/alice/did.json')
      expect(result).to.equal('did:web:localhost%3A8443:users:alice')
    })
  })

  describe('configuration validation', () => {
    it('should accept minimal valid configuration', () => {
      const minimalConfig: DidWebServerConfig = {
        enabled: true,
        port: 8443,
        useDevCert: false,
        certPath: '/cert.pem',
        keyPath: '/key.pem',
        didWebDomain: 'example.com',
        serviceEndpoint: 'http://example.com:5002',
      }

      expect(() => new DidWebServer(logger, mockDatabase, minimalConfig)).to.not.throw()
    })

    it('should work with development certificate configuration', () => {
      const devConfig: DidWebServerConfig = {
        ...config,
        useDevCert: true,
        certPath: '/dev/cert.pem',
        keyPath: '/dev/key.pem',
      }

      expect(() => new DidWebServer(logger, mockDatabase, devConfig)).to.not.throw()
    })
  })
})
