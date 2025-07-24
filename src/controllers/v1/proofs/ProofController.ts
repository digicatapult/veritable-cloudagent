import { type ProofExchangeRecordProps, Agent, RecordNotFoundError } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { HttpResponse, NotFound } from '../../../error.js'
import { transformProofFormat } from '../../../utils/proofs.js'
import { type RecordId, ProofRecordExample } from '../../examples.js'
import type {
  AcceptProofProposalOptions,
  AcceptProofRequestOptions,
  CreateProofRequestOptions,
  ProposeProofOptions,
  RequestProofOptions,
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
  public async getAllProofs(@Request() req: express.Request, @Query('threadId') threadId?: string) {
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  @Example<ProofExchangeRecordProps>(ProofRecordExample)
  public async getProofById(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: RecordId) {
    req.log.debug('getting %s proof record', proofRecordId)
    try {
      const proof = await this.agent.proofs.getById(proofRecordId)
      req.log.info('proof found %j', proof)

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s proof not found', proofRecordId)
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
      }
      req.log.warn(`${error}`)
      throw error
    }
  }

  /**
   * Deletes a proof record in the proof repository.
   *
   * @param proofRecordId
   */
  @Delete('/:proofRecordId')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteProof(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: RecordId) {
    try {
      this.setStatus(204)
      req.log.info('deleting %s proof', proofRecordId)
      await this.agent.proofs.deleteById(proofRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s proof not found', proofRecordId)
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
      }
      req.log.warn(`${error}`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeProof(@Request() req: express.Request, @Body() proposal: ProposeProofOptions) {
    try {
      req.log.info('proof proposal %j', proposal)
      const proof = await this.agent.proofs.proposeProof(proposal)
      req.log.info('proof %j', proof.toJSON())

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s connection not found', proposal.connectionId)
        throw new NotFound(`connection with connectionId "${proposal.connectionId}" not found.`)
      }
      req.log.warn(`${error}`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: string,
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
        req.log.warn('%s proof not found', proofRecordId)
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
      }
      req.log.warn(`${error}`)
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
    req.log.debug('creating a proof request %j', { proofFormats, ...rest })
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
  @Response<NotFound['message']>(404)
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
        req.log.warn('%s connection not found', connectionId)
        throw new NotFound(`connection with connectionId "${connectionId}" not found.`)
      }
      req.log.warn(`${error}`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(
    @Request() req: express.Request,
    @Path('proofRecordId') proofRecordId: string,
    @Body()
    body: AcceptProofRequestOptions
  ) {
    try {
      req.log.info('retrieving credentials for %s proof', proofRecordId)
      const retrievedCredentials = await this.agent.proofs.selectCredentialsForRequest({
        proofRecordId,
      })

      req.log.info('credentials found and accepting proof request %j', retrievedCredentials)
      const proof = await this.agent.proofs.acceptRequest({
        proofRecordId,
        proofFormats: retrievedCredentials.proofFormats,
        ...body,
      })

      req.log.debug('success, returning proof %j', proof.toJSON())

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptPresentation(@Request() req: express.Request, @Path('proofRecordId') proofRecordId: string) {
    try {
      const proof = await this.agent.proofs.acceptPresentation({ proofRecordId })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s proof not found', proofRecordId)
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
      }
      req.log.warn(`${error}`)
      throw error
    }
  }
}
