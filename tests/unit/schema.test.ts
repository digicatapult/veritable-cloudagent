import type { RestAgent } from '../../src/agent.js'
import type { AnonCredsSchema, AnonCredsSchemaRecord } from '@credo-ts/anoncreds'
import type { Server } from 'node:net'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import request from 'supertest'

import { setupServer } from '../../src/server.js'

import { getTestAgent, getTestSchema, getTestServer } from './utils/helpers.js'
import { schema } from './utils/fixtures.js'

describe('SchemaController', () => {
  let app: Server
  let agent: RestAgent
  let testSchema: AnonCredsSchema

  before(async () => {
    agent = await getTestAgent('Schema REST Agent Test', 3021)
    app = await getTestServer(agent)
    testSchema = getTestSchema()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('list schema', () => {
    test('should return schema with createdLocally = true', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getCreatedSchemas')
      getSchemaStub.resolves([
        {
          schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
          schema: testSchema,
        } as AnonCredsSchemaRecord,
      ])

      const getResult = () => [
        {
          id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
          ...testSchema,
        },
      ]

      const response = await request(app).get(`/v1/schemas?createdLocally=true`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result)
    })

    test('should error 400 createdLocally = false', async () => {
      const getSchemaStub = stub(agent.modules.anoncreds, 'getCreatedSchemas')
      getSchemaStub.resolves([
        {
          schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
          schema: testSchema,
        } as AnonCredsSchemaRecord,
      ])

      const response = await request(app).get(`/v1/schemas?createdLocally=false`)

      expect(response.statusCode).to.be.equal(400)
    })
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

      const response = await request(app).get(`/v1/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)
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

      const response = await request(app).get(`/v1/schemas/x`)

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

      const response = await request(app).get(`/v1/schemas/x`)

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

      const response = await request(app).get(`/v1/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)

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

      const response = await request(app).get(`/v1/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)
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

      const response = await request(app).post(`/v1/schemas/`).send(testSchema)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(await getResult())
    })

    test('should return 422 when props missing ', async () => {
      const omitted = {
        name: testSchema.name,
        version: testSchema.version,
        attrNames: testSchema.attrNames,
      }
      const response = await request(app).post(`/v1/schemas`).send(omitted)

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

      const response = await request(app).post(`/v1/schemas/`).send(schema)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(getResult())
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
    app.close()
  })
})
