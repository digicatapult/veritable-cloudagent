import { runRestAgent, type AriesRestConfig } from './cliAgent.js'
import type { AskarWalletPostgresStorageConfig } from '@credo-ts/askar'
import { Env } from './env.js'
import { container } from 'tsyringe'
const env = container.resolve(Env)

export async function runCliServer() {
  await runRestAgent({
    label: env.get('LABEL'),
    walletConfig: {
      id: env.get('WALLET_ID'),
      key: env.get('WALLET_KEY'),
      storage:
        env.get('STORAGE_TYPE') === 'sqlite'
          ? {
              type: 'sqlite',
            }
          : ({
              type: 'postgres',
              config: {
                host: `${env.get('POSTGRES_HOST') as string}:${env.get('POSTGRES_PORT') as string}`,
              },
              credentials: {
                account: env.get('POSTGRES_USERNAME') as string,
                password: env.get('POSTGRES_PASSWORD') as string,
              },
            } satisfies AskarWalletPostgresStorageConfig),
    },
    endpoints: env.get('ENDPOINT'),
    autoAcceptConnections: env.get('AUTO_ACCEPT_CONNECTIONS'),
    autoAcceptCredentials: env.get('AUTO_ACCEPT_CREDENTIALS'),
    autoAcceptProofs: env.get('AUTO_ACCEPT_PROOFS'),
    autoUpdateStorageOnStartup: env.get('AUTO_UPDATE_STORAGE_ON_STARTUP'),
    backupBeforeStorageUpdate: env.get('BACKUP_BEFORE_STORAGE_UPDATE'),
    autoAcceptMediationRequests: env.get('AUTO_ACCEPT_MEDIATION_REQUESTS'),
    useDidKeyInProtocols: env.get('USE_DID_KEY_IN_PROTOCOLS'),
    useDidSovPrefixWhereAllowed: env.get('USE_DID_SOV_PREFIX_WHERE_ALLOWED'),
    logLevel: env.get('LOG_LEVEL'),
    inboundTransports: env.get('INBOUND_TRANSPORT'),
    outboundTransports: env.get('OUTBOUND_TRANSPORT'),
    connectionImageUrl: env.get('CONNECTION_IMAGE_URL'),
    webhookUrl: env.get('WEBHOOK_URL'),
    adminPort: env.get('ADMIN_PORT'),
    ipfsOrigin: env.get('IPFS_ORIGIN'),
    opaOrigin: env.get('OPA_ORIGIN'),
    personaTitle: env.get('PERSONA_TITLE'),
    personaColor: env.get('PERONA_COLOR'),
    verifiedDrpcOptions: {
      proofTimeoutMs: env.get('VERIFIED_DRPC_OPTOPNS_PROOF_TIMEOUT_MS'),
      requestTimeoutMs: env.get('VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS'),
      credDefId: env.get('VERIFIED_DRPC_OPTIONS_CRED_DEF_ID'),
      proofRequestOptions: env.get('VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS'),
    },
  } as AriesRestConfig)
}
