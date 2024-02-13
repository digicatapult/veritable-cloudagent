import type {
  AnonCredsRegistry,
  GetCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaReturn,
  AnonCredsSchema,
  RegisterSchemaOptions,
  AnonCredsResolutionMetadata,
  AnonCredsCredentialDefinition,
  RegisterCredentialDefinitionOptions,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'

import Ipfs from '../ipfs/index.js'

export default class VeritableAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'veritable'
  public readonly supportedIdentifier =
    /(?:^did:key:z[a-km-zA-HJ-NP-Z1-9]+$)|(?:^ipfs:\/\/([a-zA-Z0-9]+)$)|(?:^did:web:.+$)/ //did:web matches anything but an empty string
  private readonly ipfsIdentifier = /^ipfs:\/\/([a-zA-Z0-9]+)$/

  constructor(private ipfs: Ipfs) {}

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    const thing = await this.getAnonCredsObj<AnonCredsSchema>(agentContext, schemaId)

    if (thing.type === 'error') {
      return {
        schemaId,
        resolutionMetadata: thing.error,
        schemaMetadata: {},
      }
    }

    return {
      schema: thing.result,
      schemaId,
      resolutionMetadata: {},
      schemaMetadata: {},
    }
  }

  public async registerSchema(
    agentContext: AgentContext,
    options: RegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    let cid: string | null = null
    try {
      cid = await this.ipfs.uploadFile(Buffer.from(JSON.stringify(options.schema), 'utf8'))
    } catch (err) {
      agentContext.config.logger.error(`Failed to upload schema to IPFS`, {
        schema: options.schema,
      })

      return {
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: options.schema,
          reason: `unknownError`,
        },
      }
    }

    return {
      schemaState: {
        state: 'finished',
        schema: options.schema,
        schemaId: `ipfs://${cid}`,
      },
      registrationMetadata: {},
      schemaMetadata: {},
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    const getResult = await this.getAnonCredsObj<AnonCredsCredentialDefinition>(agentContext, credentialDefinitionId)

    if (getResult.type === 'error') {
      return {
        credentialDefinitionId,
        resolutionMetadata: getResult.error,
        credentialDefinitionMetadata: {},
      }
    }

    return {
      credentialDefinition: getResult.result,
      credentialDefinitionId,
      resolutionMetadata: {},
      credentialDefinitionMetadata: {},
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const schemaId = options.credentialDefinition.schemaId
    const schemaLookup = await this.getSchema(agentContext, schemaId)
    if (schemaLookup.resolutionMetadata.error) {
      agentContext.config.logger.error(`Schema ID ${schemaId} does not correspond to a valid schema`, {
        credentialDefinition: options.credentialDefinition,
        schemaError: schemaLookup.resolutionMetadata.error,
      })

      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: options.credentialDefinition,
          reason: `invalid`,
        },
      }
    }

    let cid: string | null = null
    try {
      cid = await this.ipfs.uploadFile(Buffer.from(JSON.stringify(options.credentialDefinition), 'utf8'))
    } catch (err) {
      agentContext.config.logger.error(`Failed to upload schema to IPFS`, {
        credentialDefinition: options.credentialDefinition,
      })

      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: options.credentialDefinition,
          reason: `unknownError`,
        },
      }
    }

    return {
      credentialDefinitionState: {
        state: 'finished',
        credentialDefinition: options.credentialDefinition,
        credentialDefinitionId: `ipfs://${cid}`,
      },
      registrationMetadata: {},
      credentialDefinitionMetadata: {},
    }
  }

  public async getRevocationRegistryDefinition(): // agentContext: AgentContext,
  // revocationRegistryDefinitionId: string
  Promise<GetRevocationRegistryDefinitionReturn> {
    throw new Error('Not implemented yet')
  }

  // FIXME: this method doesn't retrieve the revocation status list at a specified time, it just resolves the revocation registry definition
  public async getRevocationStatusList(): // agentContext: AgentContext,
  // revocationRegistryId: string,
  // timestamp: number
  Promise<GetRevocationStatusListReturn> {
    throw new Error('Not implemented yet')
  }

  private async getAnonCredsObj<AObj>(
    agentContext: AgentContext,
    id: string
  ): Promise<{ type: 'success'; result: AObj } | { type: 'error'; error: AnonCredsResolutionMetadata }> {
    const match = id.match(this.ipfsIdentifier)
    if (!match) {
      return {
        type: 'error',
        error: {
          error: 'invalid',
          message: `id provided is invalid`,
        },
      }
    }

    const cid = match[1]

    let schemaBuffer: Buffer | null = null
    try {
      schemaBuffer = await this.ipfs.getFile(cid)
    } catch (err) {
      agentContext.config.logger.error(`Failed to fetch ${cid} from IPFS`, {
        cid,
        error: err,
      })

      return {
        type: 'error',
        error: {
          error: 'notFound',
          message: `ipfs fetch error`,
        },
      }
    }

    const resultText = schemaBuffer.toString('utf8')
    let result: AObj | null = null
    try {
      result = JSON.parse(resultText) as AObj
    } catch (err) {
      agentContext.config.logger.error(`Failed to parse content of ${cid}`, {
        cid,
        schemaText: resultText,
      })

      return {
        type: 'error',
        error: {
          error: 'invalid',
          message: `contents could not be parsed`,
        },
      }
    }

    return {
      type: 'success',
      result: result,
    }
  }
}
