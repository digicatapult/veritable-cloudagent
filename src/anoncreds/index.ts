import {
  type AnonCredsRegistry,
  type GetCredentialDefinitionReturn,
  type GetRevocationStatusListReturn,
  type GetRevocationRegistryDefinitionReturn,
  type GetSchemaReturn,
  type RegisterCredentialDefinitionReturn,
  type RegisterSchemaReturn,
  type AnonCredsSchema,
  type RegisterSchemaOptions,
  type AnonCredsResolutionMetadata,
  type AnonCredsCredentialDefinition,
  type RegisterCredentialDefinitionOptions,
  type RegisterRevocationRegistryDefinitionOptions,
  type RegisterRevocationRegistryDefinitionReturn,
  type RegisterRevocationStatusListOptions,
  type RegisterRevocationStatusListReturn,
  type AnonCredsRevocationRegistryDefinition,
  dateToTimestamp,
  AnonCredsRevocationStatusList,
} from '@aries-framework/anoncreds'
import Ipfs from '../ipfs'
import type { AgentContext } from '@aries-framework/core'

export type RevocationRegistryDelta = {
  accum: string
  issued: number[]
  revoked: number[]
  txnTime: number
}
enum RevocationState {
  Active,
  Revoked,
}
interface ParsedRevocationRegistryId {
  did: string
  namespaceIdentifier: string
  schemaSeqNo: string
  credentialDefinitionTag: string
  revocationRegistryTag: string
  namespace?: string
}

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
  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    { options, revocationRegistryDefinition }: RegisterRevocationRegistryDefinitionOptions
  ): // options in options can contain either 'Internal', 'ExternalSubmit' or 'ExternalCreate' options in itself
  Promise<RegisterRevocationRegistryDefinitionReturn> {
    try {
      const cid = await this.ipfs.uploadFile(Buffer.from(JSON.stringify(revocationRegistryDefinition), 'utf8'))
      return {
        revocationRegistryDefinitionMetadata: {},
        revocationRegistryDefinitionState: {
          revocationRegistryDefinition,
          revocationRegistryDefinitionId: `ipfs://${cid}`,
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation registry definition for credential definition '${revocationRegistryDefinition.credDefId}'`,
        {
          error,
          did: revocationRegistryDefinition.issuerId,
          revocationRegistryDefinition,
        }
      )

      return {
        revocationRegistryDefinitionMetadata: {},
        registrationMetadata: {},
        revocationRegistryDefinitionState: {
          revocationRegistryDefinition,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }
  public async registerRevocationStatusList(
    agentContext: AgentContext,
    { options, revocationStatusList }: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    try {
      const { namespaceIdentifier, namespace } = await this.parseDid(revocationStatusList.issuerId)
      agentContext.config.logger.debug(
        `Registering revocation status list on ipfs'${namespace}' with did '${revocationStatusList.issuerId}'`,
        revocationStatusList
      )
      //do we need to fetch the latest delta for anything?
      //do we need the below?
      // const submitterKey = await verificationKeyForIndyDid(agentContext, revocationStatusList.issuerId)
      // writeRequest = await pool.prepareWriteRequest(
      //   agentContext,
      //   revocationRegistryDefinitionRequest,
      //   submitterKey,
      //   endorserDid !== revocationStatusList.issuerId ? endorserDid : undefined
      // )
      // const response = await pool.submitRequest<RevocationRegistryEntryRequest>(
      //   writeRequest as RevocationRegistryEntryRequest
      // )
      return {
        revocationStatusListMetadata: {},
        revocationStatusListState: {
          revocationStatusList: {
            ...revocationStatusList,
            timestamp: dateToTimestamp(new Date()), //response.result.txnMetadata.txnTime, //do we keep this?
          },
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering revocation status list for revocation registry definition '${revocationStatusList.revRegDefId}}'`,
        {
          error,
          did: revocationStatusList.issuerId,
        }
      )

      return {
        registrationMetadata: {},
        revocationStatusListMetadata: {},
        revocationStatusListState: {
          revocationStatusList,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
    throw new Error('Method not implemented.')
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      const result = await this.getAnonCredsObj<AnonCredsRevocationRegistryDefinition>(
        agentContext,
        revocationRegistryDefinitionId
      )
      let res: any | null = null //not ANY!!
      if (result.type === 'error') {
        res = {
          revocationRegistryDefinitionId,
          resolutionMetadata: result.error,
          revocationRegistryDefinitionMetadata: {},
        }
      } else {
        res = {
          revocationRegistryDefinition: result.result,
          revocationRegistryDefinitionId,
          resolutionMetadata: {},
          revocationRegistryDefinitionMetadata: {},
        }
      }

      const revocationRegistryDefinition = {
        issuerId: res.revocationRegistryDefinition.issuerId,
        revocDefType: res.revocationRegistryDefinition.revocDefType,
        value: {
          maxCredNum: res.revocationRegistryDefinition.value.maxCredNum,
          tailsHash: res.revocationRegistryDefinition.value.tailsHash,
          tailsLocation: res.revocationRegistryDefinition.value.tailsLocation,
          publicKeys: {
            accumKey: {
              z: res.revocationRegistryDefinition.value.publicKeys.accumKey.z,
            },
          },
        },
        tag: res.revocationRegistryDefinition.tag,
        credDefId: res.revocationRegistryDefinition.credentialDefinitionId,
      } satisfies AnonCredsRevocationRegistryDefinition
      return {
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        revocationRegistryDefinitionMetadata: {
          // NOT SURE IF WE NEED THESSE TWO PARAMS - it's an 'Extensible'
          // issuanceType: response.result.data.value.issuanceType,
          // didIndyNamespace: pool.indyNamespace,
        },
        resolutionMetadata: {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry definition: ${error.message}`,
        },
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  // FIXME: this method doesn't retrieve the revocation status list at a specified time, it just resolves the revocation registry definition
  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    try {
      //finish up fetch delta
      const revocationDelta = await this.fetchIndyRevocationDelta(
        agentContext,
        revocationRegistryDefinitionId,
        timestamp
      )

      if (!revocationDelta) {
        return {
          resolutionMetadata: {
            error: 'notFound',
            message: `Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger, potentially revocation interval ends before revocation registry creation`,
          },
          revocationStatusListMetadata: {},
        }
      }
      const { revocationRegistryDefinition, resolutionMetadata, revocationRegistryDefinitionMetadata } =
        await this.getRevocationRegistryDefinition(agentContext, revocationRegistryDefinitionId)
      if (
        !revocationRegistryDefinition ||
        !revocationRegistryDefinitionMetadata.issuanceType ||
        typeof revocationRegistryDefinitionMetadata.issuanceType !== 'string'
      ) {
        return {
          resolutionMetadata: {
            error: `error resolving revocation registry definition with id ${revocationRegistryDefinitionId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
          revocationStatusListMetadata: {
            // didIndyNamespace: pool.indyNamespace,
          },
        }
      }
      const isIssuanceByDefault = revocationRegistryDefinitionMetadata.issuanceType === 'ISSUANCE_BY_DEFAULT'

      return {
        resolutionMetadata: {},
        revocationStatusList: await this.anonCredsRevocationStatusListFromIPFS(
          revocationRegistryDefinitionId,
          revocationRegistryDefinition,
          revocationDelta,
          isIssuanceByDefault
        ),
        revocationStatusListMetadata: {
          // not sure if we need this param?
          // didIndyNamespace: pool.indyNamespace,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger, potentially revocation interval ends before revocation registry creation?"`,
        {
          error,
          revocationRegistryId: revocationRegistryDefinitionId,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger, potentially revocation interval ends before revocation registry creation: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
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

  private async anonCredsRevocationStatusListFromIPFS(
    revocationRegistryDefinitionId: string,
    revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition,
    delta: RevocationRegistryDelta,
    isIssuanceByDefault: boolean
  ): Promise<AnonCredsRevocationStatusList> {
    // Check whether the highest delta index is supported in the `maxCredNum` field of the
    // revocation registry definition. This will likely also be checked on other levels as well
    // by the ledger or the indy-vdr library itself
    if (Math.max(...delta.issued, ...delta.revoked) >= revocationRegistryDefinition.value.maxCredNum) {
      throw new Error(
        `Highest delta index '${Math.max(
          ...delta.issued,
          ...delta.revoked
        )}' is too large for the Revocation registry maxCredNum '${revocationRegistryDefinition.value.maxCredNum}' `
      )
    }

    // 0 means unrevoked, 1 means revoked
    const defaultState = isIssuanceByDefault ? RevocationState.Active : RevocationState.Revoked

    // Fill with default value
    const revocationList = new Array(revocationRegistryDefinition.value.maxCredNum).fill(defaultState)

    // Set all `issuer` indexes to 0 (not revoked)
    for (const issued of delta.issued ?? []) {
      revocationList[issued] = RevocationState.Active
    }

    // Set all `revoked` indexes to 1 (revoked)
    for (const revoked of delta.revoked ?? []) {
      revocationList[revoked] = RevocationState.Revoked
    }

    return {
      issuerId: revocationRegistryDefinition.issuerId,
      currentAccumulator: delta.accum,
      revRegDefId: revocationRegistryDefinitionId,
      revocationList,
      timestamp: delta.txnTime,
    }
  }

  private async fetchIndyRevocationDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    toTs: number
  ): Promise<null | RevocationRegistryDelta> {

    const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } = 
    await this.parseRevocationRegistryId(revocationRegistryDefinitionId)

    agentContext.config.logger.debug(
      `Using IPFS to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryDefinitionId}' until ${toTs}`
    )

    // Indicating there are no deltas
    if (type !== '117' || data === null || !txnTime) {
      agentContext.config.logger.warn(
        `Could not get any deltas from ledger for revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.indyNamespace}'`
      )
      return null
    }

    return {
      revoked: data.value.revoked,
      issued: data.value.issued,
      accum: data.value.accum_to.value.accum,
      txnTime,
    }
  }
  private async parseDid(did: string) {
    const match = did.match(this.supportedIdentifier)
    if (match) {
      const [, namespace, namespaceIdentifier] = match
      return { namespace, namespaceIdentifier }
    } else {
      throw new Error(`${did} is not a valid did:key or did:web did`)
    }
  }

 
  private async parseRevocationRegistryId(revocationRegistryId: string): Promise<ParsedRevocationRegistryId> {
    const didIndyMatch = revocationRegistryId.match(this.ipfsIdentifier) //should this be matching sth else than below? 
    if (didIndyMatch) {
      const [, did, namespace, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] =
        didIndyMatch
  
      return {
        did,
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag,
        namespace,
      }
    }
  
    const legacyMatch = revocationRegistryId.match(this.ipfsIdentifier) //should this be asth else than above? 
    if (legacyMatch) {
      const [, did, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] = legacyMatch
  
      return {
        did,
        namespaceIdentifier: did,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag,
      }
    }
  
    throw new Error(`Invalid revocation registry id: ${revocationRegistryId}`)
}
