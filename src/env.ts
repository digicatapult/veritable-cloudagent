import dotenv from 'dotenv'
import * as envalid from 'envalid'
import { singleton } from 'tsyringe'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'tests/test.env' }) //different configs for unit and integration??
} else {
  dotenv.config()
}
const proofRequestOptions = `{
    "protocolVersion": "v2",
    "proofFormats": {
      "anoncreds": {
        "name": "drpc-proof-request",
        "version": "1.0",
        "requested_attributes": {
          "companiesHouseNumberExists": {
            "name": "companiesHouseNumber"
          }
        }
      }
    }
  }`

const splitFlat = (i: string[]) => i.map((i) => i.split(' ')).flat()
const nonEmptyArrayValidator = envalid.makeValidator((input) => {
  const arr = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !!s)

  const first = arr.shift()
  if (first === undefined) {
    throw new Error('must provide at least one value in an array')
  }
  const res: [string, ...string[]] = [first, ...arr]
  return res
})

const envConfig = {
  LABEL: envalid.str({ default: 'AFJ Rest', devDefault: 'AFJ Rest Agent' }),
  WALLET_ID: envalid.str({ default: 'walletId', devDefault: 'walletId' }),
  WALLET_KEY: envalid.str({ default: 'walletKey', devDefault: 'walletKey' }),
  ENDPOINT: nonEmptyArrayValidator({
    default: ['http://localhost:5002', 'ws://localhost:5003'],
    devDefault: ['http://localhost:5002', 'ws://localhost:5003'],
  }),
  LOG_LEVEL: envalid.num({ default: 3, devDefault: 3 }),
  USE_DID_SOV_PREFIX_WHERE_ALLOWED: envalid.bool({ default: false, devDefault: true }),
  USE_DID_KEY_IN_PROTOCOLS: envalid.bool({ default: true, devDefault: true }),
  OUTBOUND_TRANSPORT: nonEmptyArrayValidator({ default: ['http', 'ws'], devDefault: ['http', 'ws'] }),
  INBOUND_TRANSPORT: envalid.json({
    default: JSON.parse('[{"transport": "http", "port": 5002}, {"transport": "ws", "port": 5003}]'),
    devDefault: JSON.parse('[{"transport": "http", "port": 5002}, {"transport": "ws", "port": 5003}]'),
  }),
  AUTO_ACCEPT_CONNECTIONS: envalid.bool({ default: false, devDefault: true }),
  AUTO_ACCEPT_CREDENTIALS: envalid.str({
    default: 'never',
    devDefault: 'always',
    choices: ['always', 'never', 'contentApproved'],
  }),
  AUTO_ACCEPT_MEDIATION_REQUESTS: envalid.bool({ default: false, devDefault: false }),
  AUTO_ACCEPT_PROOFS: envalid.str({
    default: 'never',
    devDefault: 'always',
    choices: ['always', 'never', 'contentApproved'],
  }),
  AUTO_UPDATE_STORAGE_ON_STARTUP: envalid.bool({ default: true }),
  BACKUP_BEFORE_STORAGE_UPDATE: envalid.bool({ default: false, devDefault: false }),
  CONNECTION_IMAGE_URL: envalid.str({
    default: 'https://image.com/image.png',
    devDefault: 'https://image.com/image.png',
  }),
  WEBHOOK_URL: nonEmptyArrayValidator({
    default: ['https://my-webhook-server'],
    devDefault: ['https://my-webhook-server'],
  }),
  ADMIN_PORT: envalid.num({ default: 3000, devDefault: 3000 }),
  IPFS_ORIGIN: envalid.str({ default: 'http://ipfs0:5001', devDefault: 'http://ipfs0:5001' }),
  PERSONA_TITLE: envalid.str({ default: 'Veritable Cloudagent' }),
  PERONA_COLOR: envalid.str({ default: 'white' }),
  OPA_ORIGIN: envalid.str({ default: 'http://localhost:8181' }),
  STORAGE_TYPE: envalid.str({ default: 'postgres', choices: ['sqlite', 'postgres'] }),
  POSTGRES_HOST: envalid.str({ default: 'postgres', devDefault: 'postgres' }),
  POSTGRES_PORT: envalid.str({ default: '5432', devDefault: '5432' }),
  POSTGRES_USERNAME: envalid.str({ default: 'postgres', devDefault: 'postgres' }),
  POSTGRES_PASSWORD: envalid.str({ default: 'postgres', devDefault: 'postgres' }),
  VERIFIED_DRPC_OPTOPNS_PROOF_TIMEOUT_MS: envalid.num({ default: 5000, devDefault: 5000 }),
  VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS: envalid.num({ default: 5000, devDefault: 5000 }),
  VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS: envalid.json({
    default: JSON.parse(proofRequestOptions),
    devDefault: JSON.parse(proofRequestOptions),
  }), //should be parsing?
  VERIFIED_DRPC_OPTIONS_CRED_DEF_ID: envalid.str({ default: 'some-cred-def-id', devDefault: 'some-cred-def-id' }), //finish up
}

export type ENV_CONFIG = typeof envConfig
export type ENV_KEYS = keyof ENV_CONFIG

@singleton()
export class Env {
  private vals: envalid.CleanedEnv<typeof envConfig>

  constructor() {
    this.vals = envalid.cleanEnv(process.env, envConfig)
  }

  get<K extends ENV_KEYS>(key: K) {
    return this.vals[key]
  }
}
