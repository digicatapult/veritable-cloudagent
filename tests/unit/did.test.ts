import type { Agent, DidCreateResult } from '@aries-framework/core'
import type { Server } from 'net'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { restore as sinonRestore, stub } from 'sinon'
import request from 'supertest'

import { KeyType } from '@aries-framework/core'

import { startServer } from '../../src/index.js'

import { getTestAgent, getTestDidCreate, getTestDidDocument, objectToJson } from './utils/helpers.js'
import { DidCreateOptions, ImportDidOptions } from '../../src/controllers/types.js'

describe('DidController', () => {
  let app: Server
  let aliceAgent: Agent
  let testDidDocument: Record<string, unknown>
  let testDidCreate: DidCreateResult

  before(async () => {
    aliceAgent = await getTestAgent('Did REST Agent Test Alice', 3999)
    app = await startServer(aliceAgent, { port: 3000 })

    testDidDocument = getTestDidDocument()
    testDidCreate = getTestDidCreate()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Get did resolution result by did', () => {
    test('should give 200 when did resolution record is found', async () => {
      const did = 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'
      const response = await request(app).get(`/dids/${did}`)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.didDocument).to.deep.equal(testDidDocument)
    })

    test('should give 500 when did document record is not found', async () => {
      const response = await request(app).get(`/dids/did:key:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)
      expect(response.statusCode).to.be.equal(500)
    })
  })

  describe('Import Did', () => {
    test('should return did document after importing Did', async () => {
      const importRequest: ImportDidOptions = { did: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL' }
      const response = await request(app).post(`/dids/import`).send(importRequest)

      expect(response.statusCode).to.equal(200)
      expect(response.body.didDocument).to.deep.equal(testDidDocument)
    })

    test('should give 400 for an invalid Did', async () => {
      const importRequest: ImportDidOptions = { did: 'did:key:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
      const response = await request(app).post(`/dids/import`).send(importRequest)

      expect(response.statusCode).to.equal(400)
    })
  })

  describe('Create Did', () => {
    const createRequest: DidCreateOptions = {
      method: 'key',
      options: {
        keyType: KeyType.Ed25519,
      },
    }

    test('should return did document after creating Did', async () => {
      const createStub = stub(aliceAgent.dids, 'create').resolves(testDidCreate)
      const getResult = (): Promise<DidCreateResult> => createStub.firstCall.returnValue

      const response = await request(app).post(`/dids/create`).send(createRequest)

      expect(createStub.calledWithMatch(createRequest)).equals(true)

      expect(response.statusCode).to.equal(200)

      const result = await getResult()
      expect(response.body).to.deep.equal(objectToJson(result.didState))
    })

    test('should give 400 for an invalid Did method', async () => {
      const createRequest: DidCreateOptions = {
        method: 'foo',
        options: {
          keyType: KeyType.Ed25519,
        },
      }
      const response = await request(app).post(`/dids/create`).send(createRequest)
      expect(response.statusCode).to.equal(500)
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    app.close()
  })
})
