import {
  type ConnectionRecordProps,
  type CreateLegacyInvitationConfig,
  type CreateOutOfBandInvitationConfig,
  type ReceiveOutOfBandImplicitInvitationConfig,
  Agent,
  AgentMessage,
  JsonTransformer,
  OutOfBandInvitation,
  RecordNotFoundError,
} from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { HttpResponse, NotFoundError } from '../../../error.js'
import {
  type OutOfBandInvitationProps,
  type OutOfBandRecordWithInvitationProps,
  type UUID,
  ConnectionRecordExample,
  outOfBandInvitationExample,
  outOfBandRecordExample,
} from '../../examples.js'
import type {
  AcceptInvitationConfig,
  AgentMessageType,
  ReceiveInvitationByUrlProps,
  ReceiveInvitationProps,
} from '../../types.js'

@Tags('Out Of Band')
@Route('/v1/oob')
@injectable()
export class OutOfBandController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve all out of band records
   * @param invitationId invitation identifier
   * @returns OutOfBandRecord[]
   */
  @Example<OutOfBandRecordWithInvitationProps[]>([outOfBandRecordExample])
  @Get()
  public async getAllOutOfBandRecords(@Query('invitationId') invitationId?: UUID) {
    let outOfBandRecords = await this.agent.oob.getAll()

    if (invitationId) outOfBandRecords = outOfBandRecords.filter((o) => o.outOfBandInvitation.id === invitationId)

    return outOfBandRecords.map((c) => c.toJSON())
  }

  /**
   * Retrieve an out of band record by id
   * @param recordId record identifier
   * @returns OutOfBandRecord
   */
  @Example<OutOfBandRecordWithInvitationProps>(outOfBandRecordExample)
  @Get('/:outOfBandId')
  @Response<NotFoundError['message']>(404)
  public async getOutOfBandRecordById(@Request() req: express.Request, @Path('outOfBandId') outOfBandId: UUID) {
    const outOfBandRecord = await this.agent.oob.findById(outOfBandId)

    if (!outOfBandRecord) {
      throw new NotFoundError('OOB record not found')
    }

    req.log.debug('returning OOB record %j', outOfBandRecord.toJSON())

    return outOfBandRecord.toJSON()
  }

  /**
   * Creates an outbound out-of-band record containing out-of-band invitation message defined in
   * Aries RFC 0434: Out-of-Band Protocol 1.1.
   * @param config configuration of how out-of-band invitation should be created
   * @returns Out of band record
   */
  @Example<{
    invitationUrl: string
    invitation: OutOfBandInvitationProps
    outOfBandRecord: OutOfBandRecordWithInvitationProps
  }>({
    invitationUrl: 'string',
    invitation: outOfBandInvitationExample,
    outOfBandRecord: outOfBandRecordExample,
  })
  @Post('/create-invitation')
  public async createInvitation(
    @Request() req: express.Request,
    @Body() config?: Omit<CreateOutOfBandInvitationConfig, 'routing' | 'appendedAttachments' | 'messages'> // props removed because of issues with serialization
  ) {
    const outOfBandRecord = await this.agent.oob.createInvitation(config)
    req.log.info('invitation has been created %j', outOfBandRecord.toJSON())

    return {
      invitationUrl: outOfBandRecord.outOfBandInvitation.toUrl({
        domain: this.agent.config.endpoints[0],
      }),
      invitation: outOfBandRecord.outOfBandInvitation.toJSON({
        useDidSovPrefixWhereAllowed: this.agent.config.useDidSovPrefixWhereAllowed,
      }),
      outOfBandRecord: outOfBandRecord.toJSON(),
    }
  }

  /**
   * Creates an outbound out-of-band record in the same way how `createInvitation` method does it,
   * but it also converts out-of-band invitation message to an "legacy" invitation message defined
   * in RFC 0160: Connection Protocol and returns it together with out-of-band record.
   *
   * @param config configuration of how a invitation should be created
   * @returns out-of-band record and invitation
   */
  @Example<{ invitation: OutOfBandInvitationProps; outOfBandRecord: OutOfBandRecordWithInvitationProps }>({
    invitation: outOfBandInvitationExample,
    outOfBandRecord: outOfBandRecordExample,
  })
  @Post('/create-legacy-invitation')
  public async createLegacyInvitation(
    @Request() req: express.Request,
    @Body() config?: Omit<CreateLegacyInvitationConfig, 'routing'> // routing prop removed because of issues with public key serialization
  ) {
    const { outOfBandRecord, invitation } = await this.agent.oob.createLegacyInvitation(config)
    req.log.info('legacy invitation has been created %j', outOfBandRecord.toJSON())

    return {
      invitationUrl: invitation.toUrl({
        domain: this.agent.config.endpoints[0],
        useDidSovPrefixWhereAllowed: this.agent.config.useDidSovPrefixWhereAllowed,
      }),
      invitation: invitation.toJSON({
        useDidSovPrefixWhereAllowed: this.agent.config.useDidSovPrefixWhereAllowed,
      }),
      outOfBandRecord: outOfBandRecord.toJSON(),
    }
  }

  /**
   * Creates a new connectionless legacy invitation.
   *
   * @param config configuration of how a connection invitation should be created
   * @returns a message and a invitationUrl
   */
  @Example<{ message: AgentMessageType; invitationUrl: string }>({
    message: {
      '@id': 'eac4ff4e-b4fb-4c1d-aef3-b29c89d1cc00',
      '@type': 'https://didcomm.org/connections/1.x/invitation',
    },
    invitationUrl: 'http://example.com/invitation_url',
  })
  @Post('/create-legacy-connectionless-invitation')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async createLegacyConnectionlessInvitation(
    @Request() req: express.Request,
    @Body()
    config: {
      recordId: string
      message: AgentMessageType
      domain: string
    }
  ) {
    try {
      const agentMessage = JsonTransformer.fromJSON(config.message, AgentMessage)
      req.log.info('creating a legacy connectionless invitation %j', config)

      return await this.agent.oob.createLegacyConnectionlessInvitation({
        ...config,
        message: agentMessage,
      })
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('invitation not found')
      }
      throw error
    }
  }

  /**
   * Creates inbound out-of-band record and assigns out-of-band invitation message to it if the
   * message is valid.
   *
   * @param invitation either OutOfBandInvitation or ConnectionInvitationMessage
   * @param config config for handling of invitation
   * @returns out-of-band record and connection record if one has been created.
   */
  @Example<{ outOfBandRecord: OutOfBandRecordWithInvitationProps; connectionRecord: ConnectionRecordProps }>({
    outOfBandRecord: outOfBandRecordExample,
    connectionRecord: ConnectionRecordExample,
  })
  @Post('/receive-invitation')
  public async receiveInvitation(@Request() req: express.Request, @Body() invitationRequest: ReceiveInvitationProps) {
    const { invitation, ...config } = invitationRequest

    const invite = new OutOfBandInvitation({ ...invitation, handshakeProtocols: invitation.handshake_protocols })
    req.log.info('received OOB invitation %j', invite)
    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveInvitation(invite, config)

    req.log.debug('OOB invitation details %j', {
      OOB: outOfBandRecord.toJSON(),
      connection: connectionRecord?.toJSON(),
    })

    return {
      outOfBandRecord: outOfBandRecord.toJSON(),
      connectionRecord: connectionRecord?.toJSON(),
    }
  }
  /**
   * Creates inbound out-of-band record from an implicit invitation, given as public DID the agent should be able to resolve
   * It automatically passes out-of-band invitation for further
   * processing to `acceptInvitation` method. If you don't want to do that you can set
   * `autoAcceptInvitation` attribute in `config` parameter to `false` and accept the message later by
   * calling `acceptInvitation`.
   *
   * @param config config for creating and handling invitation
   * @returns out-of-band record and connection record if one has been created.
   */
  @Example<{ outOfBandRecord: OutOfBandRecordWithInvitationProps; connectionRecord: ConnectionRecordProps }>({
    outOfBandRecord: outOfBandRecordExample,
    connectionRecord: ConnectionRecordExample,
  })
  @Post('/receive-implicit-invitation')
  @Response<HttpResponse>(500)
  public async receiveImplicitInvitation(
    @Request() req: express.Request,
    @Body() config: ReceiveOutOfBandImplicitInvitationConfig
  ) {
    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveImplicitInvitation(config)
    req.log.info('received implicit invitation %j', {
      OOB: outOfBandRecord.toJSON(),
      connection: connectionRecord?.toJSON(),
    })

    return {
      outOfBandRecord: outOfBandRecord.toJSON(),
      connectionRecord: connectionRecord?.toJSON(),
    }
  }

  /**
   * Creates inbound out-of-band record and assigns out-of-band invitation message to it if the
   * message is valid.
   *
   * @param invitationUrl invitation url
   * @param config config for handling of invitation
   * @returns out-of-band record and connection record if one has been created.
   */
  @Example<{ outOfBandRecord: OutOfBandRecordWithInvitationProps; connectionRecord: ConnectionRecordProps }>({
    outOfBandRecord: outOfBandRecordExample,
    connectionRecord: ConnectionRecordExample,
  })
  @Post('/receive-invitation-url')
  public async receiveInvitationFromUrl(
    @Request() req: express.Request,
    @Body() invitationRequest: ReceiveInvitationByUrlProps
  ) {
    const { invitationUrl, ...config } = invitationRequest
    req.log.info('invitation from url %s', invitationUrl)

    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl, config)
    req.log.info('received invitation from url %j', {
      OOB: outOfBandRecord.toJSON(),
      connection: connectionRecord?.toJSON(),
    })

    return {
      outOfBandRecord: outOfBandRecord.toJSON(),
      connectionRecord: connectionRecord?.toJSON(),
    }
  }

  /**
   * Accept a connection invitation as invitee (by sending a connection request message) for the connection with the specified connection id.
   * This is not needed when auto accepting of connections is enabled.
   */
  @Example<{ outOfBandRecord: OutOfBandRecordWithInvitationProps; connectionRecord: ConnectionRecordProps }>({
    outOfBandRecord: outOfBandRecordExample,
    connectionRecord: ConnectionRecordExample,
  })
  @Post('/:outOfBandId/accept-invitation')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptInvitation(
    @Request() req: express.Request,
    @Path('outOfBandId') outOfBandId: UUID,
    @Body() acceptInvitationConfig: AcceptInvitationConfig
  ) {
    try {
      const { outOfBandRecord, connectionRecord } = await this.agent.oob.acceptInvitation(
        outOfBandId,
        acceptInvitationConfig
      )

      req.log.info('OOB invitation accepted %j', {
        OOB: outOfBandRecord.toJSON(),
        connection: connectionRecord?.toJSON(),
      })

      return {
        outOfBandRecord: outOfBandRecord.toJSON(),
        connectionRecord: connectionRecord?.toJSON(),
      }
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('OOB invitation not found')
      }
      throw error
    }
  }

  /**
   * Deletes an out of band record from the repository.
   *
   * @param outOfBandId Record identifier
   */
  @Delete('/:outOfBandId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteOutOfBandRecord(@Request() req: express.Request, @Path('outOfBandId') outOfBandId: UUID) {
    try {
      this.setStatus(204)
      req.log.info('deleting OOB record %s', outOfBandId)
      await this.agent.oob.deleteById(outOfBandId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('OOB record not found')
      }
      throw error
    }
  }
}
