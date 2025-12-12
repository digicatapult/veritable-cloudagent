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
   * @returns ProofExchangeRecordProps
   */
  @Get('/:proofRecordId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  public async getProofById(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    req.log.debug('getting proof record %s', proofRecordId)
    try {
      const proof = await this.agent.proofs.getById(proofRecordId)
      req.log.info('proof found %j', proof)

      return proof.toJSON()
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

        req.log.info('hydrating simplified proof formats for %s proof', proofRecordId)

        const availableCredentials = await this.agent.proofs.getCredentialsForRequest({
          proofRecordId,
        })

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

        const hydratedProofFormats: ProofFormatPayload<ProofFormats, 'acceptRequest'> = {
          anoncreds: {
            attributes: {},
            predicates: {},
            selfAttestedAttributes: {},
          },
        }

        // Hydrate attributes
        if (requestedAnonCreds.attributes) {
          for (const [key, value] of Object.entries(requestedAnonCreds.attributes)) {
            const simpleAttr = value
            const matches = availableAnonCreds.output.attributes?.[key]
            if (matches) {
              const match = matches.find((m) => m.credentialId === simpleAttr.credentialId)
              if (match && hydratedProofFormats.anoncreds?.attributes) {
                hydratedProofFormats.anoncreds.attributes[key] = {
                  ...match,
                  revealed: match.revealed && simpleAttr.revealed,
                }
              }
            }
          }
        }

        // Hydrate predicates
        if (requestedAnonCreds.predicates) {
          for (const [key, value] of Object.entries(requestedAnonCreds.predicates)) {
            const simplePred = value

            const matches = availableAnonCreds.output.predicates?.[key]
            if (matches) {
              const match = matches.find((m) => m.credentialId === simplePred.credentialId)
              if (match && hydratedProofFormats.anoncreds?.predicates) {
                hydratedProofFormats.anoncreds.predicates[key] = match
              }
            }
          }
        }

        // Validation: ensure all requested attributes and predicates were hydrated
        const missingAttributes: Array<{ name: string; credentialId: string }> = []
        if (requestedAnonCreds.attributes) {
          for (const [key, value] of Object.entries(requestedAnonCreds.attributes)) {
            const hydrated = hydratedProofFormats.anoncreds?.attributes?.[key]
            if (!hydrated || hydrated.credentialId !== value.credentialId) {
              missingAttributes.push({ name: key, credentialId: value.credentialId })
            }
          }
        }
        const missingPredicates: Array<{ name: string; credentialId: string }> = []
        if (requestedAnonCreds.predicates) {
          for (const [key, value] of Object.entries(requestedAnonCreds.predicates)) {
            const hydrated = hydratedProofFormats.anoncreds?.predicates?.[key]
            if (!hydrated || hydrated.credentialId !== value.credentialId) {
              missingPredicates.push({ name: key, credentialId: value.credentialId })
            }
          }
        }
        if (missingAttributes.length > 0 || missingPredicates.length > 0) {
          const details = [
            missingAttributes.length > 0
              ? `attributes: ${missingAttributes.map((a) => `${a.name} (credId: ${a.credentialId})`).join(', ')}`
              : '',
            missingPredicates.length > 0
              ? `predicates: ${missingPredicates.map((p) => `${p.name} (credId: ${p.credentialId})`).join(', ')}`
              : '',
          ]
            .filter(Boolean)
            .join('; ')
          req.log.warn(`Could not hydrate proof formats: no matching credentials found for requested ${details}`)
          throw new NotFoundError(
            'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
          )
        }
        formatsToAccept = hydratedProofFormats
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
   * Retrieve the proposal message associated with a proof record
   *
   * @param proofRecordId
   * @returns Record<string, unknown>
   */
  @Get('/:proofRecordId/proposal-message')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async getProposalMessage(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: UUID) {
    req.log.debug('getting proposal message for proof record %s', proofRecordId)
    try {
      const message = await this.agent.proofs.findProposalMessage(proofRecordId)

      if (!message) {
        throw new NotFoundError('proposal message not found for this proof record')
      }

      // Log only non-sensitive metadata at info level
      req.log.info('proposal message found: type=%s id=%s', message.type, message.id)
      // Log full message at debug level if needed
      req.log.debug('full proposal message: %j', message.toJSON())

      return message.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('proof record not found')
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

  private isSimpleProofFormats(formats: AcceptProofRequestOptions['proofFormats']): formats is SimpleProofFormats {
    if (!formats || !('anoncreds' in formats)) return false

    const anoncreds = (formats as { anoncreds: unknown }).anoncreds as {
      attributes?: Record<string, unknown>
      predicates?: Record<string, unknown>
    }

    // Check if at least one of attributes or predicates exists and is non-empty
    const hasAttributes = anoncreds?.attributes && Object.keys(anoncreds.attributes).length > 0
    const hasPredicates = anoncreds?.predicates && Object.keys(anoncreds.predicates).length > 0

    if (!hasAttributes && !hasPredicates) return false

    // Validate attributes if present
    if (hasAttributes && anoncreds.attributes) {
      const attrValues = Object.values(anoncreds.attributes)
      for (const attr of attrValues) {
        if (
          typeof attr !== 'object' ||
          attr === null ||
          // Should only have credentialId and revealed keys
          !('credentialId' in attr) ||
          !('revealed' in attr) ||
          Object.keys(attr).length !== 2 ||
          // Should not have credentialInfo, even as undefined or null
          'credentialInfo' in attr
        ) {
          return false
        }
      }
    }

    // If predicates are present, check all have only credentialId and no credentialInfo
    if (hasPredicates && anoncreds.predicates) {
      const predValues = Object.values(anoncreds.predicates)
      for (const pred of predValues) {
        if (
          typeof pred !== 'object' ||
          pred === null ||
          !('credentialId' in pred) ||
          Object.keys(pred).length !== 1 ||
          'credentialInfo' in pred
        ) {
          return false
        }
      }
    }

    return true
  }
}
