import { expect } from 'chai'
import { after, before, describe, test } from 'mocha'

import { randomUUID } from 'node:crypto'
import type { Server } from 'node:net'

import request from 'supertest'

import { setupAgent } from '../../src/agent.js'
import PinoLogger from '../../src/utils/logger.js'
import { deleteAgentStore, getTestAgent, getTestServer, type TestAgent } from './utils/helpers.js'

describe('AgentController', () => {
  let app: Server
  let agent: TestAgent

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

  describe('Agent Modules', () => {
    test('should have AnonCreds module registered', () => {
      expect(agent.modules).to.have.property('anoncreds')
    })

    test('should have W3C credentials module registered', () => {
      // W3cCredentialsModule is a core module in BaseAgent, so it is available directly on agent instance
      expect(agent).to.have.property('w3cCredentials')
    })
  })

  describe('Agent bootstrap idempotence', () => {
    const buildConfig = (storeId: string, port: number) => {
      const logger = new PinoLogger('silent')

      return {
        agentConfig: {
          label: `Agent bootstrap idempotence test (${randomUUID()})`,
          endpoints: [`http://localhost:${port}`],
          useDidSovPrefixWhereAllowed: true,
          logger,
          autoUpdateStorageOnStartup: true,
          backupBeforeStorageUpdate: false,
        },
        askarStoreConfig: {
          id: storeId,
          key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa',
          keyDerivationMethod: 'raw' as const,
          database: {
            type: 'sqlite' as const,
          },
        },
        inboundTransports: [
          {
            transport: 'http' as const,
            port,
          },
        ],
        outboundTransports: ['http' as const],
        logger,
        ipfsOrigin: 'https://localhost:5001',
        ipfsTimeoutMs: 15000,
        verifiedDrpcOptions: { proofRequestOptions: { protocolVersion: 'v2' as const, proofFormats: {} } },
      }
    }

    test('should not create additional link secrets when setupAgent runs twice for the same store', async () => {
      const storeId = randomUUID()
      let firstAgent: TestAgent | undefined
      let secondAgent: TestAgent | undefined

      try {
        firstAgent = await setupAgent(buildConfig(storeId, 3091))
        const firstRunLinkSecrets = await firstAgent.modules.anoncreds.getLinkSecretIds()
        expect(firstRunLinkSecrets).to.have.lengthOf(1)

        await firstAgent.shutdown()

        secondAgent = await setupAgent(buildConfig(storeId, 3092))
        const secondRunLinkSecrets = await secondAgent.modules.anoncreds.getLinkSecretIds()
        expect(secondRunLinkSecrets).to.have.lengthOf(1)
      } finally {
        if (secondAgent) {
          await secondAgent.shutdown()
          await deleteAgentStore(secondAgent)
        } else if (firstAgent) {
          await deleteAgentStore(firstAgent)
        }
      }
    })

    test('should remain idempotent across multiple setup and shutdown cycles for the same store', async () => {
      const storeId = randomUUID()
      let currentAgent: TestAgent | undefined
      let cleanupAgent: TestAgent | undefined

      try {
        for (let cycle = 0; cycle < 3; cycle++) {
          currentAgent = await setupAgent(buildConfig(storeId, 3093 + cycle))

          const linkSecretIds = await currentAgent.modules.anoncreds.getLinkSecretIds()
          expect(linkSecretIds).to.have.lengthOf(1)

          cleanupAgent = currentAgent
          await currentAgent.shutdown()
          currentAgent = undefined
        }
      } finally {
        if (currentAgent) {
          await currentAgent.shutdown()
          cleanupAgent = currentAgent
        }

        if (cleanupAgent) {
          await deleteAgentStore(cleanupAgent)
        }
      }
    })
  })

  after(async () => {
    await agent.shutdown()
    await deleteAgentStore(agent)
    app.close()
  })
})
