import { runRestAgent, type InboundTransport, type Transports, type AriesRestConfig } from './cliAgent.js'
import type { AskarWalletPostgresStorageConfig } from '@credo-ts/askar'
import { Env } from './env.js'
import { container } from 'tsyringe'
import * as envalid from 'envalid'
const env = container.resolve(Env)
// const splitFlat = (i: string[]) => i.map((i) => i.split(' ')).flat()

// const parsed = yargs(hideBin(process.argv))
//   .command('start', 'Start AFJ Rest agent')
//   .parserConfiguration({ 'parse-numbers': false })
//   .option('label', {
//     alias: 'l',
//     string: true,
//     demandOption: true,
//   })
//   .option('wallet-id', {
//     string: true,
//     demandOption: true,
//   })
//   .option('wallet-key', {
//     string: true,
//     demandOption: true,
//   })
//   .option('endpoint', {
//     array: true,
//     coerce: splitFlat,
//   })
//   .option('log-level', {
//     number: true,
//     default: 3,
//   })
//   .option('use-did-sov-prefix-where-allowed', {
//     boolean: true,
//     default: false,
//   })
//   .option('use-did-key-in-protocols', {
//     boolean: true,
//     default: true,
//   })
//   .option('outbound-transport', {
//     default: [],
//     choices: ['http', 'ws'],
//     array: true,
//     coerce: splitFlat,
//   })
//   .option('inbound-transport', {
//     array: true,
//     default: [],
//     coerce: (inputRaw: string[]) => {
//       // Configured using config object
//       if (typeof inputRaw[0] === 'object') return inputRaw

//       const input = splitFlat(inputRaw)
//       if (input.length % 2 !== 0) {
//         throw new Error(
//           'Inbound transport should be specified as transport port pairs (e.g. --inbound-transport http 5002 ws 5003)'
//         )
//       }

//       return input.reduce<Array<InboundTransport>>((transports, item, index) => {
//         const isEven = index % 2 === 0
//         // isEven means it is the transport
//         // transport port transport port
//         const isTransport = isEven

//         if (isTransport) {
//           transports.push({
//             transport: item as Transports,
//             port: Number(input[index + 1]),
//           })
//         }

//         return transports
//       }, [])
//     },
//   })
//   .option('auto-accept-connections', {
//     boolean: true,
//     default: false,
//   })
//   .option('auto-accept-credentials', {
//     choices: ['always', 'never', 'contentApproved'],
//     default: 'never',
//   })
//   .option('auto-accept-mediation-requests', {
//     boolean: true,
//     default: false,
//   })
//   .option('auto-accept-proofs', {
//     choices: ['always', 'never', 'contentApproved'],
//     default: 'never',
//   })
//   .option('auto-update-storage-on-startup', {
//     boolean: true,
//     default: true,
//   })
//   .option('backup-before-storage-update', {
//     boolean: true,
//     default: false,
//   })
//   .option('connection-image-url', {
//     string: true,
//   })
//   .option('webhook-url', {
//     string: true,
//     array: true,
//     coerce: splitFlat,
//   })
//   .option('admin-port', {
//     number: true,
//     demandOption: true,
//   })
//   .option('ipfs-origin', {
//     string: true,
//     demandOption: true,
//   })
//   .option('persona-title', {
//     string: true,
//     default: 'Veritable Cloudagent',
//   })
//   .option('persona-color', {
//     string: true,
//     default: 'white',
//   })
//   .option('opa-origin', {
//     string: true,
//     default: 'http://localhost:8181',
//   })
//   .option('storage-type', {
//     choices: ['sqlite', 'postgres'] as const,
//     default: 'postgres',
//   })
//   .option('postgres-host', {
//     string: true,
//   })
//   .option('postgres-port', {
//     string: true,
//   })
//   .option('postgres-username', {
//     string: true,
//   })
//   .option('postgres-password', {
//     string: true,
//   })
//   .option('verified-drpc-options.proof-timeout-ms', {
//     number: true,
//     default: 5000,
//   })
//   .option('verified-drpc-options.request-timeout-ms', {
//     number: true,
//     default: 5000,
//   })
//   .option('verified-drpc-options.proof-request-options', {
//     coerce: JSON.parse,
//   })
//   .option('verified-drpc-options.cred-def-id', {
//     string: true,
//   })
//   .check((argv) => {
//     if (
//       argv['storage-type'] === 'postgres' &&
//       (!argv['postgres-host'] || !argv['postgres-port'] || !argv['postgres-username'] || !argv['postgres-password'])
//     ) {
//       throw new Error(
//         "--postgres-host,--postgres-port, --postgres-username, and postgres-password are required when setting --storage-type to 'postgres'"
//       )
//     }

//     return true
//   })
//   .check((argv) => {
//     if (argv['storage-type'] === 'postgres' && argv['backup-before-storage-update'] == true) {
//       throw new Error("--backup-before-storage-update needs to be set to 'false' when using postgres database")
//     }

//     return true
//   })
//   .config()
//   .env('AFJ_REST')
//   .parseSync()
const stringToArray = (input:string,allowedVals:string[]|''='')=> {
  console.log(input)
  console.log(allowedVals)
  const arr = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !!s)
  console.log('arr')
  console.log(arr)

    if (allowedVals===''){
    const isValid = arr.every(item => allowedVals.includes(item));
  
    if (!isValid) {
      throw new Error(`Array can only contain ${allowedVals.toString()}`);
    }
  }
    if (arr.length === 0 || arr.length > 2) {
      console.log('console logging')
      console.log(input)
      console.log(allowedVals)
      throw new Error(`Array must contain at least one and at most two elements, you provided: ${input}`);
    }
  

return arr as Transports[]
}

export async function runCliServer() {
  await runRestAgent({
    label: env.get('LABEL'),
    walletConfig: {
      id:  env.get('WALLET_ID'),
      key:  env.get('WALLET_KEY'),
      storage:
      env.get('STORAGE_TYPE') === 'sqlite'
          ? {
              type: 'sqlite',
            }
          : ({
              type: 'postgres',
              config: {
                host: `${ env.get('POSTGRES_HOST') as string}:${ env.get('POSTGRES_PORT') as string}`,
              },
              credentials: {
                account:  env.get('POSTGRES_USERNAME') as string,
                password:  env.get('POSTGRES_PASSWORD') as string,
              },
            } satisfies AskarWalletPostgresStorageConfig),
    },
    endpoints:  env.get('ENDPOINT'),
    autoAcceptConnections:  env.get('AUTO_ACCEPT_CONNECTIONS'),
    autoAcceptCredentials: env.get('AUTO_ACCEPT_CREDENTIALS'),
    autoAcceptProofs: env.get('AUTO_ACCEPT_PROOFS'),
    autoUpdateStorageOnStartup: env.get('AUTO_UPDATE_STORAGE_ON_STARTUP'),
    backupBeforeStorageUpdate: env.get('BACKUP_BEFORE_STORAGE_UPDATE') ,
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
      "proofTimeoutMs": env.get('VERIFIED_DRPC_OPTOPNS_PROOF_TIMEOUT_MS'),
      "requestTimeoutMs": env.get('VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS'),
      "credDefId": env.get('VERIFIED_DRPC_OPTIONS_CRED_DEF_ID'),
      "proofRequestOptions": env.get('VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS')
    },
  } as AriesRestConfig)
}
