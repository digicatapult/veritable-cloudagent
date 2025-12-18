import type {
  AnonCredsProofRequest,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
} from '@credo-ts/anoncreds'
import { Agent, RecordNotFoundError, type ProofExchangeRecordProps, type ProofFormatPayload } from '@credo-ts/core'
import {
  Body,
  Controller,
  Delete,
  Example,
  Get,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Tags,
} from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFoundError } from '../../../error.js'
import { transformProofFormat } from '../../../utils/proofs.js'
import { ProofRecordExample } from '../../examples.js'
import type {
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  AnonCredsPresentation,
  CreateProofRequestOptions,
  ProofFormats,
  ProposeProofOptions,
  RequestProofOptions,
  SimpleProofFormats,
  UUID,
} from '../../types.js'

@Tags('Proofs')
@Route('/v1/proofs')
@injectable()
export class ProofController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve all proof records
   *
   * @param threadId
   * @returns ProofExchangeRecordProps[]
   */
  @Example<ProofExchangeRecordProps[]>([ProofRecordExample])
  @Get('/')
  public async getAllProofs(@Request() req: express.Request, @Query('threadId') threadId?: UUID) {
    let proofs = await this.agent.proofs.getAll()
    req.log.debug('retrieving all proofs %j', proofs)

    if (threadId) {
      proofs = proofs.filter((p) => p.threadId === threadId)
      req.log.info('proofs for %s has been found %j', threadId, proofs)
    }

    return proofs.map((proof) => proof.toJSON())
  }

  /**
   * Retrieve proof record by proof record id
   *
   * @param proofRecordId
   * @param includeContent If true, includes the proof format data (request/presentation) in the response
   * @returns ProofExchangeRecordProps
   */
  @Get('/:proofRecordId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  public async getProofById(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Query('includeContent') includeContent = false
  ) {
    req.log.debug('getting proof record %s', proofRecordId)
    try {
      const proof = await this.agent.proofs.getById(proofRecordId)
      req.log.info('proof found %j', proof)

      const result = proof.toJSON() as Record<string, unknown>

      if (includeContent) {
        const formatData = await this.agent.proofs.getFormatData(proofRecordId)
        result.content = formatData
      }

      return result
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof record not found')
      }
      throw error
    }
  }

  /**
   * Retrieve the content (format data) of a proof record
   *
   * @param proofRecordId
   * @param view If set to 'simplified', returns a flattened map of attribute names to values
   * @returns Record<string, unknown>
   */
  @Get('/:proofRecordId/content')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async getProofContent(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Query('view') view?: 'simplified'
  ): Promise<Record<string, unknown>> {
    req.log.debug('getting proof content for %s', proofRecordId)
    try {
      const formatData = await this.agent.proofs.getFormatData(proofRecordId)
      req.log.info('proof content found for %s', proofRecordId)

      if (view === 'simplified') {
        return this.simplifyProofContent(formatData)
      }

      return formatData
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof record not found')
      }
      throw error
    }
  }

  /**
   * Deletes a proof record in the proof repository.
   *
   * @param proofRecordId
   */
  @Delete('/:proofRecordId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteProof(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    try {
      this.setStatus(204)
      req.log.info('deleting proof %s', proofRecordId)
      await this.agent.proofs.deleteById(proofRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError(`proof record not found`)
      }
      throw error
    }
  }

  /**
   * Initiate a new presentation exchange as prover by sending a presentation proposal request
   * to the connection with the specified connection id.
   *
   * @param proposal
   * @returns ProofExchangeRecordProps
   */
  @Post('/propose-proof')
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeProof(@Request() req: express.Request, @Body() proposal: ProposeProofOptions) {
    try {
      const proof = await this.agent.proofs.proposeProof(proposal)
      req.log.info('proof proposal created %j', proof.toJSON())

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('connection not found')
      }
      throw error
    }
  }

  /**
   * Accept a presentation proposal as verifier by sending an accept proposal message
   * to the connection associated with the proof record.
   *
   * @param proofRecordId
   * @param proposal
   * @returns ProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-proposal')
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Body()
    proposal: AcceptProofProposalOptions
  ) {
    try {
      req.log.info('accepting %s proof proposal %j', proofRecordId, proposal)
      const proof = await this.agent.proofs.acceptProposal({
        proofRecordId,
        ...proposal,
      })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof proposal not found')
      }
      throw error
    }
  }

  /**
   * Creates a presentation request not bound to any proposal or existing connection
   *
   * @param request
   * @returns ProofRequestMessageResponse
   */
  @Post('/create-request')
  @Example<{ message: Record<string, unknown>; proofRecord: ProofExchangeRecordProps }>({
    message: {},
    proofRecord: ProofRecordExample,
  })
  public async createRequest(@Request() req: express.Request, @Body() request: CreateProofRequestOptions) {
    const { proofFormats, ...rest } = request
    req.log.debug('creating proof request %j', { proofFormats, ...rest })
    const { message, proofRecord } = await this.agent.proofs.createRequest({
      proofFormats: {
        anoncreds: transformProofFormat(proofFormats.anoncreds),
      },
      ...rest,
    })

    req.log.info('returning proof record %j', { proofRecord, message })

    return {
      message,
      proofRecord: proofRecord,
    }
  }

  /**
   * Creates a presentation request bound to existing connection
   *
   * @param request
   * @returns ProofExchangeRecordProps
   */
  @Post('/request-proof')
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async requestProof(@Request() req: express.Request, @Body() body: RequestProofOptions) {
    const { connectionId, proofFormats, ...rest } = body
    try {
      req.log.info('requesting proof for %s connection %j', connectionId, body)
      const proof = await this.agent.proofs.requestProof({
        connectionId,
        proofFormats: {
          anoncreds: transformProofFormat(proofFormats.anoncreds),
        },
        ...rest,
      })

      req.log.info('success, returning proof %j', proof.toJSON())
      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError(`proof record not found ${error}`)
      }
      throw error
    }
  }

  /**
   * Accept a presentation request as prover by sending an accept request message
   * to the connection associated with the proof record.
   *
   * If `proofFormats` is omitted, credentials will be auto-selected.
   * If `proofFormats` is in simplified format, it will be hydrated with available credentials.
   * Otherwise, the provided full proof formats will be used.
   *
   * @param proofRecordId
   * @param request
   * @returns ProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-request')
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  @Response<BadRequest['message']>(400)
  @Response<{ message: string; details?: unknown }>(422, 'Validation Failed')
  public async acceptRequest(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Body()
    body: AcceptProofRequestOptions
  ) {
    try {
      let formatsToAccept: ProofFormatPayload<ProofFormats, 'acceptRequest'>

      if (!body.proofFormats) {
        req.log.info('retrieving credentials for %s proof', proofRecordId)
        const retrievedCredentials = await this.agent.proofs.selectCredentialsForRequest({
          proofRecordId,
        })
        formatsToAccept = retrievedCredentials.proofFormats as ProofFormatPayload<ProofFormats, 'acceptRequest'>
        req.log.info('credentials found (redacted) %j', this.redactProofFormats(retrievedCredentials.proofFormats))
      } else if (this.isSimpleProofFormats(body.proofFormats)) {
        const requestedAnonCreds = body.proofFormats.anoncreds

        if (!requestedAnonCreds) {
          throw new BadRequest('Invalid simplified proof formats: missing anoncreds')
        }

        formatsToAccept = await this.hydrateProofFormats(req, proofRecordId, requestedAnonCreds)
      } else {
        formatsToAccept = body.proofFormats as ProofFormatPayload<ProofFormats, 'acceptRequest'>
        const fullFormatAnonCreds = formatsToAccept.anoncreds

        // Added validation for empty formats
        if (
          fullFormatAnonCreds &&
          (!fullFormatAnonCreds.attributes || Object.keys(fullFormatAnonCreds.attributes).length === 0) &&
          (!fullFormatAnonCreds.predicates || Object.keys(fullFormatAnonCreds.predicates).length === 0)
        ) {
          throw new BadRequest('Invalid proof formats: must have at least one attribute or predicate')
        }

        req.log.info('using provided proof formats for %s proof', proofRecordId)
      }

      // Log only non-sensitive metadata about the proof formats
      let attrCount = 0
      let predCount = 0
      if (formatsToAccept?.anoncreds) {
        if (formatsToAccept.anoncreds.attributes) {
          attrCount = Object.keys(formatsToAccept.anoncreds.attributes).length
        }
        if (formatsToAccept.anoncreds.predicates) {
          predCount = Object.keys(formatsToAccept.anoncreds.predicates).length
        }
      }
      req.log.info(
        'accepting proof request for %s with %d attributes and %d predicates',
        proofRecordId,
        attrCount,
        predCount
      )
      // Optionally log full formats at debug level for troubleshooting
      req.log.debug('accepting proof request with formats %j', this.redactProofFormats(formatsToAccept))
      const proof = await this.agent.proofs.acceptRequest({
        proofRecordId,
        ...body,
        proofFormats: formatsToAccept,
      })

      req.log.debug('success, returning proof %j', proof.toJSON())

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError(`proof record not found`)
      }
      throw error
    }
  }

  /**
   * Accept a presentation as prover by sending an accept presentation message
   * to the connection associated with the proof record.
   *
   * @param proofRecordId
   * @returns ProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-presentation')
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptPresentation(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    try {
      req.log.info('accepting proof presentation %s', proofRecordId)
      const proof = await this.agent.proofs.acceptPresentation({ proofRecordId })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof record not found')
      }
      throw error
    }
  }

  /**
   * Hydrates simplified proof formats with actual credential data from the wallet.
   *
   * @param req Express request object for logging.
   * @param proofRecordId The ID of the proof record.
   * @param requestedAnonCreds The simplified AnonCreds proof request containing attribute and predicate requirements.
   * @returns The fully hydrated proof formats ready for acceptance.
   */
  private async hydrateProofFormats(
    req: express.Request,
    proofRecordId: UUID,
    requestedAnonCreds: NonNullable<SimpleProofFormats['anoncreds']>
  ): Promise<ProofFormatPayload<ProofFormats, 'acceptRequest'>> {
    req.log.info('hydrating simplified proof formats for %s proof', proofRecordId)

    const availableCredentials = await this.agent.proofs.getCredentialsForRequest({ proofRecordId })
    const availableAnonCreds = (
      availableCredentials.proofFormats as ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'>
    ).anoncreds

    if (!availableAnonCreds) {
      req.log.error(
        'Could not hydrate proof formats: no available credentials found for proofRecordId=%s. Requested attributes: %j, predicates: %j.',
        proofRecordId,
        requestedAnonCreds.attributes ?? {},
        requestedAnonCreds.predicates ?? {}
      )
      throw new NotFoundError(
        `Could not hydrate proof formats: no available credentials found for proofRecordId=${proofRecordId}`
      )
    }

    const hydratedAttributes = this.hydrateAttributes(
      requestedAnonCreds.attributes,
      availableAnonCreds.output.attributes
    )
    const hydratedPredicates = this.hydratePredicates(
      requestedAnonCreds.predicates,
      availableAnonCreds.output.predicates
    )

    this.validateHydration(req, requestedAnonCreds, hydratedAttributes, hydratedPredicates)

    return {
      anoncreds: {
        attributes: hydratedAttributes,
        predicates: hydratedPredicates,
        selfAttestedAttributes: {},
      },
    }
  }

  /**
   * Hydrates requested attributes with matching credentials from the available set.
   *
   * @param requested Map of requested attributes with credential IDs and revealed status.
   * @param available Map of available credentials for each attribute.
   * @returns A map of hydrated attributes.
   */
  private hydrateAttributes(
    requested: Record<string, { credentialId: string; revealed: boolean }> | undefined,
    available: Record<string, AnonCredsRequestedAttributeMatch[]> | undefined
  ): Record<string, AnonCredsRequestedAttributeMatch> {
    const hydrated: Record<string, AnonCredsRequestedAttributeMatch> = {}
    if (!requested || !available) return hydrated

    for (const [key, value] of Object.entries(requested)) {
      const match = available[key]?.find((m) => m.credentialId === value.credentialId)
      if (match) {
        if (value.revealed !== match.revealed) {
          throw new BadRequest(
            `Attribute '${key}' cannot be ${value.revealed ? 'revealed' : 'hidden'}. The proof request or credential requires this attribute to be ${!value.revealed ? 'revealed' : 'hidden'}.`
          )
        }
        hydrated[key] = { ...match, revealed: match.revealed && value.revealed }
      }
    }
    return hydrated
  }

  /**
   * Hydrates requested predicates with matching credentials from the available set.
   *
   * @param requested Map of requested predicates with credential IDs.
   * @param available Map of available credentials for each predicate.
   * @returns A map of hydrated predicates.
   */
  private hydratePredicates(
    requested: Record<string, { credentialId: string }> | undefined,
    available: Record<string, AnonCredsRequestedPredicateMatch[]> | undefined
  ): Record<string, AnonCredsRequestedPredicateMatch> {
    const hydrated: Record<string, AnonCredsRequestedPredicateMatch> = {}
    if (!requested || !available) return hydrated

    for (const [key, value] of Object.entries(requested)) {
      const match = available[key]?.find((m) => m.credentialId === value.credentialId)
      if (match) {
        hydrated[key] = match
      }
    }
    return hydrated
  }

  /**
   * Validates that all requested attributes and predicates have been successfully hydrated.
   * Throws a NotFoundError if any items are missing.
   *
   * @param req Express request object for logging.
   * @param requested The original requested items.
   * @param hydratedAttrs The hydrated attributes map.
   * @param hydratedPreds The hydrated predicates map.
   */
  private validateHydration(
    req: express.Request,
    requested: NonNullable<SimpleProofFormats['anoncreds']>,
    hydratedAttrs: Record<string, AnonCredsRequestedAttributeMatch>,
    hydratedPreds: Record<string, AnonCredsRequestedPredicateMatch>
  ) {
    const getMissing = (
      reqItems: Record<string, { credentialId: string }> | undefined,
      hydratedItems: Record<string, { credentialId: string }>
    ) => {
      if (!reqItems) return []
      return Object.entries(reqItems)
        .filter(([key, value]) => {
          const hydrated = hydratedItems[key]
          return !hydrated || hydrated.credentialId !== value.credentialId
        })
        .map(([name, value]) => ({ name, credentialId: value.credentialId }))
    }

    const missingAttributes = getMissing(requested.attributes, hydratedAttrs)
    const missingPredicates = getMissing(requested.predicates, hydratedPreds)

    if (missingAttributes.length > 0 || missingPredicates.length > 0) {
      const formatDetails = (items: typeof missingAttributes, type: string) =>
        items.length > 0 ? `${type}: ${items.map((i) => `${i.name} (credId: ${i.credentialId})`).join(', ')}` : ''

      const details = [formatDetails(missingAttributes, 'attributes'), formatDetails(missingPredicates, 'predicates')]
        .filter(Boolean)
        .join('; ')

      req.log.warn(`Could not hydrate proof formats: no matching credentials found for requested ${details}`)
      throw new NotFoundError(`Could not hydrate proof formats: no matching credentials found for requested ${details}`)
    }
  }

  /**
   * Redacts sensitive information from proof formats for logging purposes.
   *
   * @param formats The proof formats to redact.
   * @returns A redacted copy of the proof formats.
   */
  private redactProofFormats(formats: ProofFormatPayload<ProofFormats, 'acceptRequest'>): Record<string, unknown> {
    const anoncreds = formats.anoncreds
    if (!anoncreds) return formats as Record<string, unknown>

    const attributes = anoncreds.attributes
      ? Object.fromEntries(
          Object.entries(anoncreds.attributes).map(([key, value]) => {
            if (value && typeof value === 'object') {
              return [key, { ...value, credentialInfo: '[REDACTED]', value: '[REDACTED]' }]
            }
            return [key, value]
          })
        )
      : undefined

    const predicates = anoncreds.predicates
      ? Object.fromEntries(
          Object.entries(anoncreds.predicates).map(([key, value]) => {
            if (value && typeof value === 'object') {
              return [key, { ...value, credentialInfo: '[REDACTED]' }]
            }
            return [key, value]
          })
        )
      : undefined

    return {
      ...formats,
      anoncreds: {
        ...anoncreds,
        attributes,
        predicates,
      },
    } as Record<string, unknown>
  }

  /**
   * Checks if the provided proof formats match the simplified format structure.
   *
   * @param formats The proof formats to check.
   * @returns True if the formats match the SimpleProofFormats structure, false otherwise.
   */
  private isSimpleProofFormats(formats: AcceptProofRequestOptions['proofFormats']): formats is SimpleProofFormats {
    if (!formats || !('anoncreds' in formats)) return false

    const anoncreds = (formats as { anoncreds: unknown }).anoncreds as {
      attributes?: Record<string, unknown>
      predicates?: Record<string, unknown>
    }

    const hasAttributes = !!anoncreds?.attributes && Object.keys(anoncreds.attributes).length > 0
    const hasPredicates = !!anoncreds?.predicates && Object.keys(anoncreds.predicates).length > 0

    if (!hasAttributes && !hasPredicates) return false

    const isValidEntry = (entry: unknown, requiredKeys: string[]) =>
      typeof entry === 'object' &&
      entry !== null &&
      requiredKeys.every((k) => k in (entry as object)) &&
      Object.keys(entry as object).length === requiredKeys.length &&
      !('credentialInfo' in (entry as object))

    if (
      hasAttributes &&
      !Object.values(anoncreds.attributes!).every((a) => isValidEntry(a, ['credentialId', 'revealed']))
    ) {
      return false
    }

    if (hasPredicates && !Object.values(anoncreds.predicates!).every((p) => isValidEntry(p, ['credentialId']))) {
      return false
    }

    return true
  }

  /**
   * Simplifies the proof content by flattening the structure and extracting relevant attribute values.
   *
   * @param formatData The raw proof format data containing request and presentation details.
   * @returns A simplified record of attribute names and their revealed values.
   */
  private simplifyProofContent(formatData: {
    request?: { anoncreds?: AnonCredsProofRequest }
    presentation?: { anoncreds?: AnonCredsPresentation }
  }): Record<string, unknown> {
    const request = formatData.request?.anoncreds
    const presentation = formatData.presentation?.anoncreds

    if (!request || !presentation) return {}

    const simplified: Record<string, unknown> = {}
    const { requested_attributes = {} } = request
    const { revealed_attrs = {}, revealed_attr_groups = {} } = presentation.requested_proof || {}

    for (const [referent, reqAttr] of Object.entries(requested_attributes)) {
      const { name, names } = reqAttr as AnonCredsRequestedAttribute

      if (name && revealed_attrs[referent]) {
        simplified[name] = revealed_attrs[referent].raw
      } else if (names && revealed_attr_groups[referent]) {
        const group = revealed_attr_groups[referent]
        names.forEach((n) => {
          if (group.values[n]) simplified[n] = group.values[n].raw
        })
      }
    }

    return simplified
  }
}
