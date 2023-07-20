import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, spy, match, restore as sinonRestore } from 'sinon'

import type { Agent, OutOfBandRecord, ConnectionRecord, OutOfBandInvitation } from '@aries-framework/core'
import type { Express } from 'express'

import { JsonTransformer, AgentMessage } from '@aries-framework/core'
import request from 'supertest'

import { setupServer } from '../src/server'

import {
  getTestAgent,
  getTestConnection,
  getTestOutOfBandInvitation,
  getTestOutOfBandRecord,
  objectToJson,
} from './utils/helpers'

describe('OutOfBandController', () => {
  let app: Express
  let aliceAgent: Agent
  let bobAgent: Agent
  let outOfBandRecord: OutOfBandRecord
  let outOfBandInvitation: OutOfBandInvitation
  let connectionRecord: ConnectionRecord

  before(async () => {
    aliceAgent = await getTestAgent('OutOfBand REST Agent Test Alice', 3014)
    bobAgent = await getTestAgent('OutOfBand REST Agent Test Bob', 3015)
    app = await setupServer(bobAgent, { port: 3000 })
    outOfBandRecord = getTestOutOfBandRecord()
    outOfBandInvitation = getTestOutOfBandInvitation()
    connectionRecord = getTestConnection()
  })

  afterEach(() => {
    sinonRestore
  })

  describe('Get all out of band records', () => {
    test('should return all out of band records', async () => {
      const getAllSpy = spy(bobAgent.oob, 'getAll')
      const getResult = (): Promise<OutOfBandRecord[]> => getAllSpy.firstCall.returnValue

      const response = await request(app).get('/oob')
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
      getAllSpy.restore()
    })

    test('should return filtered out of band records if query is passed', async () => {
      const getAllStub = stub(bobAgent.oob, 'getAll')
      getAllStub.resolves([outOfBandRecord])
      const response = await request(app).get('/oob?invitationId=test')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([])
    })
  })

  describe('Get out of band record by id', () => {
    test('should return out of band record with correct id', async () => {
      const findByIdStub = stub(bobAgent.oob, 'findById')
      findByIdStub.resolves(outOfBandRecord)
      const getResult = (): Promise<OutOfBandRecord | null> => findByIdStub.firstCall.returnValue

      const response = await request(app).get(`/oob/${outOfBandRecord.id}`)

      expect(response.statusCode).to.be.equal(200)
      findByIdStub.calledWithMatch(outOfBandRecord.id)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      findByIdStub.restore()
    })

    test('should return 404 if out of band record is not found', async () => {
      const response = await request(app).get(`/oob/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Create out of band invitation', () => {
    test('should return out of band invitation', async () => {
      const createInvitationStub = stub(bobAgent.oob, 'createInvitation')
      createInvitationStub.resolves(outOfBandRecord)

      const response = await request(app).post('/oob/create-invitation')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson({
        invitationUrl: outOfBandRecord.outOfBandInvitation.toUrl({
          domain: bobAgent.config.endpoints[0],
        }),
        invitation: outOfBandRecord.outOfBandInvitation.toJSON({
          useLegacyDidSovPrefix: bobAgent.config.useLegacyDidSovPrefix,
        }),
        outOfBandRecord: outOfBandRecord.toJSON(),
      }))
      createInvitationStub.restore()
    })

    test('should use parameters', async () => {
      const createInvitationStub = stub(bobAgent.oob, 'createInvitation')
      createInvitationStub.resolves(outOfBandRecord)

      // todo: add tests for routing param
      const params = {
        label: 'string',
        alias: 'string',
        imageUrl: 'string',
        goalCode: 'string',
        goal: 'string',
        handshake: true,
        handshakeProtocols: ['https://didcomm.org/connections/1.0'],
        multiUseInvitation: true,
        autoAcceptConnection: true,
      }
      const response = await request(app).post('/oob/create-invitation').send(params)

      expect(response.statusCode).to.be.equal(200)
      expect(createInvitationStub.lastCall.args[0]).to.be.deep.include(params)
      createInvitationStub.restore()
    })
  })

  describe('Create legacy invitation', () => {
    test('should return out of band invitation', async () => {
      const createLegacyInvitation = stub(bobAgent.oob, 'createLegacyInvitation')
      createLegacyInvitation.resolves({
        outOfBandRecord: outOfBandRecord,
        invitation: outOfBandInvitation,
      })

      const response = await request(app).post('/oob/create-legacy-invitation')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson({
        invitationUrl: outOfBandInvitation.toUrl({
          domain: bobAgent.config.endpoints[0],
        }),
        invitation: outOfBandInvitation.toJSON({
          useLegacyDidSovPrefix: bobAgent.config.useLegacyDidSovPrefix,
        }),
        outOfBandRecord: outOfBandRecord.toJSON(),
      }))
      createLegacyInvitation.restore()
    })

    test('should use parameters', async () => {
      const createLegacyInvitationStub = stub(bobAgent.oob, 'createLegacyInvitation')
      createLegacyInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        invitation: outOfBandInvitation,
      })

      const params = {
        label: 'string',
        alias: 'string',
        imageUrl: 'string',
        multiUseInvitation: true,
        autoAcceptConnection: true,
      }
      const response = await request(app).post('/oob/create-legacy-invitation').send(params)

      expect(response.statusCode).to.be.equal(200)
      expect(createLegacyInvitationStub.lastCall.args[0]).to.be.deep.include(params)
    })
  })

  describe('Create legacy connectionless invitation', () => {
    const msg = JsonTransformer.fromJSON(
      {
        '@id': 'eac4ff4e-b4fb-4c1d-aef3-b29c89d1cc00',
        '@type': 'https://didcomm.org/connections/1.0/invitation',
      },
      AgentMessage
    )

    const inputParams = {
      domain: 'string',
      message: {
        '@id': 'eac4ff4e-b4fb-4c1d-aef3-b29c89d1cc00',
        '@type': 'https://didcomm.org/connections/1.0/invitation',
      },
      recordId: 'string',
    }

    test('should return out of band invitation', async () => {
      const createLegacyConnectionlessInvitationStub = stub(bobAgent.oob, 'createLegacyConnectionlessInvitation')
      createLegacyConnectionlessInvitationStub.resolves({
        message: msg,
        invitationUrl: 'https://example.com/invitation',
      })

      const getResult = (): Promise<any> => createLegacyConnectionlessInvitationStub.firstCall.returnValue

      const response = await request(app).post('/oob/create-legacy-connectionless-invitation').send(inputParams)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      createLegacyConnectionlessInvitationStub.restore()
    })

    test('should use parameters', async () => {
      const createLegacyConnectionlessInvitationStub = stub(bobAgent.oob, 'createLegacyConnectionlessInvitation')
      createLegacyConnectionlessInvitationStub.resolves({
        message: msg,
        invitationUrl: 'https://example.com/invitation',
      })

      const response = await request(app).post('/oob/create-legacy-connectionless-invitation').send(inputParams)

      expect(response.statusCode).to.be.equal(200)
      createLegacyConnectionlessInvitationStub
      expect(createLegacyConnectionlessInvitationStub.lastCall.args[0]).to.be.deep.include({
        ...inputParams,
        message: msg,
      })
      createLegacyConnectionlessInvitationStub.restore()
    })
  })

  describe('Receive out of band invitation', () => {
    test('should return out of band invitation', async () => {
      const receiveInvitationStub = stub(bobAgent.oob, 'receiveInvitation')
      receiveInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })
      const getResult = (): Promise<any> => receiveInvitationStub.firstCall.returnValue

      const response = await request(app)
        .post('/oob/receive-invitation')
        .send({ invitation: outOfBandRecord.outOfBandInvitation })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      receiveInvitationStub.restore()
    })

    test('should use parameters', async () => {
      const receiveInvitationStub = stub(bobAgent.oob, 'receiveInvitation')
      receiveInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })

      // todo: add tests for routing param
      const params = {
        label: 'test',
        alias: 'test',
        imageUrl: 'test',
        autoAcceptInvitation: false,
        autoAcceptConnection: false,
        reuseConnection: false,
      }

      const response = await request(app)
        .post('/oob/receive-invitation')
        .send({
          invitation: outOfBandInvitation,
          ...params,
        })

      expect(response.statusCode).to.be.equal(200)
      expect(receiveInvitationStub.calledWith(
        match.any,
        match({
          label: params.label,
          alias: params.alias,
          imageUrl: params.imageUrl,
          autoAcceptInvitation: params.autoAcceptInvitation,
          autoAcceptConnection: params.autoAcceptConnection,
          reuseConnection: params.reuseConnection,
        })
      )).equals(true)
      receiveInvitationStub.restore()
    })
  })

  describe('Receive out of band invitation by url', () => {
    test('should return out of band invitation', async () => {
      const receiveInvitationFromUrlStub = stub(bobAgent.oob, 'receiveInvitationFromUrl')
      receiveInvitationFromUrlStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })
      const getResult = (): Promise<any> => receiveInvitationFromUrlStub.firstCall.returnValue

      const response = await request(app)
        .post('/oob/receive-invitation-url')
        .send({ invitationUrl: 'https://example.com/test' })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      receiveInvitationFromUrlStub.restore()
    })

    test('should use parameters', async () => {
      const receiveInvitationFromUrlStub = stub(bobAgent.oob, 'receiveInvitationFromUrl')
      receiveInvitationFromUrlStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })

      // todo: add tests for routing param
      const params = {
        label: 'test',
        alias: 'test',
        imageUrl: 'test',
        autoAcceptInvitation: false,
        autoAcceptConnection: false,
        reuseConnection: false,
      }

      const response = await request(app)
        .post('/oob/receive-invitation-url')
        .send({ invitationUrl: 'https://example.com/test', ...params })

      expect(response.statusCode).to.be.equal(200)
      expect(receiveInvitationFromUrlStub.calledWith(
        match('https://example.com/test'),
        match({
          label: params.label,
          alias: params.alias,
          imageUrl: params.imageUrl,
          autoAcceptInvitation: params.autoAcceptInvitation,
          autoAcceptConnection: params.autoAcceptConnection,
          reuseConnection: params.reuseConnection
      })
      )).equals(true)
      receiveInvitationFromUrlStub.restore()
    })
  })

  describe('Accept out of band invitation', () => {
    test('should return record from accepted invitation', async () => {
      const acceptInvitationStb = stub(bobAgent.oob, 'acceptInvitation')
      acceptInvitationStb.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })
      const getResult = (): Promise<any> => acceptInvitationStb.firstCall.returnValue

      // todo: add tests for routing param
      const params = {
        autoAcceptConnection: false,
        reuseConnection: false,
        label: 'test',
        alias: 'test',
        imageUrl: 'test',
        mediatorId: 'test',
      }

      const response = await request(app)
        .post('/oob/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-invitation')
        .send(params)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      acceptInvitationStb.restore()
    })

    test('should use parameters', async () => {
      const acceptInvitationStub = stub(bobAgent.oob, 'acceptInvitation')
      acceptInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connectionRecord,
      })

      // todo: add tests for routing param
      const params = {
        autoAcceptConnection: false,
        reuseConnection: false,
        label: 'test',
        alias: 'test',
        imageUrl: 'test',
        mediatorId: 'test',
      }

      const response = await request(app)
        .post('/oob/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-invitation')
        .send(params)

      expect(response.statusCode).to.be.equal(200)
      expect(acceptInvitationStub.calledWithMatch('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', params))
        .equals(true)
      acceptInvitationStub.restore()
    })

    test('should throw 404 if out of band record is not found', async () => {
      const response = await request(app).post('/oob/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-invitation')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Delete out of band record', () => {
    test('should return 204 if record is successfully deleted', async () => {
      const deleteByIdStub = stub(bobAgent.oob, 'deleteById')
      deleteByIdStub.resolves()

      const response = await request(app).delete('/oob/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(204)
      deleteByIdStub.restore()
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
  })
})
