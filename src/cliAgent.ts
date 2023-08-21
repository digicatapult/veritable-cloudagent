import type { InitConfig } from '@aries-framework/core'
import type { WalletConfig } from '@aries-framework/core/build/types'

import { AnonCredsModule } from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { AskarModule } from '@aries-framework/askar'
import {
  HttpOutboundTransport,
  WsOutboundTransport,
  LogLevel,
  Agent,
  ConnectionsModule,
  ProofsModule,
  CredentialsModule,
  AutoAcceptCredential,
  AutoAcceptProof,
  MediatorModule,
} from '@aries-framework/core'

import { agentDependencies, HttpInboundTransport, WsInboundTransport } from '@aries-framework/node'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { readFile } from 'fs/promises'

import { setupServer } from './server'
import { TsLogger } from './utils/logger'
import VeritableAnonCredsRegistry from './anoncreds'
import Ipfs from './ipfs'

export type Transports = 'ws' | 'http'
export type InboundTransport = {
  transport: Transports
  port: number
}

const inboundTransportMapping = {
  http: HttpInboundTransport,
  ws: WsInboundTransport,
} as const

const outboundTransportMapping = {
  http: HttpOutboundTransport,
  ws: WsOutboundTransport,
} as const

export interface AriesRestConfig {
  label: string
  walletConfig: WalletConfig
  endpoints?: string[]
  autoAcceptConnections?: boolean
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  autoUpdateStorageOnStartup?: boolean
  useDidKeyInProtocols?: boolean
  useDidSovPrefixWhereAllowed?: boolean
  logLevel?: LogLevel
  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]
  autoAcceptMediationRequests?: boolean
  connectionImageUrl?: string

  webhookUrl?: string
  adminPort: number
  ipfsOrigin: string
}

export async function readRestConfig(path: string) {
  const configString = await readFile(path, { encoding: 'utf-8' })
  const config = JSON.parse(configString)

  return config
}

export async function runRestAgent(restConfig: AriesRestConfig) {
  const {
    logLevel,
    inboundTransports = [],
    outboundTransports = [],
    webhookUrl,
    adminPort,
    autoAcceptConnections = true,
    autoAcceptCredentials = AutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests = true,
    autoAcceptProofs = AutoAcceptProof.ContentApproved,
    ipfsOrigin,
    ...afjConfig
  } = restConfig

  const logger = new TsLogger(logLevel ?? LogLevel.error)

  const agentConfig: InitConfig = {
    ...afjConfig,
    logger,
  }

  const agent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules: {
      connections: new ConnectionsModule({
        autoAcceptConnections,
      }),
      proofs: new ProofsModule({
        autoAcceptProofs,
      }),
      credentials: new CredentialsModule({
        autoAcceptCredentials,
      }),
      anoncreds: new AnonCredsModule({
        registries: [new VeritableAnonCredsRegistry(new Ipfs(ipfsOrigin))],
      }),
      anoncredsRs: new AnonCredsRsModule({
        anoncreds,
      }),
      askar: new AskarModule({
        ariesAskar,
      }),
      mediator: new MediatorModule({
        autoAcceptMediationRequests,
      }),
    },
  })

  // Register outbound transports
  for (const outboundTransport of outboundTransports) {
    const OutboundTransport = outboundTransportMapping[outboundTransport]
    agent.registerOutboundTransport(new OutboundTransport())
  }

  // Register inbound transports
  for (const inboundTransport of inboundTransports) {
    const InboundTransport = inboundTransportMapping[inboundTransport.transport]
    agent.registerInboundTransport(new InboundTransport({ port: inboundTransport.port }))
  }

  await agent.initialize()
  const app = await setupServer(agent, {
    webhookUrl,
    port: adminPort,
  })

  app.listen(adminPort, () => {
    logger.info(`Successfully started server on port ${adminPort}`)
  })
}
