import type { RestAgent } from '../../utils/agent'
import type { CredentialExchangeRecordProps } from '@aries-framework/core'

import { CredentialRepository, CredentialState, Agent, RecordNotFoundError } from '@aries-framework/core'
import { Body, Controller, Delete, Get, Path, Post, Route, Tags, Example, Query, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { CredentialExchangeRecordExample, RecordId } from '../examples'
import { HttpResponse, NotFound } from '../../error'
import {
  AcceptCredentialRequestOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  AcceptCredentialProposalOptions,
  AcceptCredentialOfferOptions,
  CreateOfferOptions,
} from '../types'

@Tags('Credentials')
@Route('/credentials')
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
  public async getCredentialById(@Path('credentialRecordId') credentialRecordId: RecordId) {
    try {
      const credential = await this.agent.credentials.getById(credentialRecordId)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteCredential(@Path('credentialRecordId') credentialRecordId: RecordId) {
    try {
      this.setStatus(204)
      await this.agent.credentials.deleteById(credentialRecordId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/propose-credential')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async proposeCredential(@Body() options: ProposeCredentialOptions) {
    try {
      const credential = await this.agent.credentials.proposeCredential(options)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection record id "${options.connectionId}" not found.`)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-proposal')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptProposal(
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
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/create-offer')
  public async createOffer(@Body() options: CreateOfferOptions) {
    const offer = await this.agent.credentials.createOffer(options)
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
  public async offerCredential(@Body() options: OfferCredentialOptions) {
    try {
      //check connection exists
      const connection = await this.agent.connections.findById(options.connectionId)
      if (!connection) throw new NotFound(`connection with connection id "${options.connectionId}" not found.`)

      const credential = await this.agent.credentials.offerCredential(options)
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(
          `the credential definition id "${options.credentialFormats.anoncreds?.credentialDefinitionId}" not found.`
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-offer')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptOffer(
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() options?: AcceptCredentialOfferOptions
  ) {
    try {
      const credential = await this.agent.credentials.acceptOffer({
        ...options,
        credentialRecordId: credentialRecordId,
      })
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-request')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(
    @Path('credentialRecordId') credentialRecordId: RecordId,
    @Body() options?: AcceptCredentialRequestOptions
  ) {
    try {
      const credential = await this.agent.credentials.acceptRequest({
        ...options,
        credentialRecordId: credentialRecordId,
      })
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
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
  @Example<CredentialExchangeRecordProps>(CredentialExchangeRecordExample)
  @Post('/:credentialRecordId/accept-credential')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptCredential(@Path('credentialRecordId') credentialRecordId: RecordId) {
    try {
      const credential = await this.agent.credentials.acceptCredential({ credentialRecordId: credentialRecordId })
      return credential.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`credential with credential record id "${credentialRecordId}" not found.`)
      }
      throw error
    }
  }
}
