import { DidDocument } from '@credo-ts/core'
import { expect } from 'chai'
import sinon from 'sinon'
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
})
