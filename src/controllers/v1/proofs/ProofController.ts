import { type ProofExchangeRecordProps, Agent, RecordNotFoundError } from '@credo-ts/core'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { type RecordId, ProofRecordExample } from '../../examples.js'
import { HttpResponse, NotFound } from '../../../error.js'
import type { RestAgent } from '../../../utils/agent.js'
import { transformProofFormat } from '../../../utils/proofs.js'
import type {
  AcceptProofRequestOptions,
  RequestProofOptions,
  CreateProofRequestOptions,
  ProposeProofOptions,
  AcceptProofProposalOptions,
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
  public async getAllProofs(@Query('threadId') threadId?: string) {
    let proofs = await this.agent.proofs.getAll()

    if (threadId) proofs = proofs.filter((p) => p.threadId === threadId)

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
  public async getProofById(@Path('proofRecordId') proofRecordId: RecordId) {
    try {
      const proof = await this.agent.proofs.getById(proofRecordId)

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteProof(@Path('proofRecordId') proofRecordId: RecordId) {
    try {
      this.setStatus(204)
      await this.agent.proofs.deleteById(proofRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeProof(@Body() proposal: ProposeProofOptions) {
    try {
      const proof = await this.agent.proofs.proposeProof(proposal)

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connectionId "${proposal.connectionId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Path('proofRecordId') proofRecordId: string,
    @Body()
    proposal: AcceptProofProposalOptions
  ) {
    try {
      const proof = await this.agent.proofs.acceptProposal({
        proofRecordId,
        ...proposal,
      })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
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
  @Example<{ message: object; proofRecord: ProofExchangeRecordProps }>({
    message: {},
    proofRecord: ProofRecordExample,
  })
  public async createRequest(@Body() request: CreateProofRequestOptions) {
    const { proofFormats, ...rest } = request
    const { message, proofRecord } = await this.agent.proofs.createRequest({
      proofFormats: {
        anoncreds: transformProofFormat(proofFormats.anoncreds),
      },
      ...rest,
    })

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
  public async requestProof(@Body() request: RequestProofOptions) {
    const { connectionId, proofFormats, ...rest } = request
    try {
      const proof = await this.agent.proofs.requestProof({
        connectionId,
        proofFormats: {
          anoncreds: transformProofFormat(proofFormats.anoncreds),
        },
        ...rest,
      })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connectionId "${connectionId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(
    @Path('proofRecordId') proofRecordId: string,
    @Body()
    request: AcceptProofRequestOptions
  ) {
    try {
      const retrievedCredentials = await this.agent.proofs.selectCredentialsForRequest({
        proofRecordId,
      })

      const proof = await this.agent.proofs.acceptRequest({
        proofRecordId,
        proofFormats: retrievedCredentials.proofFormats,
        ...request,
      })

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
  public async acceptPresentation(@Path('proofRecordId') proofRecordId: string) {
    try {
      const proof = await this.agent.proofs.acceptPresentation({ proofRecordId })

      return proof.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`proof with proofRecordId "${proofRecordId}" not found.`)
      }
      throw error
    }
  }
}
