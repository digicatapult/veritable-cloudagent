import { expect } from 'chai'
import { after, before, describe, test } from 'mocha'

import type { Agent } from '@credo-ts/core'
import type { Server } from 'node:net'

import request from 'supertest'

import { getTestAgent, getTestServer } from './utils/helpers.js'

describe('AgentController', () => {
  let app: Server
  let agent: Agent

  before(async () => {
    agent = await getTestAgent('Agent REST Agent Test', 3001)
    app = await getTestServer(agent)
  })

  describe('Get agent info', () => {
    test('should return agent information', async () => {
      const response = await request(app).get('/v1/agent')

      expect(response.body).to.have.property('label')
      expect(response.body).to.have.property('endpoints')
      expect(response.body.isInitialized).to.be.equal(true)
    })

    test('should response with a 200 status code', async () => {
      const response = await request(app).get('/v1/agent')

      expect(response.statusCode).to.equal(200)
    })

    test('/health endpoint should give cloudagent version', async () => {
      const response = await request(app).get('/health')

      expect(response.body).to.have.property('version')
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
    app.close()
  })
})
