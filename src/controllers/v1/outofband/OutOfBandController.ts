import {
  type ConnectionRecordProps,
  type CreateOutOfBandInvitationConfig,
  type CreateLegacyInvitationConfig,
  type ReceiveOutOfBandImplicitInvitationConfig,
  AgentMessage,
  JsonTransformer,
  OutOfBandInvitation,
  Agent,
  RecordNotFoundError,
} from '@credo-ts/core'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import {
  type OutOfBandInvitationProps,
  type OutOfBandRecordWithInvitationProps,
  type RecordId,
  ConnectionRecordExample,
  outOfBandInvitationExample,
  outOfBandRecordExample,
} from '../../examples.js'
import type {
  AgentMessageType,
  ReceiveInvitationProps,
  ReceiveInvitationByUrlProps,
  AcceptInvitationConfig,
} from '../../types.js'
import { HttpResponse, NotFound } from '../../../error.js'

@Tags('Out Of Band')
@Route('/v1/oob')
@injectable()
export class OutOfBandController extends Controller {
  private agent: Agent

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
  public async getAllOutOfBandRecords(@Query('invitationId') invitationId?: RecordId) {
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
  @Response<NotFound['message']>(404)
  public async getOutOfBandRecordById(@Path('outOfBandId') outOfBandId: RecordId) {
    const outOfBandRecord = await this.agent.oob.findById(outOfBandId)

    if (!outOfBandRecord) throw new NotFound(`Out of band record with id "${outOfBandId}" not found.`)

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
    @Body() config?: Omit<CreateOutOfBandInvitationConfig, 'routing' | 'appendedAttachments' | 'messages'> // props removed because of issues with serialization
  ) {
    const outOfBandRecord = await this.agent.oob.createInvitation(config)
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
    @Body() config?: Omit<CreateLegacyInvitationConfig, 'routing'> // routing prop removed because of issues with public key serialization
  ) {
    const { outOfBandRecord, invitation } = await this.agent.oob.createLegacyInvitation(config)

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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async createLegacyConnectionlessInvitation(
    @Body()
    config: {
      recordId: string
      message: AgentMessageType
      domain: string
    }
  ) {
    try {
      const agentMessage = JsonTransformer.fromJSON(config.message, AgentMessage)

      return await this.agent.oob.createLegacyConnectionlessInvitation({
        ...config,
        message: agentMessage,
      })
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection id "${config.recordId}" not found.`)
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
  public async receiveInvitation(@Body() invitationRequest: ReceiveInvitationProps) {
    const { invitation, ...config } = invitationRequest

    const invite = new OutOfBandInvitation({ ...invitation, handshakeProtocols: invitation.handshake_protocols })
    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveInvitation(invite, config)

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
  public async receiveImplicitInvitation(@Body() config: ReceiveOutOfBandImplicitInvitationConfig) {
    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveImplicitInvitation(config)
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
  public async receiveInvitationFromUrl(@Body() invitationRequest: ReceiveInvitationByUrlProps) {
    const { invitationUrl, ...config } = invitationRequest

    const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl, config)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptInvitation(
    @Path('outOfBandId') outOfBandId: RecordId,
    @Body() acceptInvitationConfig: AcceptInvitationConfig
  ) {
    try {
      const { outOfBandRecord, connectionRecord } = await this.agent.oob.acceptInvitation(
        outOfBandId,
        acceptInvitationConfig
      )

      return {
        outOfBandRecord: outOfBandRecord.toJSON(),
        connectionRecord: connectionRecord?.toJSON(),
      }
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`mediator with mediatorId ${acceptInvitationConfig?.mediatorId} not found`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteOutOfBandRecord(@Path('outOfBandId') outOfBandId: RecordId) {
    try {
      this.setStatus(204)
      await this.agent.oob.deleteById(outOfBandId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`Out of band record with id "${outOfBandId}" not found.`)
      }
      throw error
    }
  }
}
