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
import VeritableIdentifiers from './utils/identifiers'
import { anonCredsRevocationStatusListFromIPFS } from './utils/transform'

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

export default class VeritableAnonCredsRegistry implements AnonCredsRegistry {
  public readonly methodName = 'veritable'
  public readonly supportedIdentifier =
    /(?:^did:key:z[a-km-zA-HJ-NP-Z1-9]+$)|(?:^ipfs:\/\/([a-zA-Z0-9]+)$)|(?:^did:web:.+$)/ //did:web matches anything but an empty string
  private readonly ipfsIdentifier = /^ipfs:\/\/([a-zA-Z0-9]+)$/
  public veritableIdentifiers = new VeritableIdentifiers()

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
      // const { namespaceIdentifier, namespace } = parseIndyDid(revocationRegistryDefinition.issuerId)
      // const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)
      // const pool = indyVdrPoolService.getPoolForNamespace(namespace)

      // agentContext.config.logger.debug(
      //   `Registering revocation registry definition on ledger '${namespace}' with did '${revocationRegistryDefinition.issuerId}'`,
      //   revocationRegistryDefinition
      // )

      // let writeRequest: CustomRequest
      // let didIndyRevocationRegistryDefinitionId: string

      // const { schemaSeqNo, tag: credentialDefinitionTag } = parseIndyCredentialDefinitionId(
      //   revocationRegistryDefinition.credDefId
      // )

      // const { endorsedTransaction, endorserDid, endorserMode } = options
      // if (endorsedTransaction) {
      //   agentContext.config.logger.debug(
      //     `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${revocationRegistryDefinition.issuerId}'`,
      //     revocationRegistryDefinition
      //   )
      //   writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
      //   didIndyRevocationRegistryDefinitionId = getDidIndyRevocationRegistryDefinitionId(
      //     namespace,
      //     namespaceIdentifier,
      //     schemaSeqNo,
      //     credentialDefinitionTag,
      //     revocationRegistryDefinition.tag
      //   )
      // } else {
      //   const legacyRevocationRegistryDefinitionId = getUnqualifiedRevocationRegistryDefinitionId(
      //     namespaceIdentifier,
      //     schemaSeqNo,
      //     credentialDefinitionTag,
      //     revocationRegistryDefinition.tag
      //   )

      //   didIndyRevocationRegistryDefinitionId = getDidIndyRevocationRegistryDefinitionId(
      //     namespace,
      //     namespaceIdentifier,
      //     schemaSeqNo,
      //     credentialDefinitionTag,
      //     revocationRegistryDefinition.tag
      //   )

      //   const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
      //     namespaceIdentifier,
      //     schemaSeqNo,
      //     credentialDefinitionTag
      //   )

      //   const revocationRegistryDefinitionRequest = new RevocationRegistryDefinitionRequest({
      //     submitterDid: namespaceIdentifier,
      //     revocationRegistryDefinitionV1: {
      //       id: legacyRevocationRegistryDefinitionId,
      //       ver: '1.0',
      //       credDefId: legacyCredentialDefinitionId,
      //       tag: revocationRegistryDefinition.tag,
      //       revocDefType: revocationRegistryDefinition.revocDefType,
      //       value: {
      //         issuanceType: 'ISSUANCE_BY_DEFAULT',
      //         ...revocationRegistryDefinition.value,
      //       },
      //     },
      //   })

      //   const submitterKey = await verificationKeyForIndyDid(agentContext, revocationRegistryDefinition.issuerId)
      //   writeRequest = await pool.prepareWriteRequest(
      //     agentContext,
      //     revocationRegistryDefinitionRequest,
      //     submitterKey,
      //     endorserDid !== revocationRegistryDefinition.issuerId ? endorserDid : undefined
      //   )

      //   if (endorserMode === 'external') {
      //     return {
      //       jobId: didIndyRevocationRegistryDefinitionId,
      //       revocationRegistryDefinitionState: {
      //         state: 'action',
      //         action: 'endorseIndyTransaction',
      //         revocationRegistryDefinition,
      //         revocationRegistryDefinitionId: didIndyRevocationRegistryDefinitionId,
      //         revocationRegistryDefinitionRequest: writeRequest.body,
      //       },
      //       registrationMetadata: {},
      //       revocationRegistryDefinitionMetadata: {},
      //     }
      //   }

      //   if (endorserMode === 'internal' && endorserDid !== revocationRegistryDefinition.issuerId) {
      //     const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
      //     await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
      //   }
      // }

      // const response = await pool.submitRequest(writeRequest)
      // agentContext.config.logger.debug(
      //   `Registered revocation registry definition '${didIndyRevocationRegistryDefinitionId}' on ledger '${pool.indyNamespace}'`,
      //   {
      //     response,
      //     revocationRegistryDefinition,
      //   }
      // )

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
          reason: `unknownError: ${error}`,
        },
      }
    }
  }
  public async registerRevocationStatusList(
    agentContext: AgentContext,
    { options, revocationStatusList }: RegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    try {
      const { namespaceIdentifier, namespace } = await this.veritableIdentifiers.parseDid(
        revocationStatusList.issuerId,
        this.supportedIdentifier
      )
      agentContext.config.logger.debug(
        `Registering revocation status list on ipfs'${namespace}' with did '${revocationStatusList.issuerId}'`,
        revocationStatusList
      )
      // let writeRequest: CustomRequest

      // Parse the revocation registry id
      const {
        // schemaSeqNo,
        // credentialDefinitionTag,
        namespaceIdentifier: revocationRegistryNamespaceIdentifier,
        // revocationRegistryTag,
        namespace: revocationRegistryNamespace,
      } = await this.veritableIdentifiers.parseRevocationRegistryId(
        revocationStatusList.revRegDefId,
        this.ipfsIdentifier
      )
      // const legacyRevocationRegistryDefinitionId = getUnqualifiedRevocationRegistryDefinitionId(
      //   namespaceIdentifier,
      //   schemaSeqNo,
      //   credentialDefinitionTag,
      //   revocationRegistryTag
      // )

      // const didIndyRevocationRegistryEntryId = getDidIndyRevocationRegistryEntryId(
      //   namespace,
      //   namespaceIdentifier,
      //   schemaSeqNo,
      //   credentialDefinitionTag,
      //   revocationRegistryTag
      // )
      if (revocationRegistryNamespace && revocationRegistryNamespace !== namespace) {
        throw new Error(
          `Issued id '${revocationStatusList.issuerId}' does not have the same namespace (${namespace}) as the revocation registry definition '${revocationRegistryNamespace}'`
        )
      }

      if (revocationRegistryNamespaceIdentifier !== namespaceIdentifier) {
        throw new Error(
          `Cannot register revocation registry definition using a different DID. Revocation registry definition contains '${revocationRegistryNamespaceIdentifier}', but DID used was '${namespaceIdentifier}'`
        )
      }

      const revocationRegistryDefinitionRequest = {
        currentAccumulator: revocationStatusList.currentAccumulator,
        revocationList: revocationStatusList.revocationList,
        revRegDefId: revocationStatusList.revRegDefId,
      }
      const cid = await this.ipfs.uploadFile(Buffer.from(JSON.stringify(revocationRegistryDefinitionRequest), 'utf8'))

      // if (endorsedTransaction) {
      //   agentContext.config.logger.debug(
      //     `Preparing endorsed tx '${endorsedTransaction}' for submission on ledger '${namespace}' with did '${revocationStatusList.issuerId}'`,
      //     revocationStatusList
      //   )

      //   writeRequest = new CustomRequest({ customRequest: endorsedTransaction })
      // } else {
      //   const previousDelta = await this.fetchIndyRevocationDelta(
      //     agentContext,
      //     legacyRevocationRegistryDefinitionId,
      //     // Fetch revocation delta for current timestamp
      //     dateToTimestamp(new Date())
      //   )

      //   const revocationRegistryDefinitionEntryValue = indyVdrCreateLatestRevocationDelta(
      //     revocationStatusList.currentAccumulator,
      //     revocationStatusList.revocationList,
      //     previousDelta ?? undefined
      //   )

      //   const revocationRegistryDefinitionRequest = new RevocationRegistryEntryRequest({
      //     submitterDid: namespaceIdentifier,
      //     revocationRegistryEntry: {
      //       ver: '1.0',
      //       value: revocationRegistryDefinitionEntryValue,
      //     },
      //     revocationRegistryDefinitionType: 'CL_ACCUM',
      //     revocationRegistryDefinitionId: legacyRevocationRegistryDefinitionId,
      //   })

      //   const submitterKey = await verificationKeyForIndyDid(agentContext, revocationStatusList.issuerId)
      //   writeRequest = await pool.prepareWriteRequest(
      //     agentContext,
      //     revocationRegistryDefinitionRequest,
      //     submitterKey,
      //     endorserDid !== revocationStatusList.issuerId ? endorserDid : undefined
      //   )

      //   if (endorserMode === 'external') {
      //     return {
      //       jobId: didIndyRevocationRegistryEntryId,
      //       revocationStatusListState: {
      //         state: 'action',
      //         action: 'endorseIndyTransaction',
      //         revocationStatusList,
      //         revocationStatusListRequest: writeRequest.body,
      //       },
      //       registrationMetadata: {},
      //       revocationStatusListMetadata: {},
      //     }
      //   }

      //   if (endorserMode === 'internal' && endorserDid !== revocationStatusList.issuerId) {
      //     const endorserKey = await verificationKeyForIndyDid(agentContext, endorserDid as string)
      //     await multiSignRequest(agentContext, writeRequest, endorserKey, parseIndyDid(endorserDid).namespaceIdentifier)
      //   }
      // }
      // const response = await pool.submitRequest<RevocationRegistryEntryRequest>(
      //   writeRequest as RevocationRegistryEntryRequest
      // )
      agentContext.config.logger.debug(`Registered revocation status list '${cid}' on IPFS`, {
        cid,
        revocationStatusList,
      })
      return {
        revocationStatusListMetadata: { cid: cid }, //we need to somehow return the cid ...how?
        revocationStatusListState: {
          revocationStatusList: {
            ...revocationStatusList,
            timestamp: dateToTimestamp(new Date()), //response.result.txnMetadata.txnTime, //credo-ts
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
          reason: `unknownError: ${error}`,
        },
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      // const indySdkPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

      // const { did, namespaceIdentifier, credentialDefinitionTag, revocationRegistryTag, schemaSeqNo } =
      //   parseIndyRevocationRegistryId(revocationRegistryDefinitionId)
      // const { pool } = await indySdkPoolService.getPoolForDid(agentContext, did)

      // agentContext.config.logger.debug(
      //   `Using ledger '${pool.indyNamespace}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
      // )

      // const legacyRevocationRegistryId = getUnqualifiedRevocationRegistryDefinitionId(
      //   namespaceIdentifier,
      //   schemaSeqNo,
      //   credentialDefinitionTag,
      //   revocationRegistryTag
      // )
      // const request = new GetRevocationRegistryDefinitionRequest({
      //   revocationRegistryId: legacyRevocationRegistryId,
      // })

      // agentContext.config.logger.trace(
      //   `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      // )
      // const response = await pool.submitRequest(request)

      // if (!response.result.data) {
      //   agentContext.config.logger.error(
      //     `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
      //     {
      //       revocationRegistryDefinitionId,
      //     }
      //   )

      //   return {
      //     resolutionMetadata: {
      //       error: 'notFound',
      //       message: 'unable to resolve revocation registry definition',
      //     },
      //     revocationRegistryDefinitionId,
      //     revocationRegistryDefinitionMetadata: {},
      //   }
      // }

      // agentContext.config.logger.trace(
      //   `Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.indyNamespace}'`,
      //   {
      //     response,
      //   }
      // )

      // const credentialDefinitionId = revocationRegistryDefinitionId.startsWith('did:indy:')
      //   ? getDidIndyCredentialDefinitionId(
      //       pool.indyNamespace,
      //       namespaceIdentifier,
      //       schemaSeqNo,
      //       credentialDefinitionTag
      //     )
      //   : getUnqualifiedCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, credentialDefinitionTag)

      // const revocationRegistryDefinition = {
      //   issuerId: did,
      //   revocDefType: response.result.data.revocDefType,
      //   value: {
      //     maxCredNum: response.result.data.value.maxCredNum,
      //     tailsHash: response.result.data.value.tailsHash,
      //     tailsLocation: response.result.data.value.tailsLocation,
      //     publicKeys: {
      //       accumKey: {
      //         z: response.result.data.value.publicKeys.accumKey.z,
      //       },
      //     },
      //   },
      //   tag: response.result.data.tag,
      //   credDefId: credentialDefinitionId,
      // } satisfies AnonCredsRevocationRegistryDefinition

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
        throw new Error(`${res}`)
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
          message: `unable to resolve revocation registry definition: ${error}`,
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
    throw new Error(`not implemented`)
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

  private async fetchIndyRevocationDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    toTs: number
  ): Promise<null | RevocationRegistryDelta> {
    //   const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
    //     await this.veritableIdentifiers.parseRevocationRegistryId(revocationRegistryDefinitionId, this.ipfsIdentifier)

    //   agentContext.config.logger.debug(
    //     `Using IPFS to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryDefinitionId}' until ${toTs}`
    //   )
    //   const legacyRevocationRegistryDefinitionId = this.veritableIdentifiers.getUnqualifiedRevocationRegistryDefinitionId(
    //     namespaceIdentifier,
    //     schemaSeqNo,
    //     credentialDefinitionTag,
    //     revocationRegistryTag
    //   )
    //   const deltaRequest = new GetRevocationRegistryDeltaRequest({
    //     toTs,
    //     submitterDid: namespaceIdentifier,
    //     revocationRegistryId: legacyRevocationRegistryDefinitionId,
    //   })

    //   // Indicating there are no deltas
    //   if (type !== '117' || data === null || !txnTime) {
    //     agentContext.config.logger.warn(
    //       `Could not get any deltas from ledger for revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.indyNamespace}'`
    //     )
    //     return null
    //   }

    //   return {
    //     revoked: data.value.revoked,
    //     issued: data.value.issued,
    //     accum: data.value.accum_to.value.accum,
    //     txnTime,
    //   }
    return null
  }
}
