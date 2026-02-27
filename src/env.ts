import * as dotenv from 'dotenv'
import * as envalid from 'envalid'
import { makeValidator } from 'envalid'
import { singleton } from 'tsyringe'

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'tests/test.env' })
  dotenv.config({ override: true })
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

const stringArray = <T extends string = string>(
  spec: Parameters<envalid.BaseValidator<T[]>>['0'],
  options: {
    allowedValues?: Set<T>
  } = {}
) => {
  const validator = makeValidator((input: string | string[]) => {
    let values: string[]
    if (Array.isArray(input)) {
      values = input
    } else {
      if (typeof input !== 'string') {
        throw new Error('Invalid input type, expected a string')
      }
      try {
        values = input.split(',').map((s) => s.trim())
      } catch (err) {
        throw new Error(`Invalid input for string array ${err}`)
      }
    }
    const { allowedValues } = options
    if (allowedValues) {
      if (!values.every((v) => allowedValues.has(v as T))) {
        {
          throw new Error(`Invalid value for string array ${input}`)
        }
      }
    }
    return values as T[]
  })
  return validator(spec)
}

export const envConfig = {
  LABEL: envalid.str({ default: 'Veritable Cloudagent', devDefault: 'Veritable Cloudagent' }),
  WALLET_ID: envalid.str({ default: 'walletId', devDefault: 'walletId' }),
  WALLET_KEY: envalid.str({ default: 'walletKey', devDefault: 'walletKey' }),
  ENDPOINT: stringArray({
    default: ['http://localhost:5002', 'ws://localhost:5003'],
    devDefault: ['http://localhost:5002', 'ws://localhost:5003'],
  }),
  LOG_LEVEL: envalid.str({
    default: 'info',
    devDefault: 'debug',
    choices: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
  }),
  USE_DID_SOV_PREFIX_WHERE_ALLOWED: envalid.bool({ default: false, devDefault: true }),
  USE_DID_KEY_IN_PROTOCOLS: envalid.bool({ default: true, devDefault: true }),
  OUTBOUND_TRANSPORT: stringArray(
    { default: ['http', 'ws'], devDefault: ['http', 'ws'] },
    { allowedValues: new Set(['http', 'ws']) }
  ),
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
  WEBHOOK_URL: stringArray({
    default: [],
    devDefault: ['https://my-webhook-server'],
  }),
  ADMIN_PORT: envalid.num({ default: 3000, devDefault: 3000 }),
  ADMIN_PING_INTERVAL_MS: envalid.num({ default: 10000 }),
  IPFS_ORIGIN: envalid.str({ default: 'http://ipfs0:5001', devDefault: 'http://localhost:5001' }),
  IPFS_TIMEOUT_MS: envalid.num({ default: 15000, devDefault: 15000 }),
  PERSONA_TITLE: envalid.str({ default: 'Veritable Cloudagent' }),
  PERSONA_COLOR: envalid.str({ default: 'white' }),
  STORAGE_TYPE: envalid.str({ default: 'postgres', choices: ['sqlite', 'postgres'] }),
  POSTGRES_HOST: envalid.str({ default: 'postgres', devDefault: 'localhost' }),
  POSTGRES_PORT: envalid.port({ default: 5432, devDefault: 5432 }),
  POSTGRES_USERNAME: envalid.str({ default: 'postgres', devDefault: 'postgres' }),
  POSTGRES_PASSWORD: envalid.str({ default: 'postgres', devDefault: 'postgres' }),
  VERIFIED_DRPC_OPTIONS_PROOF_TIMEOUT_MS: envalid.num({ default: 5000, devDefault: 5000 }),
  VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS: envalid.num({ default: 5000, devDefault: 5000 }),
  VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS: envalid.json({
    default: JSON.parse(proofRequestOptions),
    devDefault: JSON.parse(proofRequestOptions),
  }),
  DID_WEB_SERVICE_ENDPOINT: envalid.str({
    default: '',
    devDefault: 'http://localhost:5002',
  }),
  DID_WEB_ENABLED: envalid.bool({ default: false }),
  DID_WEB_PORT: envalid.num({ default: 8443 }),
  DID_WEB_USE_DEV_CERT: envalid.bool({ default: false, devDefault: true }),
  DID_WEB_DEV_CERT_PATH: envalid.str({ default: '', devDefault: 'alice+1.pem' }),
  DID_WEB_DEV_KEY_PATH: envalid.str({ default: '', devDefault: 'alice+1-key.pem' }),
  DID_WEB_DB_NAME: envalid.str({ default: 'did-web-server' }),
  DID_WEB_DOMAIN: envalid.str({ default: '', devDefault: 'localhost%3A8443' }),
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
