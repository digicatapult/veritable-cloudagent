import { describe, before, after, test } from 'mocha'
import { expect } from 'chai'

import type { Agent } from '@aries-framework/core'
import type { Express } from 'express'

import request from 'supertest'

import { setupServer } from '@src/server'

import { getTestAgent } from './utils/helpers'

describe('AgentController', () => {
  let app: Express
  let agent: Agent

  before(async () => {
    agent = await getTestAgent('Agent REST Agent Test', 3001)
    app = await setupServer(agent, { port: 3000 })
  })

  describe('Get agent info', () => {
    test('should return agent information', async () => {
      const response = await request(app).get('/agent')

      expect(response.body).to.have.property('label')
      expect(response.body).to.have.property('endpoints')
      expect(response.body.isInitialized).to.be.true
    })

    test('should response with a 200 status code', async () => {
      const response = await request(app).get('/agent')

      expect(response.statusCode).to.equal(200)
    })
  })

  after(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })
})
