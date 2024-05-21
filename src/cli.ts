import { runRestAgent, type InboundTransport, type Transports, type AriesRestConfig } from './cliAgent.js'
import type { AskarWalletPostgresStorageConfig } from '@credo-ts/askar'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { CreateProofRequestOptions, ProofProtocol } from '@credo-ts/core'

import { transformProofFormat } from './utils/proofs.js'

const parsed = yargs(hideBin(process.argv))
  .command('start', 'Start AFJ Rest agent')
  .option('label', {
    alias: 'l',
    string: true,
    demandOption: true,
  })
  .option('wallet-id', {
    string: true,
    demandOption: true,
  })
  .option('wallet-key', {
    string: true,
    demandOption: true,
  })
  .option('endpoint', {
    array: true,
  })
  .option('log-level', {
    number: true,
    default: 3,
  })
  .option('use-did-sov-prefix-where-allowed', {
    boolean: true,
    default: false,
  })
  .option('use-did-key-in-protocols', {
    boolean: true,
    default: true,
  })
  .option('outbound-transport', {
    default: [],
    choices: ['http', 'ws'],
    array: true,
  })
  .option('inbound-transport', {
    array: true,
    default: [],
    coerce: (input: string[]) => {
      // Configured using config object
      if (typeof input[0] === 'object') return input
      if (input.length % 2 !== 0) {
        throw new Error(
          'Inbound transport should be specified as transport port pairs (e.g. --inbound-transport http 5002 ws 5003)'
        )
      }

      return input.reduce<Array<InboundTransport>>((transports, item, index) => {
        const isEven = index % 2 === 0
        // isEven means it is the transport
        // transport port transport port
        const isTransport = isEven

        if (isTransport) {
          transports.push({
            transport: item as Transports,
            port: Number(input[index + 1]),
          })
        }

        return transports
      }, [])
    },
  })
  .option('auto-accept-connections', {
    boolean: true,
    default: false,
  })
  .option('auto-accept-credentials', {
    choices: ['always', 'never', 'contentApproved'],
    default: 'never',
  })
  .option('auto-accept-mediation-requests', {
    boolean: true,
    default: false,
  })
  .option('auto-accept-proofs', {
    choices: ['always', 'never', 'contentApproved'],
    default: 'never',
  })
  .option('auto-update-storage-on-startup', {
    boolean: true,
    default: true,
  })
  .option('backup-before-storage-update', {
    boolean: true,
    default: false,
  })
  .option('connection-image-url', {
    string: true,
  })
  .option('webhook-url', {
    string: true,
  })
  .option('admin-port', {
    number: true,
    demandOption: true,
  })
  .option('ipfs-origin', {
    string: true,
    demandOption: true,
  })
  .option('persona-title', {
    string: true,
    default: 'Veritable Cloudagent',
  })
  .option('persona-color', {
    string: true,
    default: 'white',
  })
  .option('opa-origin', {
    string: true,
    default: 'http://localhost:8181',
  })
  .option('storage-type', {
    choices: ['sqlite', 'postgres'] as const,
    default: 'postgres',
  })
  .option('postgres-host', {
    string: true,
  })
  .option('postgres-port', {
    string: true,
  })
  .option('postgres-username', {
    string: true,
  })
  .option('postgres-password', {
    string: true,
  })
  .option('verified-drpc-options.proof-timeout-ms', {
    number: true,
    default: 5000,
  })
  .option('verified-drpc-options.request-timeout-ms', {
    number: true,
    default: 5000,
  })
  .option('verified-drpc-options.proof-request-options', {
    default: 5000,
    coerce: (input): CreateProofRequestOptions => {
      const { proofFormats, ...rest } = typeof input === 'object' ? input : JSON.parse(input)
      return {
        proofFormats: {
          anoncreds: transformProofFormat()
        },
        ...rest,
      }
    }
  })
  .check((argv) => {
    if (
      argv['storage-type'] === 'postgres' &&
      (!argv['postgres-host'] || !argv['postgres-port'] || !argv['postgres-username'] || !argv['postgres-password'])
    ) {
      throw new Error(
        "--postgres-host,--postgres-port, --postgres-username, and postgres-password are required when setting --storage-type to 'postgres'"
      )
    }

    return true
  })
  .check((argv) => {
    if (argv['storage-type'] === 'postgres' && argv['backup-before-storage-update'] == true) {
      throw new Error("--backup-before-storage-update needs to be set to 'false' when using postgres database")
    }

    return true
  })
  .config()
  .env('AFJ_REST')
  .parseSync()

export async function runCliServer() {
  await runRestAgent({
    label: parsed.label,
    walletConfig: {
      id: parsed['wallet-id'],
      key: parsed['wallet-key'],
      storage:
        parsed['storage-type'] === 'sqlite'
          ? {
              type: 'sqlite',
            }
          : ({
              type: 'postgres',
              config: {
                host: `${parsed['postgres-host'] as string}:${parsed['postgres-port'] as string}`,
              },
              credentials: {
                account: parsed['postgres-username'] as string,
                password: parsed['postgres-password'] as string,
              },
            } satisfies AskarWalletPostgresStorageConfig),
    },
    endpoints: parsed.endpoint,
    autoAcceptConnections: parsed['auto-accept-connections'],
    autoAcceptCredentials: parsed['auto-accept-credentials'],
    autoAcceptProofs: parsed['auto-accept-proofs'],
    autoUpdateStorageOnStartup: parsed['auto-update-storage-on-startup'],
    backupBeforeStorageUpdate: parsed['backup-before-storage-update'],
    autoAcceptMediationRequests: parsed['auto-accept-mediation-requests'],
    useDidKeyInProtocols: parsed['use-did-key-in-protocols'],
    useDidSovPrefixWhereAllowed: parsed['use-legacy-did-sov-prefix'],
    logLevel: parsed['log-level'],
    inboundTransports: parsed['inbound-transport'],
    outboundTransports: parsed['outbound-transport'],
    connectionImageUrl: parsed['connection-image-url'],
    webhookUrl: parsed['webhook-url'],
    adminPort: parsed['admin-port'],
    ipfsOrigin: parsed['ipfs-origin'],
    opaOrigin: parsed['opa-origin'],
    personaTitle: parsed['persona-title'],
    personaColor: parsed['persona-color'],
    verifiedDrpcOptions: parsed['verified-drpc-options'],
  } as AriesRestConfig)
}
