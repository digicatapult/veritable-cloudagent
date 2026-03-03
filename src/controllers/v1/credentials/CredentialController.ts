import { Agent, RecordNotFoundError } from '@credo-ts/core'
import {
  type DidCommCredentialExchangeRecordProps,
  DidCommCredentialExchangeRepository,
  DidCommCredentialState,
  type SendCredentialProblemReportOptions,
} from '@credo-ts/didcomm'
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
import { transformToCredentialFormatData, validateJsonLdCredentialProfile } from '../../../utils/credentials.js'
import { CredentialExchangeRecordExample, CredentialFormatDataExample } from '../../examples.js'

type InternalProposeCredentialOptions = Parameters<RestAgent['didcomm']['credentials']['proposeCredential']>[0]
type InternalAcceptCredentialProposalOptions = Parameters<RestAgent['didcomm']['credentials']['acceptProposal']>[0]
type InternalCreateOfferOptions = Parameters<RestAgent['didcomm']['credentials']['createOffer']>[0]
type InternalOfferCredentialOptions = Parameters<RestAgent['didcomm']['credentials']['offerCredential']>[0]
type InternalAcceptCredentialOfferOptions = Parameters<RestAgent['didcomm']['credentials']['acceptOffer']>[0]
type InternalAcceptCredentialRequestOptions = Parameters<RestAgent['didcomm']['credentials']['acceptRequest']>[0]

import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateOfferOptions,
  CredentialFormatData,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  UUID,
} from '../../types/index.js'

@Tags('Credentials')
@Route('/v1/credentials')
@injectable()
export class CredentialController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve all credential exchange records
   *
   * @returns CredentialExchangeRecord[]
   */
  @Example<DidCommCredentialExchangeRecordProps[]>([CredentialExchangeRecordExample])
  @Get('/')
  public async getAllCredentials(
    @Query('threadId') threadId?: UUID,
    @Query('connectionId') connectionId?: UUID,
    @Query('state') state?: DidCommCredentialState
  ) {
    const credentialRepository = this.agent.dependencyManager.resolve(DidCommCredentialExchangeRepository)

    const credentials = await credentialRepository.findByQuery(this.agent.context, {
      connectionId,
      threadId,
      state,
    })

    return credentials.map((c) => c.toJSON())
  }

  /**
   * Retrieve credential exchange record by credential record id
   *
   * @param credentialRecordId
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Get('/:credentialRecordId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async getCredentialById(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID
  ) {
    try {
      req.log.info('retrieving %s credential by id', credentialRecordId)
      const credential = await this.agent.didcomm.credentials.getById(credentialRecordId)

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential record not found')
      }
      throw error
    }
  }

  /**
   * Retrieve format-data for a credential by credential record id
   *
   * @param credentialRecordId
   * @returns CredentialFormatData
   */
  @Example<CredentialFormatData>(CredentialFormatDataExample)
  @Get('/:credentialRecordId/format-data')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async getCredentialFormatDataById(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID
  ): Promise<CredentialFormatData> {
    try {
      req.log.info('getting format data for %s', credentialRecordId)
      const formatData = await this.agent.didcomm.credentials.getFormatData(credentialRecordId)

      return transformToCredentialFormatData(formatData)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('format data not found')
      }
      throw error
    }
  }

  /**
   * Deletes a credential exchange record in the credential repository.
   *
   * @param credentialRecordId
   */
  @Delete('/:credentialRecordId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteCredential(@Request() req: express.Request, @Path('credentialRecordId') credentialRecordId: UUID) {
    try {
      this.setStatus(204)
      req.log.info('deleting credential %s', credentialRecordId)
      await this.agent.didcomm.credentials.deleteById(credentialRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential record not found')
      }
      throw error
    }
  }

  /**
   * Initiate a new credential exchange as holder by sending a propose credential message
   * to the connection with a specified connection id.
   *
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/propose-credential')
  @Response<BadRequest>(400)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeCredential(@Request() req: express.Request, @Body() options: ProposeCredentialOptions) {
    try {
      if (options.credentialFormats.jsonld) {
        const validationErrors = validateJsonLdCredentialProfile(options.credentialFormats.jsonld)
        if (validationErrors) throw new BadRequest('Validation Failed', validationErrors)
      }

      req.log.info('proposing credential to %s', options.connectionId)
      const credential = await this.agent.didcomm.credentials.proposeCredential(
        options satisfies InternalProposeCredentialOptions
      )
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('connection not found')
      }
      throw error
    }
  }

  /**
   * Accept a credential proposal as issuer by sending an accept proposal message
   * to the connection associated with the credential exchange record.
   *
   * @param credentialRecordId credential identifier
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-proposal')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID,
    @Body() options?: AcceptCredentialProposalOptions
  ) {
    try {
      req.log.debug('accepting credential proposal for %s', credentialRecordId)
      const credential = await this.agent.didcomm.credentials.acceptProposal({
        ...(options ?? {}),
        credentialExchangeRecordId: credentialRecordId,
      } satisfies InternalAcceptCredentialProposalOptions)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential proposal not found')
      }
      throw error
    }
  }

  /**
   * Initiate a new credential exchange as issuer by creating a credential offer
   * without specifying a connection id
   *
   * @param options
   * @returns AgentMessage, CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/create-offer')
  @Response<BadRequest>(400)
  public async createOffer(@Request() req: express.Request, @Body() options: CreateOfferOptions) {
    if (options.credentialFormats.jsonld) {
      const validationErrors = validateJsonLdCredentialProfile(options.credentialFormats.jsonld)
      if (validationErrors) throw new BadRequest('Validation Failed', validationErrors)
    }

    const offer = await this.agent.didcomm.credentials.createOffer(options satisfies InternalCreateOfferOptions)
    req.log.info('credential offer has been created %j', offer)

    return {
      message: offer.message.toJSON(),
      credentialExchangeRecord: offer.credentialExchangeRecord.toJSON(),
    }
  }

  /**
   * Initiate a new credential exchange as issuer by sending a offer credential message
   * to the connection with the specified connection id.
   *
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/offer-credential')
  @Response<BadRequest>(400)
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async offerCredential(@Request() req: express.Request, @Body() options: OfferCredentialOptions) {
    if (options.credentialFormats.jsonld) {
      const validationErrors = validateJsonLdCredentialProfile(options.credentialFormats.jsonld)
      if (validationErrors) throw new BadRequest('Validation Failed', validationErrors)
    }

    req.log.debug('checking if connection %s exists', options.connectionId)
    const connection = await this.agent.didcomm.connections.findById(options.connectionId)
    if (!connection) {
      throw new NotFoundError('connection not found')
    }

    try {
      const credential = await this.agent.didcomm.credentials.offerCredential(
        options satisfies InternalOfferCredentialOptions
      )
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError(
          `credential definition "${options.credentialFormats.anoncreds?.credentialDefinitionId}" not found`
        )
      }
      throw error
    }
  }

  /**
   * Accept a credential offer as holder by sending an accept offer message
   * to the connection associated with the credential exchange record.
   *
   * @param credentialRecordId credential identifier
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-offer')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptOffer(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID,
    @Body() options?: AcceptCredentialOfferOptions
  ) {
    try {
      const credential = await this.agent.didcomm.credentials.acceptOffer({
        ...(options ?? {}),
        credentialExchangeRecordId: credentialRecordId,
      } satisfies InternalAcceptCredentialOfferOptions)
      req.log.debug('returning credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential offer not found')
      }
      throw error
    }
  }

  /**
   * Accept a credential request as issuer by sending an accept request message
   * to the connection associated with the credential exchange record.
   *
   * @param credentialRecordId credential identifier
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-request')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID,
    @Body() options?: AcceptCredentialRequestOptions
  ) {
    try {
      const credential = await this.agent.didcomm.credentials.acceptRequest({
        ...(options ?? {}),
        credentialExchangeRecordId: credentialRecordId,
      } satisfies InternalAcceptCredentialRequestOptions)
      req.log.debug('returning credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential request not found')
      }
      throw error
    }
  }

  /**
   * Accept a credential as holder by sending an accept credential message
   * to the connection associated with the credential exchange record.
   *
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-credential')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptCredential(@Request() req: express.Request, @Path('credentialRecordId') credentialRecordId: UUID) {
    try {
      const credential = await this.agent.didcomm.credentials.acceptCredential({
        credentialExchangeRecordId: credentialRecordId,
      })
      req.log.debug('returning credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential not found')
      }
      throw error
    }
  }

  /**
   * Send problem report regarding a credential
   * to the connection associated with the credential exchange record.
   *
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<DidCommCredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/send-problem-report')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async sendProblemReport(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: UUID,
    @Body() body: { description: string }
  ) {
    const options: SendCredentialProblemReportOptions = {
      credentialExchangeRecordId: credentialRecordId,
      description: body.description,
    }

    try {
      const problemReport = await this.agent.didcomm.credentials.sendProblemReport(options)
      req.log.debug('returning problem report %j', problemReport.toJSON())

      return problemReport.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('credential record not found')
      }
      throw error
    }
  }
}
