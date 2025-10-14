import { expect } from 'chai'
import { DIDDocument } from 'did-resolver'
import sinon from 'sinon'
import { DidWebServer, DidWebServerConfig } from '../../didweb/server.js'
import PinoLogger from '../../utils/logger.js'
import Database from '../db.js'

const didWebDomain = 'test.com'
const did = {
  id: `did:web:${didWebDomain}`,
} as DIDDocument
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
      expect(spy.firstCall.args).to.deep.equal(['did_web', { did: did.id, document: did }, 'did'])
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
