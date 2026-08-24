import { expect } from 'chai'
import { afterEach, before, describe, test } from 'mocha'
import { randomUUID } from 'node:crypto'
import { restore as sinonRestore, stub as sinonStub } from 'sinon'
import WebSocket from 'ws'

import { startCloudagent } from '../../src/bootstrap.js'
import DrpcReceiveHandler from '../../src/drpc-handler/index.js'
import type { Env } from '../../src/env.js'
import PinoLogger from '../../src/utils/logger.js'
import { closeServer, connectWebSocket, deleteAgentStore, getAvailablePort, occupyPort } from './utils/helpers.js'

const createTestEnv = async (walletId?: string, options?: { didWebEnabled?: boolean; secondWsPort?: number }) => {
  const adminPort = await getAvailablePort()
  const didcommHttpPort = await getAvailablePort()
  const didcommWsPort = await getAvailablePort()
  const didWebPort = await getAvailablePort()

  const endpoints = [`http://localhost:${didcommHttpPort}`, `ws://localhost:${didcommWsPort}`]
  const inboundTransport: Array<{ transport: string; port: number }> = [
    { transport: 'http', port: didcommHttpPort },
    { transport: 'ws', port: didcommWsPort },
  ]

  if (options?.secondWsPort) {
    endpoints.push(`ws://localhost:${options.secondWsPort}`)
    inboundTransport.push({ transport: 'ws', port: options.secondWsPort })
  }

  const values: Record<string, unknown> = {
    LABEL: 'Test Agent',
    WALLET_ID: walletId ?? randomUUID(),
    WALLET_KEY: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa',
    ENDPOINT: endpoints,
    LOG_LEVEL: 'silent',
    USE_DID_SOV_PREFIX_WHERE_ALLOWED: true,
    USE_DID_KEY_IN_PROTOCOLS: true,
    OUTBOUND_TRANSPORT: ['http', 'ws'],
    INBOUND_TRANSPORT: inboundTransport,
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
    DID_WEB_ENABLED: options?.didWebEnabled ?? false,
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
  let logger: PinoLogger
  const handles: Awaited<ReturnType<typeof startCloudagent>>[] = []
  // Wallets created by a startup that failed later in the sequence, reopened here for deletion.
  const walletIdsToClean: string[] = []

  before(() => {
    logger = new PinoLogger('silent')
  })

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

    while (walletIdsToClean.length > 0) {
      const walletId = walletIdsToClean.pop()!
      const { env } = await createTestEnv(walletId)
      const handle = await startCloudagent(env, logger)
      expect(handle.adminServer.listening).to.equal(true)
      await handle.shutdown()
      expect(handle.adminServer.listening).to.equal(false)
      await deleteAgentStore(handle.agent)
    }
  })

  test('should start and shutdown idempotently', async () => {
    const { env } = await createTestEnv()
    const handle = await startCloudagent(env, logger)
    handles.push(handle)

    expect(handle.adminServer.listening).to.equal(true)

    await handle.shutdown()
    expect(handle.adminServer.listening).to.equal(false)

    // shutdown must be idempotent
    await handle.shutdown()
    expect(handle.adminServer.listening).to.equal(false)

    await deleteAgentStore(handle.agent)
    handles.pop()
  })

  test('should shutdown with active didcomm websocket client', async function () {
    this.timeout(15000)

    const { env, ports } = await createTestEnv()
    const handle = await startCloudagent(env, logger)
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
    const handle1 = await startCloudagent(env1, logger)
    handles.push(handle1)

    expect(handle1.adminServer.listening).to.equal(true)
    const firstLinkSecrets = await handle1.agent.modules.anoncreds.getLinkSecretIds()

    await handle1.shutdown()
    expect(handle1.adminServer.listening).to.equal(false)
    handles.pop()

    // Second start with same wallet ID, different ports
    const { env: env2 } = await createTestEnv(walletId as string)
    const handle2 = await startCloudagent(env2, logger)
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

  test('should reject startup and free ports when the admin port is already in use', async function () {
    this.timeout(15000)

    const { env, ports } = await createTestEnv()
    const walletId = env.get('WALLET_ID') as string
    const occupyingServer = await occupyPort(ports.adminPort)

    let thrownError: unknown
    try {
      await startCloudagent(env, logger)
    } catch (error) {
      thrownError = error
    } finally {
      await closeServer(occupyingServer)
    }

    expect(thrownError).to.be.instanceOf(Error)

    // The DIDComm ws port opened during the failed attempt must have been released.
    const verifyServer = await occupyPort(ports.didcommWsPort)
    await closeServer(verifyServer)

    walletIdsToClean.push(walletId)
  })

  test('should reject startup and free ports when the DID:web port is already in use', async function () {
    this.timeout(15000)

    const { env, ports } = await createTestEnv(undefined, { didWebEnabled: true })
    const walletId = env.get('WALLET_ID') as string
    const occupyingServer = await occupyPort(ports.didWebPort)

    let thrownError: unknown
    try {
      await startCloudagent(env, logger)
    } catch (error) {
      thrownError = error
    } finally {
      await closeServer(occupyingServer)
    }

    expect(thrownError).to.be.instanceOf(Error)

    // The admin port opened during the failed attempt must have been released.
    const verifyServer = await occupyPort(ports.adminPort)
    await closeServer(verifyServer)

    walletIdsToClean.push(walletId)
  })

  test('should reject startup and free ports when the DIDComm ws port is already in use', async function () {
    this.timeout(15000)

    const { env, ports } = await createTestEnv()
    const occupyingServer = await occupyPort(ports.didcommWsPort)

    let thrownError: unknown
    try {
      await startCloudagent(env, logger)
    } catch (error) {
      thrownError = error
    } finally {
      await closeServer(occupyingServer)
    }

    expect(thrownError).to.be.instanceOf(Error)

    // No wallet is created when the DIDComm ws server fails to bind before setupAgent() runs.
    const verifyServer = await occupyPort(ports.adminPort)
    await closeServer(verifyServer)
  })

  test('should shut down the agent when setupAgent() fails after agent initialisation', async function () {
    this.timeout(15000)

    const { env } = await createTestEnv()
    const walletId = env.get('WALLET_ID') as string
    const startStub = sinonStub(DrpcReceiveHandler.prototype, 'start').throws(new Error('drpc handler start failed'))

    let thrownError: unknown
    try {
      await startCloudagent(env, logger)
    } catch (error) {
      thrownError = error
    } finally {
      startStub.restore()
      sinonRestore()
    }

    expect(thrownError).to.be.instanceOf(Error)
    expect((thrownError as Error).message).to.equal('drpc handler start failed')

    walletIdsToClean.push(walletId)
  })

  test('should register independent servers for multiple ws inbound transport entries', async function () {
    this.timeout(15000)

    const secondWsPort = await getAvailablePort()
    const { env, ports } = await createTestEnv(undefined, { secondWsPort })
    const handle = await startCloudagent(env, logger)
    handles.push(handle)

    const firstClient = await connectWebSocket(ports.didcommWsPort)
    const secondClient = await connectWebSocket(secondWsPort)

    expect(firstClient.readyState).to.equal(WebSocket.OPEN)
    expect(secondClient.readyState).to.equal(WebSocket.OPEN)

    firstClient.terminate()
    secondClient.terminate()

    await handle.shutdown()
    await deleteAgentStore(handle.agent)
    handles.pop()
  })
})
