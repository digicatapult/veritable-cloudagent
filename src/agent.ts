import {
  type InitConfig,
  HttpOutboundTransport,
  WsOutboundTransport,
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  ModulesMap,
  ConnectionsModule,
  ProofsModule,
  V2ProofProtocol,
  CredentialsModule,
  V2CredentialProtocol,
  MediatorModule,
} from '@credo-ts/core'
import { agentDependencies, HttpInboundTransport, WsInboundTransport } from '@credo-ts/node'
import { container } from 'tsyringe'
import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsProofFormatService,
  AnonCredsRequestProofFormat,
} from '@credo-ts/anoncreds'
import { DrpcModule } from '@credo-ts/drpc'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import { VerifiedDrpcModule, VerifiedDrpcModuleConfigOptions } from './modules/verified-drpc/index.js'
import DrpcReceiveHandler, { verifiedDrpcRequestHandler } from './drpc-handler/index.js'
import VeritableAnonCredsRegistry from './anoncreds/index.js'
import Ipfs from './ipfs/index.js'
import { AskarModule } from '@credo-ts/askar'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import PinoLogger from './utils/logger.js'

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

export type AriesRestConfig = {
  agentConfig: InitConfig

  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]

  autoAcceptConnections?: boolean
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptMediationRequests?: boolean
  autoAcceptProofs?: AutoAcceptProof
  ipfsOrigin: string

  verifiedDrpcOptions: VerifiedDrpcModuleConfigOptions

  logger: PinoLogger
}

export interface RestAgentModules extends ModulesMap {
  connections: ConnectionsModule
  proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
  credentials: CredentialsModule<[V2CredentialProtocol<[AnonCredsCredentialFormatService]>]>
  anoncreds: AnonCredsModule
  drpc: DrpcModule
  verifiedDrpc: VerifiedDrpcModule
}

export type RestAgent<
  modules extends RestAgentModules = {
    connections: ConnectionsModule
    proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
    credentials: CredentialsModule<[V2CredentialProtocol]>
    anoncreds: AnonCredsModule
    drpc: DrpcModule
    verifiedDrpc: VerifiedDrpcModule
  },
> = Agent<modules>

const getAgentModules = (options: {
  autoAcceptConnections: boolean
  autoAcceptProofs: AutoAcceptProof
  autoAcceptCredentials: AutoAcceptCredential
  autoAcceptMediationRequests: boolean
  ipfsOrigin: string
  verifiedDrpcOptions: { credDefId?: string; issuerDid?: string } & VerifiedDrpcModuleConfigOptions
}): RestAgentModules => {
  return {
    connections: new ConnectionsModule({
      autoAcceptConnections: options.autoAcceptConnections,
    }),
    proofs: new ProofsModule({
      autoAcceptProofs: options.autoAcceptProofs,
      proofProtocols: [
        new V2ProofProtocol({
          proofFormats: [new AnonCredsProofFormatService()],
        }),
      ],
    }),
    credentials: new CredentialsModule({
      autoAcceptCredentials: options.autoAcceptCredentials,
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: [new AnonCredsCredentialFormatService()],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new VeritableAnonCredsRegistry(new Ipfs(options.ipfsOrigin))],
      anoncreds,
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    mediator: new MediatorModule({
      autoAcceptMediationRequests: options.autoAcceptMediationRequests,
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
    autoAcceptCredentials = AutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests = true,
    autoAcceptProofs = AutoAcceptProof.ContentApproved,
    ipfsOrigin,
    verifiedDrpcOptions,

    agentConfig,
  } = restConfig

  const modules = getAgentModules({
    autoAcceptConnections,
    autoAcceptProofs,
    autoAcceptCredentials,
    autoAcceptMediationRequests,
    ipfsOrigin,
    verifiedDrpcOptions,
  })

  const agent: RestAgent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules,
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

  container.register(Agent, { useValue: agent as Agent })

  const existingSecrets = await agent.modules.anoncreds.getLinkSecretIds()
  if (existingSecrets.length === 0) {
    await agent.modules.anoncreds.createLinkSecret({
      setAsDefault: true,
    })
  }

  agent.modules.verifiedDrpc.addRequestListener(verifiedDrpcRequestHandler)

  const drpcReceiveHandler = container.resolve(DrpcReceiveHandler)
  await drpcReceiveHandler.start()

  return agent
}
