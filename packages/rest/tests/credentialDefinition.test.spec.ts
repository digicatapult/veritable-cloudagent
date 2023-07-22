import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import type { Agent } from '@aries-framework/core'
import type { Express } from 'express'
import type { CredDef } from 'indy-sdk'

import request from 'supertest'

import { setupServer } from '../src/server'

import { getTestAgent, getTestCredDef } from './utils/helpers'

describe('CredentialDefinitionController', () => {
  let app: Express
  let agent: Agent
  let testCredDef: CredDef

  before(async () => {
    agent = await getTestAgent('CredentialDefinition REST Agent Test', 3011)
    app = await setupServer(agent, { port: 3000 })
    testCredDef = getTestCredDef()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('get credential definition by id', () => {
    test('should return credential definition ', async () => {
      const spy = stub(agent.ledger, 'getCredentialDefinition')
      spy.resolves(testCredDef)
      const getResult = (): Promise<CredDef> => spy.firstCall.returnValue

      const response = await request(app).get(`/credential-definitions/WgWxqztrNooG92RXvxSTWv:3:CL:20:tag`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.id).to.deep.equal(result.id)
      expect(response.body.schemaId).to.deep.equal(result.schemaId)
      expect(response.body.tag).to.deep.equal(result.tag)
      expect(response.body.type).to.deep.equal(result.type)
      expect(response.body.ver).to.deep.equal(result.ver)
    })

    test('should return 400 BadRequest when id has invalid structure', async () => {
      const response = await request(app).get(`/credential-definitions/x`)
      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 404 NotFound when credential definition not found', async () => {
      const response = await request(app).get(`/credential-definitions/WgWxqztrNooG92RXvxSTWv:3:CL:20:tag`)
      expect(response.statusCode).to.be.equal(404)
    })

  })

  describe('create credential definition', () => {
    test('should return created credential definition ', async () => {
      const registerCredentialDefinitionSpy = stub(agent.ledger, 'registerCredentialDefinition')
      registerCredentialDefinitionSpy.resolves(testCredDef)

      const getSchemaStub = stub(agent.ledger, 'getSchema')
      getSchemaStub.resolves({
        id: 'WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0',
        name: 'test',
        version: '1.0',
        ver: '1.0',
        seqNo: 9999,
        attrNames: ['prop1', 'prop2'],
      })

      const getResult = (): Promise<CredDef> => registerCredentialDefinitionSpy.firstCall.returnValue

      const response = await request(app).post(`/credential-definitions`).send({
        tag: 'latest',
        supportRevocation: false,
        schemaId: 'WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0',
      })

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.id).to.deep.equal(result.id)
      expect(response.body.schemaId).to.deep.equal(result.schemaId)
      expect(response.body.tag).to.deep.equal(result.tag)
      expect(response.body.type).to.deep.equal(result.type)
      expect(response.body.ver).to.deep.equal(result.ver)
    })

    test('should throw error when props missing ', async () => {
      const response = await request(app).post(`/credential-definitions`).send({
        tag: 'latest',
        supportRevocation: false,
      })
      expect(response.statusCode).to.be.equal(422)
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })
})
