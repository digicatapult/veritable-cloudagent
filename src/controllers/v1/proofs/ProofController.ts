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
        req.log.info('credentials found %j', retrievedCredentials)
      } else if (this.isSimpleProofFormats(body.proofFormats)) {
        const anoncreds = body.proofFormats.anoncreds

        // Enhanced validation: must have at least one attribute or predicate, and correct structure
        const hasAttributes = anoncreds?.attributes && Object.keys(anoncreds.attributes).length > 0
        const hasPredicates = anoncreds?.predicates && Object.keys(anoncreds.predicates).length > 0
        if (!hasAttributes && !hasPredicates) {
          throw new BadRequest('Invalid simplified proof formats: must have at least one attribute or predicate')
        }
        // Validate attributes structure
        if (hasAttributes) {
          for (const [key, attr] of Object.entries(anoncreds.attributes)) {
            if (
              typeof attr !== 'object' ||
              typeof attr.credentialId !== 'string' ||
              typeof attr.revealed !== 'boolean'
            ) {
              throw new BadRequest(
                `Invalid attribute '${key}': must have 'credentialId' (string) and 'revealed' (boolean)`
              )
            }
          }
        }
        // Validate predicates structure
        if (hasPredicates) {
          for (const [key, pred] of Object.entries(anoncreds.predicates)) {
            if (
              typeof pred !== 'object' ||
              typeof pred.credentialId !== 'string'
            ) {
              throw new BadRequest(
                `Invalid predicate '${key}': must have 'credentialId' (string)`
              )
            }
          }
        }
        req.log.info('hydrating simplified proof formats for %s proof', proofRecordId)

        const availableCredentials = await this.agent.proofs.getCredentialsForRequest({
          proofRecordId,
        })

        const availableAnonCreds = (
          availableCredentials.proofFormats as ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'>
        ).anoncreds

        if (!availableAnonCreds) {
          throw new NotFoundError('Could not hydrate proof formats: no available credentials found')
        }

        const hydratedProofFormats: ProofFormatPayload<ProofFormats, 'acceptRequest'> = {
          anoncreds: {
            attributes: {},
            predicates: {},
            selfAttestedAttributes: {},
          },
        }

        // Hydrate attributes
        for (const [key, value] of Object.entries(anoncreds.attributes)) {
          const simpleAttr = value
          const matches = availableAnonCreds.output.attributes?.[key]
          if (matches) {
            const match = matches.find((m) => m.credentialId === simpleAttr.credentialId)
            if (match && hydratedProofFormats.anoncreds?.attributes) {
              hydratedProofFormats.anoncreds.attributes[key] = {
                ...match,
                revealed: simpleAttr.revealed,
              }
            }
          }
        }

        // Hydrate predicates
        if (anoncreds.predicates) {
          for (const [key, value] of Object.entries(anoncreds.predicates)) {
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
        for (const [key, value] of Object.entries(anoncreds.attributes)) {
          const hydrated = hydratedProofFormats.anoncreds?.attributes?.[key]
          if (!hydrated || hydrated.credentialId !== value.credentialId) {
            missingAttributes.push({ name: key, credentialId: value.credentialId })
          }
        }
        const missingPredicates: Array<{ name: string; credentialId: string }> = []
        if (anoncreds.predicates) {
          for (const [key, value] of Object.entries(anoncreds.predicates)) {
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
          throw new NotFoundError(
            `Could not hydrate proof formats: no matching credentials found for requested ${details}`
          )
        }
        formatsToAccept = hydratedProofFormats
      } else {
        formatsToAccept = body.proofFormats as ProofFormatPayload<ProofFormats, 'acceptRequest'>
        req.log.info('using provided proof formats for %s proof', proofRecordId)
      }

      req.log.info('accepting proof request with formats %j', formatsToAccept)
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

  private isSimpleProofFormats(formats: AcceptProofRequestOptions['proofFormats']): formats is SimpleProofFormats {
    if (!formats || !('anoncreds' in formats)) return false

    const anoncreds = (formats as { anoncreds: unknown }).anoncreds as {
      attributes?: Record<string, unknown>
      predicates?: Record<string, unknown>
    }
    if (!anoncreds?.attributes) return false

    // Check all attributes have only credentialId and revealed, and no credentialInfo
    const attrValues = Object.values(anoncreds.attributes)
    if (attrValues.length === 0) return false
    for (const attr of attrValues) {
      if (
        typeof attr !== 'object' ||
        attr === null ||
        // Should only have credentialId and revealed keys
        !('credentialId' in attr) ||
        !('revealed' in attr) ||
        Object.keys(attr).some(
          (key) => key !== 'credentialId' && key !== 'revealed'
        ) ||
        // Should not have credentialInfo, even as undefined or null
        'credentialInfo' in attr
      ) {
        return false
      }
    }

    // If predicates are present, check all have only credentialId and no credentialInfo
    if (anoncreds.predicates) {
      const predValues = Object.values(anoncreds.predicates)
      for (const pred of predValues) {
        if (
          typeof pred !== 'object' ||
          pred === null ||
          !('credentialId' in pred) ||
          Object.keys(pred).some((key) => key !== 'credentialId') ||
          'credentialInfo' in pred
        ) {
          return false
        }
      }
    }

    return true
  }
}
