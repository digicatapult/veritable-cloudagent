import {
  Agent,
  type CredentialExchangeRecordProps,
  CredentialRepository,
  CredentialState,
  RecordNotFoundError,
  type SendCredentialProblemReportOptions,
} from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { HttpResponse, NotFound } from '../../../error.js'
import { CredentialExchangeRecordExample, CredentialFormatDataExample, type RecordId } from '../../examples.js'
import type {
  AcceptCredentialOfferOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialRequestOptions,
  CreateOfferOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../types.js'

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
  @Example<CredentialExchangeRecordProps[]>([CredentialExchangeRecordExample])
  @Get('/')
  public async getAllCredentials(
    @Query('threadId') threadId?: string,
    @Query('connectionId') connectionId?: string,
    @Query('state') state?: CredentialState
  ) {
    const credentialRepository = this.agent.dependencyManager.resolve(CredentialRepository)

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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Get('/:credentialRecordId')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async getCredentialById(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId
  ) {
    try {
      req.log.info('retrieving %s credential by id', credentialRecordId)
      const credential = await this.agent.credentials.getById(credentialRecordId)

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
      throw error
    }
  }

  /**
   * Retrieve format-data for a credential by credential record id
   *
   * @param credentialRecordId
   * @returns GetCredentialFormatDataReturn
   */
  @Example<Awaited<ReturnType<RestAgent['credentials']['getFormatData']>>>(CredentialFormatDataExample)
  @Get('/:credentialRecordId/format-data')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async getCredentialFormatDataById(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId
  ) {
    try {
      const formatData = await this.agent.credentials.getFormatData(credentialRecordId)
      return formatData
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential format was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
      throw error
    }
  }

  /**
   * Deletes a credential exchange record in the credential repository.
   *
   * @param credentialRecordId
   */
  @Delete('/:credentialRecordId')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteCredential(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId
  ) {
    try {
      this.setStatus(204)
      await this.agent.credentials.deleteById(credentialRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/propose-credential')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeCredential(@Request() req: express.Request, @Body() options: ProposeCredentialOptions) {
    try {
      const credential = await this.agent.credentials.proposeCredential(options)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s connection was not found', options.connectionId)
        throw new NotFound(`connection with connection record id "${options.connectionId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-proposal')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() options?: AcceptCredentialProposalOptions
  ) {
    try {
      const credential = await this.agent.credentials.acceptProposal({
        ...options,
        credentialRecordId: credentialRecordId,
      })

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/create-offer')
  public async createOffer(@Request() req: express.Request, @Body() options: CreateOfferOptions) {
    const offer = await this.agent.credentials.createOffer(options)
    req.log.info('credential offer has been created %j', offer)

    return {
      message: offer.message.toJSON(),
      credentialRecord: offer.credentialRecord.toJSON(),
    }
  }

  /**
   * Initiate a new credential exchange as issuer by sending a offer credential message
   * to the connection with the specified connection id.
   *
   * @param options
   * @returns CredentialExchangeRecord
   */
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/offer-credential')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async offerCredential(@Request() req: express.Request, @Body() options: OfferCredentialOptions) {
    try {
      req.log.debug('checking if connection exists %s', options.connectionId)
      const connection = await this.agent.connections.findById(options.connectionId)
      if (!connection) {
        req.log.warn('%s connection was not found', options.connectionId)
        throw new NotFound(`connection with connection id "${options.connectionId}" not found.`)
      }

      const credential = await this.agent.credentials.offerCredential(options)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn(
          '%s credential definition was not found',
          options.credentialFormats.anoncreds?.credentialDefinitionId
        )
        throw new NotFound(
          `the credential definition id "${options.credentialFormats.anoncreds?.credentialDefinitionId}" not found.`
        )
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-offer')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptOffer(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() options?: AcceptCredentialOfferOptions
  ) {
    try {
      const credential = await this.agent.credentials.acceptOffer({
        ...options,
        credentialRecordId: credentialRecordId,
      })
      req.log.debug('returning a credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-request')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() options?: AcceptCredentialRequestOptions
  ) {
    try {
      const credential = await this.agent.credentials.acceptRequest({
        ...options,
        credentialRecordId: credentialRecordId,
      })
      req.log.debug('returning a credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-credential')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptCredential(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId
  ) {
    try {
      const credential = await this.agent.credentials.acceptCredential({ credentialRecordId: credentialRecordId })
      req.log.debug('returning a credential %j', credential.toJSON())

      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/send-problem-report')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async sendProblemReport(
    @Request() req: express.Request,
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() body: { description: string }
  ) {
    const options: SendCredentialProblemReportOptions = {
      credentialRecordId: credentialRecordId,
      description: body.description,
    }

    try {
      const problemReport = await this.agent.credentials.sendProblemReport(options)
      req.log.debug('returning problem report %j', problemReport.toJSON())

      return problemReport.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s credential was not found', credentialRecordId)
        throw new NotFound(`credential with credential record id "${options.credentialRecordId}" not found.`)
      }
      req.log.error('error occured %j', error)
      throw error
    }
  }
}
