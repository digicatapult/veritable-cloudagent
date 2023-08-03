import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { restore as sinonRestore } from 'sinon'

import type { Agent } from '@aries-framework/core'
import type { Server } from 'net'

import request from 'supertest'

import { startServer } from '../src'

import { getTestAgent } from './utils/helpers'

describe('DidController', () => {
  let app: Server
  let aliceAgent: Agent

  before(async () => {
    aliceAgent = await getTestAgent('Did REST Agent Test Alice', 3999)
    app = await startServer(aliceAgent, { port: 3000 })
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Get did resolution result by did', () => {
    test('should give 200 when did resolution record is found', async () => {
      const did = 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'
      const response = await request(app).get(`/dids/${did}`)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.didDocument).to.deep.equal({
        '@context': [
          'https://w3id.org/did/v1',
          'https://w3id.org/security/suites/ed25519-2018/v1',
          'https://w3id.org/security/suites/x25519-2019/v1',
        ],
        id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        verificationMethod: [
          {
            id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            type: 'Ed25519VerificationKey2018',
            controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            publicKeyBase58: '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx',
          },
        ],
        authentication: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        assertionMethod: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        keyAgreement: [
          {
            id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6LSrdqo4M24WRDJj1h2hXxgtDTyzjjKCiyapYVgrhwZAySn',
            type: 'X25519KeyAgreementKey2019',
            controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
            publicKeyBase58: 'FxfdY3DCQxVZddKGAtSjZdFW9bCCW7oRwZn1NFJ2Tbg2',
          },
        ],
        capabilityInvocation: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
        capabilityDelegation: [
          'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        ],
      })
    })

    test('should give 500 when did document record is not found', async () => {
      const response = await request(app).get(`/dids/did:key:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)
      expect(response.statusCode).to.be.equal(500)
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    app.close()
  })
})