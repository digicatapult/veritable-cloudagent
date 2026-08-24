import { expect } from 'chai'
import { afterEach, describe, test } from 'mocha'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import WebSocket from 'ws'

import { startCloudagent } from '../../src/bootstrap.js'
import type { Env } from '../../src/env.js'
import PinoLogger from '../../src/utils/logger.js'
import { deleteAgentStore } from './utils/helpers.js'

const getAvailablePort = async () => {
  const server = createServer()

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : undefined

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

  if (!port) {
    throw new Error('Unable to allocate test port')
  }

  return port
}

const createTestEnv = async (walletId?: string) => {
  const adminPort = await getAvailablePort()
  const didcommHttpPort = await getAvailablePort()
  const didcommWsPort = await getAvailablePort()
  const didWebPort = await getAvailablePort()

  const values: Record<string, unknown> = {
    LABEL: 'Test Agent',
    WALLET_ID: walletId ?? randomUUID(),
    WALLET_KEY: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa',
    ENDPOINT: [`http://localhost:${didcommHttpPort}`, `ws://localhost:${didcommWsPort}`],
    LOG_LEVEL: 'silent',
    USE_DID_SOV_PREFIX_WHERE_ALLOWED: true,
    USE_DID_KEY_IN_PROTOCOLS: true,
    OUTBOUND_TRANSPORT: ['http', 'ws'],
    INBOUND_TRANSPORT: [
      { transport: 'http', port: didcommHttpPort },
      { transport: 'ws', port: didcommWsPort },
    ],
    AUTO_ACCEPT_CONNECTIONS: true,
    AUTO_ACCEPT_CREDENTIALS: 'always',
    AUTO_ACCEPT_MEDIATION_REQUESTS: false,
    AUTO_ACCEPT_PROOFS: 'always',
    AUTO_UPDATE_STORAGE_ON_STARTUP: true,
    BACKUP_BEFORE_STORAGE_UPDATE: false,
    CONNECTION_IMAGE_URL: 'https://image.com/image.png',
    WEBHOOK_URL: [],
    ADMIN_PORT: adminPort,
    ADMIN_PING_INTERVAL_MS: 1000,
    IPFS_ORIGIN: 'http://localhost:5001',
    IPFS_TIMEOUT_MS: 15000,
    PERSONA_TITLE: 'Test Persona',
    PERSONA_COLOR: 'white',
    STORAGE_TYPE: 'sqlite',
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5432,
    POSTGRES_USERNAME: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    VERIFIED_DRPC_OPTIONS_PROOF_TIMEOUT_MS: 500,
    VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS: 500,
    VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS: {
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          name: 'drpc-proof-request',
          version: '1.0',
          requested_attributes: {
            companiesHouseNumberExists: {
              name: 'companiesHouseNumber',
            },
          },
        },
      },
    },
    DID_WEB_SERVICE_ENDPOINT: '',
    DID_WEB_ENABLED: false,
    DID_WEB_PORT: didWebPort,
    DID_WEB_USE_DEV_CERT: false,
    DID_WEB_DEV_CERT_PATH: '',
    DID_WEB_DEV_KEY_PATH: '',
    DID_WEB_DB_NAME: 'did-web-server',
    DID_WEB_DOMAIN: 'localhost%3A8443',
  }

  const env = {
    get: <T extends string>(key: T) => values[key],
  }

  return {
    env: env as unknown as Env,
    ports: {
      adminPort,
      didcommHttpPort,
      didcommWsPort,
      didWebPort,
    },
  }
}

describe('startCloudagent lifecycle', () => {
  const handles: Awaited<ReturnType<typeof startCloudagent>>[] = []

  afterEach(async () => {
    while (handles.length > 0) {
      const handle = handles.pop()!
      try {
        await handle.shutdown()
      } catch {
        // ignore errors during test cleanup
      }
      await deleteAgentStore(handle.agent)
    }
  })

  test('should start and shutdown idempotently', async () => {
    const { env } = await createTestEnv()
    const handle = await startCloudagent(env, new PinoLogger('silent'))
    handles.push(handle)

    expect(handle.adminServer.listening).to.equal(true)

    await handle.shutdown()
    expect(handle.adminServer.listening).to.equal(false)

    // shutdown must be idempotent
    await handle.shutdown()

    await deleteAgentStore(handle.agent)
    handles.pop()
  })

  test('should shutdown with active didcomm websocket client', async function () {
    this.timeout(15000)

    const { env, ports } = await createTestEnv()
    const handle = await startCloudagent(env, new PinoLogger('silent'))
    handles.push(handle)

    const client = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${ports.didcommWsPort}`)
      ws.once('open', () => resolve(ws))
      ws.once('error', (error) => reject(error))
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('shutdown timed out with connected ws client')), 5000)
    })

    await Promise.race([handle.shutdown(), timeoutPromise])

    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.terminate()
    }

    await deleteAgentStore(handle.agent)
    handles.pop()
  })

  test('should restart on the same wallet store', async () => {
    const { env: env1 } = await createTestEnv()
    const walletId = env1.get('WALLET_ID')

    // First start
    const handle1 = await startCloudagent(env1, new PinoLogger('silent'))
    handles.push(handle1)

    expect(handle1.adminServer.listening).to.equal(true)
    const firstLinkSecrets = await handle1.agent.modules.anoncreds.getLinkSecretIds()

    await handle1.shutdown()
    expect(handle1.adminServer.listening).to.equal(false)

    // Second start with same wallet ID, different ports
    const { env: env2 } = await createTestEnv(walletId as string)
    const handle2 = await startCloudagent(env2, new PinoLogger('silent'))
    handles.push(handle2)

    expect(handle2.adminServer.listening).to.equal(true)
    const secondLinkSecrets = await handle2.agent.modules.anoncreds.getLinkSecretIds()

    // Verify wallet data persisted across restart
    expect(secondLinkSecrets.length).to.equal(firstLinkSecrets.length)
    if (firstLinkSecrets.length > 0) {
      expect(secondLinkSecrets[0]).to.equal(firstLinkSecrets[0])
    }

    await handle2.shutdown()
    await deleteAgentStore(handle2.agent)
    handles.pop()
  })
})
