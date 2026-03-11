import type { AnonCredsRequestedAttributeMatch, AnonCredsRequestedPredicateMatch } from '@credo-ts/anoncreds'
import { Agent, RecordNotFoundError } from '@credo-ts/core'
import { type DidCommProofExchangeRecordProps, type DidCommProofFormatPayload } from '@credo-ts/didcomm'
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
import { BadRequest, HttpResponse, NotFoundError, UnprocessableEntityError } from '../../../error.js'
import {
  getMissingAnonCredsCredentials,
  hydrateAnonCredsAttributes,
  hydrateAnonCredsPredicates,
  isSimpleAnonCredsProofFormats,
  redactProofFormats,
  simplifyAnonCredsProofContent,
  transformProofFormats,
  transformProposeProofFormats,
  validatePexV1Presentation,
} from '../../../utils/proofs.js'
import { ProofRecordExample } from '../../examples.js'
import type {
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofRequestOptions,
  MatchingCredentialsResponse,
  NegotiateProofProposalOptions,
  ProofFormats,
  ProposeProofOptions,
  RequestProofOptions,
  SimpleProofFormats,
  UUID,
} from '../../types/index.js'

type InternalProposeProofOptions = Parameters<RestAgent['didcomm']['proofs']['proposeProof']>[0]
type InternalAcceptProofProposalOptions = Parameters<RestAgent['didcomm']['proofs']['acceptProposal']>[0]
type InternalNegotiateProofProposalOptions = Parameters<RestAgent['didcomm']['proofs']['negotiateProposal']>[0]
type InternalCreateProofRequestOptions = Parameters<RestAgent['didcomm']['proofs']['createRequest']>[0]
type InternalRequestProofOptions = Parameters<RestAgent['didcomm']['proofs']['requestProof']>[0]
type InternalAcceptProofRequestOptions = Parameters<RestAgent['didcomm']['proofs']['acceptRequest']>[0]

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
   * @returns DidCommProofExchangeRecordProps[]
   */
  @Example<DidCommProofExchangeRecordProps[]>([ProofRecordExample])
  @Get('/')
  public async getAllProofs(@Request() req: express.Request, @Query('threadId') threadId?: UUID) {
    let proofs = await this.agent.didcomm.proofs.getAll()
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
   * @returns DidCommProofExchangeRecordProps
   */
  @Get('/:proofRecordId')
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  public async getProofById(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Query('includeContent') includeContent = false
  ) {
    req.log.debug('getting proof record %s', proofRecordId)
    try {
      const proof = await this.agent.didcomm.proofs.getById(proofRecordId)
      req.log.info('proof found %j', proof)

      const result = proof.toJSON() as Record<string, unknown>

      if (includeContent) {
        const formatData = await this.agent.didcomm.proofs.getFormatData(proofRecordId)
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
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async getProofContent(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Query('view') view?: 'simplified'
  ): Promise<Record<string, unknown>> {
    req.log.debug('getting proof content for %s', proofRecordId)
    try {
      const formatData = await this.agent.didcomm.proofs.getFormatData(proofRecordId)
      req.log.info('proof content found for %s', proofRecordId)

      if (view === 'simplified') {
        return simplifyAnonCredsProofContent(formatData)
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
   * Retrieve matching credentials for a proof request
   *
   * @param proofRecordId
   * @returns MatchingCredentialsResponse
   */
  @Get('/:proofRecordId/credentials')
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async getMatchingCredentials(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID
  ): Promise<MatchingCredentialsResponse> {
    req.log.debug('getting matching credentials for proof record %s', proofRecordId)
    try {
      const credentials = await this.agent.didcomm.proofs.getCredentialsForRequest({
        proofExchangeRecordId: proofRecordId,
      })

      req.log.info('matching credentials found for %s', proofRecordId)
      return credentials
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError(`No matching credentials found for proof record ${proofRecordId}`)
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
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async deleteProof(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    try {
      this.setStatus(204)
      req.log.info('deleting proof %s', proofRecordId)
      await this.agent.didcomm.proofs.deleteById(proofRecordId)
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
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/propose-proof')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  @Response<UnprocessableEntityError>(422)
  public async proposeProof(@Request() req: express.Request, @Body() proposal: ProposeProofOptions) {
    try {
      if (proposal.proofFormats.presentationExchange?.presentationDefinition) {
        const errors = validatePexV1Presentation(proposal.proofFormats.presentationExchange.presentationDefinition)
        if (errors) throw new UnprocessableEntityError('Validation Failed', errors)
      }

      const proof = await this.agent.didcomm.proofs.proposeProof({
        ...proposal,
        proofFormats: transformProposeProofFormats(proposal.proofFormats),
      } satisfies InternalProposeProofOptions)
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
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-proposal')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Body()
    proposal: AcceptProofProposalOptions
  ) {
    try {
      req.log.info('accepting %s proof proposal %j', proofRecordId, proposal)

      const proof = await this.agent.didcomm.proofs.acceptProposal({
        ...proposal,
        // Path parameter takes precedence over body property to ensure URL authority
        proofExchangeRecordId: proofRecordId,
      } satisfies InternalAcceptProofProposalOptions)

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof proposal not found')
      }
      throw error
    }
  }

  /**
   * Negotiate a presentation proposal as verifier by sending a counter-request message
   * to the connection associated with the proof record.
   *
   * @param proofRecordId
   * @param options
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/:proofRecordId/negotiate-proposal')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  @Response<UnprocessableEntityError>(422)
  public async negotiateProposal(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Body() options: NegotiateProofProposalOptions
  ) {
    try {
      req.log.info('negotiating %s proof proposal %j', proofRecordId, options)

      if (options.proofFormats.presentationExchange?.presentationDefinition) {
        const errors = validatePexV1Presentation(options.proofFormats.presentationExchange.presentationDefinition)
        if (errors) throw new UnprocessableEntityError('Validation Failed', errors)
      }

      const proof = await this.agent.didcomm.proofs.negotiateProposal({
        ...options,
        // Path parameter takes precedence over body property to ensure URL authority
        proofExchangeRecordId: proofRecordId,
        proofFormats: transformProofFormats(options.proofFormats),
      } satisfies InternalNegotiateProofProposalOptions)

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
  @Example<{ message: Record<string, unknown>; proofRecord: DidCommProofExchangeRecordProps }>({
    message: {},
    proofRecord: ProofRecordExample,
  })
  @Response<UnprocessableEntityError>(422)
  public async createRequest(@Request() req: express.Request, @Body() request: CreateProofRequestOptions) {
    const { proofFormats, ...rest } = request
    req.log.debug('creating proof request %j', { proofFormats, ...rest })
    if (proofFormats.presentationExchange?.presentationDefinition) {
      const errors = validatePexV1Presentation(proofFormats.presentationExchange.presentationDefinition)
      if (errors) throw new UnprocessableEntityError('Validation Failed', errors)
    }

    const { message, proofRecord } = await this.agent.didcomm.proofs.createRequest({
      proofFormats: transformProofFormats(proofFormats),
      ...rest,
    } satisfies InternalCreateProofRequestOptions)

    req.log.info('returning proof record %j', { proofRecord, message })

    return {
      message,
      proofRecord,
    }
  }

  /**
   * Creates a presentation request bound to existing connection
   *
   * @param request
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/request-proof')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  @Response<UnprocessableEntityError>(422)
  public async requestProof(@Request() req: express.Request, @Body() body: RequestProofOptions) {
    const { connectionId, proofFormats, ...rest } = body
    try {
      req.log.info('requesting proof for %s connection %j', connectionId, body)
      if (proofFormats.presentationExchange?.presentationDefinition) {
        const errors = validatePexV1Presentation(proofFormats.presentationExchange.presentationDefinition)
        if (errors) throw new UnprocessableEntityError('Validation Failed', errors)
      }

      const proof = await this.agent.didcomm.proofs.requestProof({
        connectionId,
        proofFormats: transformProofFormats(proofFormats),
        ...rest,
      } satisfies InternalRequestProofOptions)

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
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-request')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  @Response<BadRequest>(400)
  @Response<UnprocessableEntityError>(422)
  public async acceptRequest(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: UUID,
    @Body()
    body: AcceptProofRequestOptions
  ) {
    try {
      let formatsToAccept: DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>

      if (!body.proofFormats) {
        req.log.info('retrieving credentials for %s proof', proofRecordId)
        const retrievedCredentials = await this.agent.didcomm.proofs.selectCredentialsForRequest({
          proofExchangeRecordId: proofRecordId,
        })
        formatsToAccept = retrievedCredentials.proofFormats as DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>
        req.log.info(
          'credentials found (redacted) %j',
          redactProofFormats(
            retrievedCredentials.proofFormats as DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>
          )
        )
      } else if (isSimpleAnonCredsProofFormats(body.proofFormats)) {
        const requestedAnonCreds = body.proofFormats.anoncreds

        if (!requestedAnonCreds) {
          throw new BadRequest(
            'Internal error: simplified proof formats missing anoncreds after type guard. This indicates an unexpected internal state; please contact support.',
            {
              code: 'missing_anoncreds_after_type_guard',
              proofRecordId,
            }
          )
        }

        formatsToAccept = await this.hydrateProofFormats(req, proofRecordId, requestedAnonCreds)
      } else {
        formatsToAccept = body.proofFormats as DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>
        const fullFormatAnonCreds = formatsToAccept.anoncreds
        const fullFormatPresentationExchange = formatsToAccept.presentationExchange

        if (fullFormatPresentationExchange && 'credentials' in fullFormatPresentationExchange) {
          throw new UnprocessableEntityError('Validation Failed', {
            'proofFormats.presentationExchange.credentials': {
              message:
                'Client-supplied presentationExchange.credentials is not supported for accept-request. Omit credentials and allow server-side selection.',
              value: fullFormatPresentationExchange.credentials,
            },
          })
        }

        // Added validation for empty formats
        if (
          fullFormatAnonCreds &&
          (!fullFormatAnonCreds.attributes || Object.keys(fullFormatAnonCreds.attributes).length === 0) &&
          (!fullFormatAnonCreds.predicates || Object.keys(fullFormatAnonCreds.predicates).length === 0)
        ) {
          throw new BadRequest('Invalid proof formats', {
            code: 'invalid_proof_formats',
            errors: ['must have at least one attribute or predicate'],
          })
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
      req.log.debug('accepting proof request with formats %j', redactProofFormats(formatsToAccept))

      const options = {
        ...body,
        // Path parameter takes precedence over body property to ensure URL authority
        proofExchangeRecordId: proofRecordId,
        proofFormats: formatsToAccept as unknown as InternalAcceptProofRequestOptions['proofFormats'],
      } satisfies InternalAcceptProofRequestOptions

      const proof = await this.agent.didcomm.proofs.acceptRequest(options)

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
   * @returns DidCommProofExchangeRecordProps
   */
  @Post('/:proofRecordId/accept-presentation')
  @Example<DidCommProofExchangeRecordProps>(ProofRecordExample)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async acceptPresentation(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    try {
      req.log.info('accepting proof presentation %s', proofRecordId)
      const proof = await this.agent.didcomm.proofs.acceptPresentation({ proofExchangeRecordId: proofRecordId })

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
  ): Promise<DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>> {
    req.log.info('hydrating simplified proof formats for %s proof', proofRecordId)

    const availableCredentials = await this.agent.didcomm.proofs.getCredentialsForRequest({
      proofExchangeRecordId: proofRecordId,
    })
    const availableAnonCreds = (
      availableCredentials.proofFormats as {
        anoncreds?: {
          attributes?: Record<string, AnonCredsRequestedAttributeMatch[]>
          predicates?: Record<string, AnonCredsRequestedPredicateMatch[]>
        }
      }
    ).anoncreds

    const attrCount = Object.keys(availableAnonCreds?.attributes || {}).length
    const predCount = Object.keys(availableAnonCreds?.predicates || {}).length
    req.log.info('available credentials for hydration: %d attributes, %d predicates', attrCount, predCount)

    if (!availableAnonCreds) {
      req.log.warn(
        'Could not hydrate proof formats: no available credentials found for proofRecordId=%s. Requested attributes: %j, predicates: %j.',
        proofRecordId,
        requestedAnonCreds.attributes ?? {},
        requestedAnonCreds.predicates ?? {}
      )
      throw new NotFoundError(
        `Could not hydrate proof formats: no available credentials found for proofRecordId=${proofRecordId}`
      )
    }

    const { hydrated: hydratedAttributes, errors: attrErrors } = hydrateAnonCredsAttributes(
      requestedAnonCreds.attributes,
      availableAnonCreds.attributes
    )
    if (attrErrors.length > 0) {
      throw new BadRequest('Proof format hydration failed', {
        code: 'proof_format_hydration_failed',
        errors: attrErrors,
      })
    }
    const hydratedPredicates = hydrateAnonCredsPredicates(requestedAnonCreds.predicates, availableAnonCreds.predicates)

    const missingAttributes = getMissingAnonCredsCredentials(requestedAnonCreds.attributes, hydratedAttributes)
    const missingPredicates = getMissingAnonCredsCredentials(requestedAnonCreds.predicates, hydratedPredicates)

    if (missingAttributes.length > 0 || missingPredicates.length > 0) {
      const formatDetails = (items: typeof missingAttributes, type: string) =>
        items.length > 0 ? `${type}: ${items.map((i) => `${i.name} (credId: ${i.credentialId})`).join(', ')}` : ''

      const details = [formatDetails(missingAttributes, 'attributes'), formatDetails(missingPredicates, 'predicates')]
        .filter(Boolean)
        .join('; ')

      req.log.warn(`Could not hydrate proof formats: no matching credentials found for requested ${details}`)
      throw new NotFoundError(`Could not hydrate proof formats: no matching credentials found for requested ${details}`)
    }

    return {
      anoncreds: {
        attributes: hydratedAttributes,
        predicates: hydratedPredicates,
        selfAttestedAttributes: {},
      },
    }
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
}
