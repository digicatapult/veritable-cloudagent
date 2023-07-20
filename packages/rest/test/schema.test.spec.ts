import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import type { Agent } from '@aries-framework/core'
import type { Express } from 'express'
import type { Schema } from 'indy-sdk'

import request from 'supertest'

import { setupServer } from '../src/server'

import { getTestAgent } from './utils/helpers'

describe('AgentController', ()=>{
  let app: Express
  let agent: Agent

  before(async () => {
    agent = await getTestAgent('Schema REST Agent Test', 3021)
    app = await setupServer(agent, { port: 3000 })
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('get schema by id', () => {
    test('should return schema ', async () => {
      const getSchemaStub = stub(agent.ledger, 'getSchema')
      getSchemaStub.resolves({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        name: 'test',
        version: '1.0',
        ver: '1.0',
        seqNo: 9999,
        attrNames: ['prop1', 'prop2'],
      })
      const getResult = (): Promise<Schema> => getSchemaStub.firstCall.returnValue

      const response = await request(app).get(`/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result)
      getSchemaStub.restore()
    })

    test('should return 400 BadRequest when id has invalid structure', async () => {
      const response = await request(app).get(`/schemas/x`)

      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 404 NotFound when schema not found', async () => {
//       const response = await request(app).get(`/schemas/WgWxqztrNooG92RXvxSTWv:2:test:1.0`)

//       expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('create schema', () => {
    test('should return created schema ', async () => {
      const registerSchemaStub = stub(agent.ledger, 'registerSchema')
      registerSchemaStub.resolves({
        id: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
        name: 'test',
        version: '1.0',
        ver: '1.0',
        seqNo: 9999,
        attrNames: ['prop1', 'prop2'],
      })
      const getResult = (): Promise<Schema> => registerSchemaStub.firstCall.returnValue

      const response = await request(app)
        .post(`/schemas/`)
        .send({
          name: 'test',
          version: '1.0',
          attributes: ['prop1', 'prop2'],
        })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(await getResult())
    })

    test('should throw error when props missing ', async () => {
      const response = await request(app).post(`/schemas`).send({
        name: 'string',
        version: '1.0',
      })

      expect(response.statusCode).to.be.equal(422)
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })
})

