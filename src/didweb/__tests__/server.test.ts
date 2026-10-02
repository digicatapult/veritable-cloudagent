import { DidDocument } from '@credo-ts/core'
import { expect } from 'chai'
import sinon from 'sinon'
import { closeServer, getAvailablePort, occupyPort } from '../../../tests/unit/utils/helpers.js'
import { DidWebServer, DidWebServerConfig } from '../../didweb/server.js'
import PinoLogger from '../../utils/logger.js'
import Database from '../db.js'

const didWebDomain = 'test.com'
const did = new DidDocument({
  id: `did:web:${didWebDomain}`,
  context: ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [],
  authentication: [],
  assertionMethod: [],
  keyAgreement: [],
  capabilityInvocation: [],
  capabilityDelegation: [],
  service: [],
})
const logger = new PinoLogger('silent').logger
const dbMock = {
  upsert: sinon.stub().callsFake(() => Promise.resolve()),
}
const dbMockDep = dbMock as unknown as Database
const config: DidWebServerConfig = {
  didWebDomain,
} as DidWebServerConfig

describe('did:web server', () => {
  describe('upsert DID', async () => {
    beforeEach(() => {
      dbMock.upsert.resetHistory()
    })

    const server = new DidWebServer(logger, dbMockDep, config)
    it('insert valid DID', async () => {
      const spy = dbMock.upsert
      await server.upsertDid(did)
      expect(spy.firstCall.args).to.deep.equal(['did_web', { did: did.id, document: did.toJSON() }, 'did'])
    })
  })

  describe('reqPath to DID', () => {
    const server = new DidWebServer(logger, dbMockDep, config)
    it('well known', () => {
      expect(server.reqPathToDid('/.well-known/did.json')).to.equal(`did:web:${didWebDomain}`)
    })

    it('no nested path', () => {
      expect(server.reqPathToDid('/did.json')).to.equal(`did:web:${didWebDomain}`)
    })

    it('nested path', () => {
      expect(server.reqPathToDid('/users/alice/did.json')).to.equal(`did:web:${didWebDomain}:users:alice`)
    })

    it('path not ending did.json', () => {
      expect(() => server.reqPathToDid('/users/alice/did')).to.throw('Invalid DID URL path: /users/alice/did')
    })
  })

  describe('start/stop when the port is already in use', () => {
    it('rejects start() and leaves stop() a safe no-op when the port bind fails', async () => {
      const port = await getAvailablePort()
      const occupyingServer = await occupyPort(port)

      const server = new DidWebServer(logger, dbMockDep, {
        ...config,
        enabled: true,
        port,
        useDevCert: false,
        certPath: '',
        keyPath: '',
      })

      let thrownError: unknown
      try {
        await server.start()
      } catch (error) {
        thrownError = error
      }

      expect(thrownError).to.be.instanceOf(Error)

      // Must not throw ERR_SERVER_NOT_RUNNING; start() clears the server reference on bind failure.
      await server.stop()

      await closeServer(occupyingServer)
    })
  })
})
