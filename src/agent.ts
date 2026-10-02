// Must import before @credo-ts/anoncreds
import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
  AnonCredsModule,
  AnonCredsRequestProofFormat,
} from '@credo-ts/anoncreds'
import {
  Agent,
  DidsModule,
  KeyDidResolver,
  PeerDidResolver,
  W3cCredentialsModule,
  WebDidResolver,
  type InitConfig,
  type ModulesMap,
} from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommHttpOutboundTransport,
  DidCommJsonLdCredentialFormatService,
  DidCommModule,
  DidCommProofV2Protocol,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { DrpcModule } from '@credo-ts/drpc'
import { agentDependencies, DidCommHttpInboundTransport, DidCommWsInboundTransport } from '@credo-ts/node'
import { askarNodeJS } from '@openwallet-foundation/askar-nodejs'
import type { Express } from 'express'
import { container } from 'tsyringe'
import type { WebSocketServer } from 'ws'

import { AskarModule, type AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import VeritableAnonCredsRegistry from './anoncreds/index.js'
import type { CredentialDefinitionId, DID } from './controllers/types/index.js'
import DrpcReceiveHandler, { verifiedDrpcRequestHandler } from './drpc-handler/index.js'
import Ipfs from './ipfs/index.js'
import { VerifiedDrpcModule, VerifiedDrpcModuleConfigOptions } from './modules/verified-drpc/index.js'
import PinoLogger from './utils/logger.js'

export type Transports = 'ws' | 'http'
export type InboundTransport =
  | {
      transport: 'http'
      port?: number
    }
  | {
      transport: 'ws'
      port: number
    }

type AgentProofProtocols = [
  DidCommProofV2Protocol<[AnonCredsDidCommProofFormatService, DidCommDifPresentationExchangeProofFormatService]>,
]

const outboundTransportMapping = {
  http: DidCommHttpOutboundTransport,
  ws: DidCommWsOutboundTransport,
} as const

export type AriesRestConfig = {
  agentConfig: InitConfig & {
    endpoints: string[]
    autoUpdateStorageOnStartup?: boolean
    useDidKeyInProtocols?: boolean
    useDidSovPrefixWhereAllowed?: boolean
  }
  askarStoreConfig: AskarModuleConfigStoreOptions

  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]

  autoAcceptConnections?: boolean
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptMediationRequests?: boolean
  autoAcceptProofs?: DidCommAutoAcceptProof
  ipfsOrigin: string
  ipfsTimeoutMs: number

  verifiedDrpcOptions: VerifiedDrpcModuleConfigOptions<AgentProofProtocols>
  didcommHttpApp?: Express
  didcommWsSocketServers?: WebSocketServer[]

  logger: PinoLogger
}

export interface RestAgentModules extends ModulesMap {
  didcomm: DidCommModule
  dids: DidsModule
  w3cCredentials: W3cCredentialsModule
  anoncreds: AnonCredsModule
  askar: AskarModule
  drpc: DrpcModule
  verifiedDrpc: VerifiedDrpcModule<AgentProofProtocols>
}

export type RestAgent<
  modules extends RestAgentModules = {
    didcomm: DidCommModule
    dids: DidsModule
    w3cCredentials: W3cCredentialsModule
    anoncreds: AnonCredsModule
    askar: AskarModule
    drpc: DrpcModule
    verifiedDrpc: VerifiedDrpcModule<AgentProofProtocols>
  },
> = Agent<modules>

const getAgentModules = (options: {
  didcommConfig: {
    endpoints: string[]
    useDidSovPrefixWhereAllowed?: boolean
    useDidKeyInProtocols?: boolean
  }
  autoAcceptConnections: boolean
  autoAcceptProofs: DidCommAutoAcceptProof
  autoAcceptCredentials: DidCommAutoAcceptCredential
  autoAcceptMediationRequests: boolean
  ipfsOrigin: string
  ipfsTimeoutMs: number
  verifiedDrpcOptions: {
    credDefId?: CredentialDefinitionId
    issuerDid?: DID
  } & VerifiedDrpcModuleConfigOptions<AgentProofProtocols>
  askarStoreConfig: AskarModuleConfigStoreOptions
}): RestAgentModules => {
  return {
    askar: new AskarModule({
      askar: askarNodeJS,
      store: options.askarStoreConfig,
    }),
    didcomm: new DidCommModule({
      endpoints: options.didcommConfig.endpoints,
      useDidSovPrefixWhereAllowed: options.didcommConfig.useDidSovPrefixWhereAllowed,
      useDidKeyInProtocols: options.didcommConfig.useDidKeyInProtocols,
      connections: {
        autoAcceptConnections: options.autoAcceptConnections,
      },
      proofs: {
        autoAcceptProofs: options.autoAcceptProofs,
        proofProtocols: [
          new DidCommProofV2Protocol({
            proofFormats: [
              new AnonCredsDidCommProofFormatService(),
              new DidCommDifPresentationExchangeProofFormatService(),
            ],
          }),
        ],
      },
      credentials: {
        autoAcceptCredentials: options.autoAcceptCredentials,
        credentialProtocols: [
          new DidCommCredentialV2Protocol({
            credentialFormats: [
              new AnonCredsDidCommCredentialFormatService(),
              new DidCommJsonLdCredentialFormatService(),
            ],
          }),
        ],
      },
      mediator: {
        autoAcceptMediationRequests: options.autoAcceptMediationRequests,
      },
    }),
    dids: new DidsModule({
      resolvers: [new WebDidResolver(), new PeerDidResolver(), new KeyDidResolver()],
    }),
    w3cCredentials: new W3cCredentialsModule(),
    anoncreds: new AnonCredsModule({
      registries: [new VeritableAnonCredsRegistry(new Ipfs(options.ipfsOrigin, options.ipfsTimeoutMs))],
      anoncreds,
    }),
    drpc: new DrpcModule(),
    verifiedDrpc: new VerifiedDrpcModule(
      (() => {
        const { credDefId, issuerDid, ...rest } = options.verifiedDrpcOptions
        if (credDefId || issuerDid) {
          const anoncredsProofFormat = rest.proofRequestOptions.proofFormats?.[
            'anoncreds'
          ] as AnonCredsRequestProofFormat
          if (anoncredsProofFormat.requested_attributes) {
            for (const attribute of Object.values(anoncredsProofFormat.requested_attributes)) {
              if (!attribute.restrictions) {
                attribute.restrictions = [{}]
              }
              attribute.restrictions = attribute.restrictions.map((restriction) => {
                return {
                  ...restriction,
                  ...(credDefId ? { cred_def_id: credDefId } : {}),
                  ...(issuerDid ? { issuer_did: issuerDid } : {}),
                }
              })
            }
          }
        }
        return rest
      })()
    ),
  }
}

export async function setupAgent(restConfig: AriesRestConfig) {
  const {
    inboundTransports = [],
    outboundTransports = [],

    autoAcceptConnections = true,
    autoAcceptCredentials = DidCommAutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests = true,
    autoAcceptProofs = DidCommAutoAcceptProof.ContentApproved,
    ipfsOrigin,
    ipfsTimeoutMs,
    verifiedDrpcOptions,
    didcommHttpApp,
    didcommWsSocketServers = [],
    logger,

    agentConfig,
    askarStoreConfig,
  } = restConfig

  const modules = getAgentModules({
    didcommConfig: {
      endpoints: agentConfig.endpoints,
      useDidSovPrefixWhereAllowed: agentConfig.useDidSovPrefixWhereAllowed,
      useDidKeyInProtocols: agentConfig.useDidKeyInProtocols,
    },
    autoAcceptConnections,
    autoAcceptProofs,
    autoAcceptCredentials,
    autoAcceptMediationRequests,
    ipfsOrigin,
    ipfsTimeoutMs,
    verifiedDrpcOptions,
    askarStoreConfig,
  })

  const agent: RestAgent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules,
  })

  // Register outbound transports
  for (const outboundTransport of outboundTransports) {
    const OutboundTransport = outboundTransportMapping[outboundTransport]
    agent.didcomm.registerOutboundTransport(new OutboundTransport())
  }

  // Register inbound transports
  let wsSocketServerIndex = 0
  let externalHttpAppAssigned = false
  let drpcReceiveHandler: DrpcReceiveHandler | undefined
  for (const inboundTransport of inboundTransports) {
    if (inboundTransport.transport === 'http') {
      if (didcommHttpApp && !externalHttpAppAssigned && inboundTransport.port !== undefined) {
        agent.didcomm.registerInboundTransport(
          new DidCommHttpInboundTransport({ app: didcommHttpApp, processedMessageListenerTimeoutMs: 30000 })
        )
        externalHttpAppAssigned = true
      } else if (inboundTransport.port !== undefined) {
        agent.didcomm.registerInboundTransport(
          new DidCommHttpInboundTransport({ port: inboundTransport.port, processedMessageListenerTimeoutMs: 30000 })
        )
      } else {
        throw new Error('An HTTP inbound transport requires either an Express app or a port')
      }
      continue
    }

    const didcommWsSocketServer = didcommWsSocketServers[wsSocketServerIndex]
    wsSocketServerIndex += 1
    if (didcommWsSocketServer) {
      agent.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ server: didcommWsSocketServer }))
      continue
    }

    agent.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ port: inboundTransport.port }))
  }

  try {
    await agent.initialize()

    container.register(Agent, { useValue: agent as Agent })

    const existingSecrets = await agent.modules.anoncreds.getLinkSecretIds()
    if (existingSecrets.length === 0) {
      await agent.modules.anoncreds.createLinkSecret({
        setAsDefault: true,
      })
    }

    agent.modules.verifiedDrpc.addRequestListener(verifiedDrpcRequestHandler)

    // Construct and register explicitly to avoid resolving a stale singleton bound to a previous agent.
    drpcReceiveHandler = new DrpcReceiveHandler(agent, logger)
    container.register(DrpcReceiveHandler, { useValue: drpcReceiveHandler })
    drpcReceiveHandler.start()
  } catch (error) {
    if (drpcReceiveHandler) {
      try {
        await drpcReceiveHandler.stop()
      } catch (cleanupError) {
        logger.error('Failed to stop DRPC receive handler after agent initialization failure', { cleanupError })
      }
    }

    try {
      await agent.shutdown()
    } catch (cleanupError) {
      logger.error('Failed to shut down agent after initialization failure', { cleanupError })
    }
    throw error
  }

  return agent
}
