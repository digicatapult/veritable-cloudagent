import type { RestAgent } from '../src/utils/agent'
import type { AnonCredsCredentialDefinition, AnonCredsSchema } from '@aries-framework/anoncreds'
import type { Express } from 'express'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import request from 'supertest'

import { setupServer } from '../src/server'

import { getTestAgent, getTestCredDef, getTestSchema } from './utils/helpers'

import _schema from '../definitions/schemaDefinition.json'
const schema = _schema as AnonCredsSchema

describe('CredentialDefinitionController', () => {
  let app: Express
  let agent: RestAgent
  let testCredDef: AnonCredsCredentialDefinition
  let testSchema: AnonCredsSchema

  before(async () => {
    agent = await getTestAgent('CredentialDefinition REST Agent Test', 3011)
    app = await setupServer(agent, { port: 3000 })
    testCredDef = getTestCredDef()
    testSchema = getTestSchema()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('get credential definition by id', () => {
    test('should return credential definition ', async () => {
      const spy = stub(agent.modules.anoncreds, 'getCredentialDefinition')
      spy.resolves({
        credentialDefinitionId: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        credentialDefinitionMetadata: {},
        resolutionMetadata: {},
        credentialDefinition: testCredDef,
      })
      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        ...testCredDef,
      })

      const response = await request(app).get(`/credential-definitions/WgWxqztrNooG92RXvxSTWv:3:CL:20:tag`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.id).to.deep.equal(result.id)
      expect(response.body.schemaId).to.deep.equal(result.schemaId)
      expect(response.body.tag).to.deep.equal(result.tag)
      expect(response.body.type).to.deep.equal(result.type)
    })

    test('should return 400 BadRequest when id has invalid structure', async () => {
      const spy = stub(agent.modules.anoncreds, 'getCredentialDefinition')
      spy.resolves({
        credentialDefinitionId: 'x',
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'invalid',
        },
      })

      const response = await request(app).get(`/credential-definitions/x`)
      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 400 BadRequest when id has invalid anoncreds method', async () => {
      const spy = stub(agent.modules.anoncreds, 'getCredentialDefinition')
      spy.resolves({
        credentialDefinitionId: 'x',
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'unsupportedAnonCredsMethod',
        },
      })

      const response = await request(app).get(`/credential-definitions/x`)
      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 404 NotFound when credential definition not found', async () => {
      const spy = stub(agent.modules.anoncreds, 'getCredentialDefinition')
      spy.resolves({
        credentialDefinitionId: 'x',
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'notFound',
        },
      })

      const id = encodeURIComponent('ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR')
      const response = await request(app).get(`/credential-definitions/${id}`)
      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('get credential definition by id using schema definition json', () => {
    test('should return credential definition ', async () => {
      testCredDef.schemaId = 'ipfs://bafkreihiz6z2hcostlo73fycbflmhsayoyuqkicwinpqc7knxwmhhwahqq'
      const spy = stub(agent.modules.anoncreds, 'getCredentialDefinition')
      spy.resolves({
        credentialDefinitionId: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        credentialDefinitionMetadata: {},
        resolutionMetadata: {},
        credentialDefinition: testCredDef,
      })
      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        ...testCredDef,
      })

      const response = await request(app).get(`/credential-definitions/WgWxqztrNooG92RXvxSTWv:3:CL:20:tag`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.id).to.deep.equal(result.id)
      expect(response.body.schemaId).to.deep.equal(result.schemaId)
      expect(response.body.tag).to.deep.equal(result.tag)
      expect(response.body.type).to.deep.equal(result.type)
    })
  })

  describe('create credential definition', () => {
    test('should return created credential definition ', async () => {
      const registerCredentialDefinitionSpy = stub(agent.modules.anoncreds, 'registerCredentialDefinition')
      registerCredentialDefinitionSpy.resolves({
        credentialDefinitionState: {
          state: 'finished',
          credentialDefinition: testCredDef,
          credentialDefinitionId: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        },
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
      })

      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        resolutionMetadata: {},
        schemaMetadata: {},
        schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        schema: testSchema,
      })

      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        ...testCredDef,
      })

      const response = await request(app).post(`/credential-definitions`).send({
        issuerId: testCredDef.issuerId,
        schemaId: testCredDef.schemaId,
        tag: testCredDef.tag,
      })

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.id).to.deep.equal(result.id)
      expect(response.body.schemaId).to.deep.equal(result.schemaId)
      expect(response.body.tag).to.deep.equal(result.tag)
      expect(response.body.type).to.deep.equal(result.type)
    })

    // TODO: improve coverage

    test('should throw error when props missing ', async () => {
      const response = await request(app).post(`/credential-definitions`).send({
        schemaId: testCredDef.schemaId,
        tag: 'latest',
      })
      expect(response.statusCode).to.be.equal(422)
    })
  })

  describe('create credential definition using new json schema ', () => {
    test('should return created credential definitionusing new json ', async () => {
      const registerSchemaStub = stub(agent.modules.anoncreds, 'registerSchema')
      const registerCredentialDefinitionStub = stub(agent.modules.anoncreds, 'registerCredentialDefinition')
      // mock out getSchema from CredentialDefinitionController
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema').resolves({
        resolutionMetadata: {},
        schemaMetadata: {},
        schemaId: 'ipfs://bafkreihiz6z2hcostlo73fycbflmhsayoyuqkicwinpqc7knxwmhhwahqq',
        schema: schema,
      })

      testCredDef.schemaId = 'ipfs://bafkreihiz6z2hcostlo73fycbflmhsayoyuqkicwinpqc7knxwmhhwahqq'

      registerCredentialDefinitionStub.resolves({
        credentialDefinitionState: {
          state: 'finished',
          credentialDefinition: testCredDef,
          credentialDefinitionId: `ipfs://bafkreiafhhldn47xkq4r5frf4lgaqqq35h66xikhttp5s7g5peotmi2szu`,
        },
        registrationMetadata: {},
        credentialDefinitionMetadata: {},
      })

      const getCredentialDefResult = () => ({
        id: 'ipfs://bafkreiafhhldn47xkq4r5frf4lgaqqq35h66xikhttp5s7g5peotmi2szu',
        ...testCredDef,
      })

      const responseCredentialDeff = await request(app).post(`/credential-definitions/`).send({
        issuerId: testCredDef.issuerId,
        schemaId: testCredDef.schemaId,
        tag: testCredDef.tag,
      })

      expect(responseCredentialDeff.statusCode).to.be.equal(200)
      expect(responseCredentialDeff.body).to.deep.equal(getCredentialDefResult())
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })
})
