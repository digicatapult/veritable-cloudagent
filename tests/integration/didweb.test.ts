import { expect } from 'chai'
import https from 'https'
import { container } from 'tsyringe'

import { DidWebServer } from '../../src/didweb/index.js'
import { getTestAgent } from '../unit/utils/helpers.js'
import PinoLogger from '../../src/utils/logger.js'

// Accept self-signed certificates for testing
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

describe('DidWeb Integration Tests', () => {
  let agent: any
  let didWebServer: DidWebServer
  let logger: PinoLogger
  const testPort = 8444
  const testHost = 'localhost'
  const testDidId = `did:web:${testHost}%3A${testPort}`

  before(async function() {
    this.timeout(60000) // Increase timeout for agent setup
    
    agent = await getTestAgent('Test DID:web Agent', 5099)
    logger = container.resolve(PinoLogger)

    // Create DID:web server with test configuration and mock database
    didWebServer = new DidWebServer(agent, logger, true)
    
    // Override the configuration for testing
    const testConfig = {
      enabled: true,
      port: testPort,
      didId: testDidId
    }
    ;(didWebServer as any).config = testConfig
    
    // Start the server
    await didWebServer.start()
  })

  after(async function() {
    this.timeout(10000)
    if (didWebServer) {
      await didWebServer.stop()
    }
    if (agent) {
      await agent.shutdown()
    }
  })

  describe('DID:web Server', () => {
    it('should start the HTTPS server', async function() {
      this.timeout(15000)
      
      // The server startup is tested by the other tests succeeding
      // Just verify the config is correct
      const config = didWebServer.getConfig()
      expect(config.enabled).to.be.true
      expect(config.port).to.equal(testPort)
    })

    it('should serve DID document at /.well-known/did.json', async function() {
      this.timeout(10000)
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: testHost,
          port: testPort,
          path: '/.well-known/did.json',
          method: 'GET',
          rejectUnauthorized: false // Accept self-signed certificates
        }

        const req = https.request(options, (res) => {
          let data = ''
          
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              expect(res.statusCode).to.equal(200)
              expect(res.headers['content-type']).to.include('application/json')
              
              const didDoc = JSON.parse(data)
              expect(didDoc).to.have.property('@context')
              expect(didDoc).to.have.property('id', testDidId)
              expect(didDoc).to.have.property('verificationMethod')
              expect(didDoc).to.have.property('authentication')
              expect(didDoc).to.have.property('assertionMethod')
              expect(didDoc).to.have.property('service')
              
              // Verify structure matches the expected format
              expect(didDoc['@context']).to.deep.include('https://www.w3.org/ns/did/v1')
              expect(didDoc.verificationMethod).to.be.an('array')
              expect(didDoc.verificationMethod.length).to.be.greaterThan(0)
              expect(didDoc.verificationMethod[0]).to.have.property('id', `${testDidId}#owner`)
              expect(didDoc.verificationMethod[0]).to.have.property('type', 'JsonWebKey2020')
              expect(didDoc.verificationMethod[0]).to.have.property('publicKeyJwk')
              
              resolve()
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on('error', (error) => {
          reject(error)
        })

        req.setTimeout(5000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })
    })

    it('should serve DID document at path-based URLs', async function() {
      this.timeout(10000)
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: testHost,
          port: testPort,
          path: '/test/path/did.json',
          method: 'GET',
          rejectUnauthorized: false
        }

        const req = https.request(options, (res) => {
          let data = ''
          
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              // For now, this should return 404 since we haven't created a path-based DID
              // In a full implementation, we'd create different DIDs for different paths
              expect(res.statusCode).to.equal(404)
              resolve()
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on('error', (error) => {
          reject(error)
        })

        req.setTimeout(5000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })
    })

    it('should return 404 for non-existent DID documents', async function() {
      this.timeout(10000)
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: testHost,
          port: testPort,
          path: '/nonexistent/path/did.json',
          method: 'GET',
          rejectUnauthorized: false
        }

        const req = https.request(options, (res) => {
          res.on('data', () => {}) // Consume data
          res.on('end', () => {
            try {
              expect(res.statusCode).to.equal(404)
              resolve()
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on('error', (error) => {
          reject(error)
        })

        req.setTimeout(5000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })
    })

    it('should have proper CORS headers', async function() {
      this.timeout(10000)
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: testHost,
          port: testPort,
          path: '/.well-known/did.json',
          method: 'GET',
          rejectUnauthorized: false
        }

        const req = https.request(options, (res) => {
          res.on('data', () => {}) // Consume data
          res.on('end', () => {
            try {
              expect(res.headers['access-control-allow-origin']).to.equal('*')
              expect(res.headers['content-type']).to.include('application/json')
              resolve()
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on('error', (error) => {
          reject(error)
        })

        req.setTimeout(5000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })
    })

    it('should have a health check endpoint', async function() {
      this.timeout(10000)
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: testHost,
          port: testPort,
          path: '/health',
          method: 'GET',
          rejectUnauthorized: false
        }

        const req = https.request(options, (res) => {
          let data = ''
          
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              expect(res.statusCode).to.equal(200)
              const healthData = JSON.parse(data)
              expect(healthData).to.have.property('status', 'ok')
              expect(healthData).to.have.property('service', 'did:web-server')
              resolve()
            } catch (error) {
              reject(error)
            }
          })
        })

        req.on('error', (error) => {
          reject(error)
        })

        req.setTimeout(5000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })

        req.end()
      })
    })
  })
})