import type { Server } from 'node:net'

import { after, afterEach, before, describe, test } from 'mocha'
import { restore as sinonRestore, stub } from 'sinon'
import request from 'supertest'

import { type Agent, Buffer } from '@credo-ts/core'

import { expect } from 'chai'
import { getTestAgent, getTestServer } from './utils/helpers.js'

describe('WalletController', () => {
  let app: Server
  let agent: Agent

  before(async () => {
    agent = await getTestAgent('DID REST Agent Test Alice', 3999)
    app = await getTestServer(agent)
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Decrypt JWE', () => {
    test('should return plaintext data from JWE', async () => {
      const decryptResult = {
        data: Buffer.from('test'),
        header: {},
      }
      const spy = stub(agent.context.wallet, 'directDecryptCompactJweEcdhEs')
      spy.resolves(decryptResult)

      const params = {
        jwe: 'test',
        recipientPublicKey: 'key',
        enc: 'A256GCM',
        alg: 'ECDH-ES',
      }
      const response = await request(app).post(`/v1/wallet/decrypt`).send(params)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.equal(decryptResult.data.toString())
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
    app.close()
  })
})
