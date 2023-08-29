import type { RestAgent } from '../src/utils/agent'
import type { AnonCredsSchema } from '@aries-framework/anoncreds'
import type { Express } from 'express'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import request from 'supertest'

import { setupServer } from '../src/server'

import { getTestAgent, getTestSchema } from './utils/helpers'
import _schema from '../definitions/schemaDefinition.json'
const schema = _schema as AnonCredsSchema

describe('SchemaController', () => {
  let app: Express
  let agent: RestAgent
  let testSchema: AnonCredsSchema

  before(async () => {
    agent = await getTestAgent('Schema REST Agent Test', 3021)
    app = await setupServer(agent, { port: 3000 })
    testSchema = getTestSchema()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('get schema by id', () => {
    test('should return schema', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        schema: testSchema,
        schemaMetadata: {},
        resolutionMetadata: {},
      })

      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        ...testSchema,
      })

      const response = await request(app).get(`/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result)
    })

    test('should return 400 BadRequest when id has invalid anoncreds method', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        resolutionMetadata: {
          error: 'invalid',
        },
        schemaId: 'x',
        schemaMetadata: {},
      })

      const response = await request(app).get(`/schemas/x`)

      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 400 BadRequest when id has invalid structure', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        resolutionMetadata: {
          error: 'unsupportedAnonCredsMethod',
        },
        schemaId: 'x',
        schemaMetadata: {},
      })

      const response = await request(app).get(`/schemas/x`)

      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 404 NotFound when schema not found', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        resolutionMetadata: {
          error: 'notFound',
        },
        schemaId: 'x',
        schemaMetadata: {},
      })

      const response = await request(app).get(`/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('get schema by id using schema definition', () => {
    test('should return schema', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getSchema')
      getSchemaStub.resolves({
        schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        schema: schema,
        schemaMetadata: {},
        resolutionMetadata: {},
      })

      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        ...schema,
      })

      const response = await request(app).get(`/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result)
    })
  })

  describe('create schema', () => {
    test('should return created schema ', async () => {
      const registerSchemaStub = stub(agent.modules.anoncreds, 'registerSchema')
      registerSchemaStub.resolves({
        schemaState: {
          state: 'finished',
          schema: testSchema,
          schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        },
        registrationMetadata: {},
        schemaMetadata: {},
      })
      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        ...testSchema,
      })

      const response = await request(app).post(`/schemas/`).send(testSchema)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(await getResult())
    })

    test('should return 422 when props missing ', async () => {
      const omitted = {
        name: testSchema.name,
        version: testSchema.version,
        attrNames: testSchema.attrNames,
      }
      const response = await request(app).post(`/schemas`).send(omitted)

      expect(response.statusCode).to.be.equal(422)
    })
  })
  describe('create schema using new json schema ', () => {
    test('should return created schema  using new json ', async () => {
      const registerSchemaStub = stub(agent.modules.anoncreds, 'registerSchema')
      //register schema
      registerSchemaStub.resolves({
        schemaState: {
          state: 'finished',
          schema: schema,
          schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        },
        registrationMetadata: {},
        schemaMetadata: {},
      })

      const getResult = () => ({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        ...schema,
      })

      const response = await request(app).post(`/schemas/`).send(schema)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(getResult())
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })
})
