import type { Agent, DidCreateResult, DidRecord } from '@credo-ts/core'
import type { Server } from 'node:net'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { restore as sinonRestore, stub } from 'sinon'
import request from 'supertest'

import { KeyType } from '@credo-ts/core'

import { getTestAgent, getTestDidCreate, getTestDidDocument, getTestServer, objectToJson } from './utils/helpers.js'
import { DidCreateOptions, ImportDidOptions } from '../../src/controllers/types.js'

describe('DidController', () => {
  let app: Server
  let aliceAgent: Agent
  let testDidDocument: Record<string, unknown>
  let testDidCreate: DidCreateResult

  before(async () => {
    aliceAgent = await getTestAgent('Did REST Agent Test Alice', 3999)
    app = await getTestServer(aliceAgent)

    testDidDocument = getTestDidDocument()
    testDidCreate = getTestDidCreate()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('list dids', () => {
    test('should return local dids when createdLocally = true', async () => {
      const did = 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'
      const getDidsStub = stub(aliceAgent.dids, 'getCreatedDids')
      getDidsStub.resolves([{ did } as DidRecord])
      const response = await request(app).get(`/v1/dids?createdLocally=true`)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.length).to.equal(1)
      expect(response.body[0].didDocument).to.deep.equal(testDidDocument)
    })

    test('should give 400 when createdLocally = false', async () => {
      const response = await request(app).get(`/v1/dids?createdLocally=false`)
      expect(response.statusCode).to.be.equal(400)
    })
  })

  describe('Get did resolution result by did', () => {
    test('should give 200 when did resolution record is found', async () => {
      const did = 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'
      const response = await request(app).get(`/v1/dids/${did}`)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.didDocument).to.deep.equal(testDidDocument)
    })

    test('should give 500 when did document record is not found', async () => {
      const response = await request(app).get(`/v1/dids/did:key:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)
      expect(response.statusCode).to.be.equal(500)
    })
  })

  describe('Import Did', () => {
    test('should return did document after importing Did', async () => {
      const importRequest: ImportDidOptions = { did: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL' }
      const response = await request(app).post(`/v1/dids/import`).send(importRequest)

      expect(response.statusCode).to.equal(200)
      expect(response.body.didDocument).to.deep.equal(testDidDocument)
    })

    test('should give 400 for an invalid Did', async () => {
      const importRequest: ImportDidOptions = { did: 'did:key:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
      const response = await request(app).post(`/v1/dids/import`).send(importRequest)

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

      const response = await request(app).post(`/v1/dids/create`).send(createRequest)

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
      const response = await request(app).post(`/v1/dids/create`).send(createRequest)
      expect(response.statusCode).to.equal(500)
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    app.close()
  })
})
