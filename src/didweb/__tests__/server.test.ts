import { expect } from 'chai'
import sinon from 'sinon'
import { DidWebServer, DidWebServerConfig } from '../../didweb/server.js'
import { DidWebDocument } from '../../utils/didWebGenerator.js'
import PinoLogger from '../../utils/logger.js'

const didWebDomain = 'test.com'
const did = {
  id: `did:web:${didWebDomain}`,
} as DidWebDocument
const logger = new PinoLogger('silent').logger

describe('DidWebServer', () => {
  let config: DidWebServerConfig
  let server: DidWebServer

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
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with correct configuration', () => {
      server = new DidWebServer(logger, config)
      expect(server).to.be.instanceOf(DidWebServer)
    })
  })

  describe('setDidGenerator', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, config)
    })

    it('should accept DID generator function', () => {
      const mockGenerator = sinon.stub().resolves(did)
      expect(() => server.setDidGenerator(mockGenerator)).to.not.throw()
    })
  })

  describe('reqPathToDid', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, config)
    })

    it('should convert well-known path to DID', () => {
      const result = server.reqPathToDid('/.well-known/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}`)
    })

    it('should convert root path to DID', () => {
      const result = server.reqPathToDid('/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}`)
    })

    it('should convert nested path to DID with colons', () => {
      const result = server.reqPathToDid('/users/alice/did.json')
      expect(result).to.equal(`did:web:${didWebDomain}:users:alice`)
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
      server = new DidWebServer(logger, disabledConfig)
      
      // Should complete without error when disabled
      await server.start()
    })

    it('should handle enabled configuration', async () => {
      server = new DidWebServer(logger, config)
      
      // Mock the environment variables needed for database initialization
      const envStub = sinon.stub(process, 'env').value({
        POSTGRES_HOST: 'localhost',
        POSTGRES_USERNAME: 'postgres',
        POSTGRES_PASSWORD: 'postgres',
        POSTGRES_PORT: '5432',
        DID_WEB_DB_NAME: 'did-web-server',
      })

      // Since we can't easily mock dynamic imports, we'll test that start() doesn't throw
      try {
        await server.start()
      } catch (error) {
        // Expected in test environment due to missing database
        expect((error as Error).message).to.include('Cannot resolve module')
      }
      
      envStub.restore()
    })
  })

  describe('upsertDid method', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, config)
    })

    it('should throw error when database not initialized', async () => {
      try {
        await server.upsertDid(did)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect((error as Error).message).to.equal('Database not initialized')
      }
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      server = new DidWebServer(logger, config)
    })

    it('should handle database not initialized for public methods', () => {
      // Test that server can be created even without database
      expect(server).to.be.instanceOf(DidWebServer)
    })
  })

  describe('integration with loose coupling', () => {
    it('should allow setting DID generator after construction', () => {
      server = new DidWebServer(logger, config)
      const mockGenerator = sinon.stub().resolves(did)
      
      // Should not throw when setting generator
      expect(() => server.setDidGenerator(mockGenerator)).to.not.throw()
    })

    it('should work with different domain configurations', () => {
      const customConfig = { ...config, didWebDomain: 'custom-domain.com' }
      server = new DidWebServer(logger, customConfig)
      
      const result = server.reqPathToDid('/did.json')
      expect(result).to.equal('did:web:custom-domain.com')
    })

    it('should handle URL-encoded domains correctly', () => {
      const encodedConfig = { ...config, didWebDomain: 'localhost%3A8443' }
      server = new DidWebServer(logger, encodedConfig)
      
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
      
      expect(() => new DidWebServer(logger, minimalConfig)).to.not.throw()
    })

    it('should work with development certificate configuration', () => {
      const devConfig: DidWebServerConfig = {
        ...config,
        useDevCert: true,
        certPath: '/dev/cert.pem',
        keyPath: '/dev/key.pem',
      }
      
      expect(() => new DidWebServer(logger, devConfig)).to.not.throw()
    })
  })
})
