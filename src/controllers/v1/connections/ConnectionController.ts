import {
  type ConnectionRecordProps,
  Agent,
  ConnectionRepository,
  CredoError,
  DidExchangeState,
  HandshakeProtocol,
  RecordNotFoundError,
} from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Delete, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFoundError } from '../../../error.js'
import { ConnectionRecordExample } from '../../examples.js'
import type { DID, UUID } from '../../types.js'

@Tags('Connections')
@Route('/v1/connections')
@injectable()
export class ConnectionController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Send a trust ping to an established connection
   * @param connectionId the id of the connection for which to accept the response
   * @param responseRequested do we want a response to our ping
   * @param withReturnRouting do we want a response at the time of posting
   * @returns TrustPingMessage
   */
  @Post('/:connectionId/send-ping')
  public async sendPing(
    @Request() req: express.Request,
    @Path('connectionId') connectionId: UUID,
    @Query('responseRequested') responseRequested: boolean = true,
    @Query('withReturnRouting') withReturnRouting?: boolean
  ) {
    req.log.debug('sending ping %j', { connectionId, responseRequested, withReturnRouting })
    return this.agent.connections.sendPing(connectionId, { responseRequested, withReturnRouting })
  }

  /**
   * Retrieve all connections records
   * @param alias Alias
   * @param state Connection state
   * @param myDid My DID
   * @param theirDid Their DID
   * @param theirLabel Their label
   * @param outOfBandId Out of band invitation ID
   * @returns ConnectionRecord[]
   */
  @Example<ConnectionRecordProps[]>([ConnectionRecordExample])
  @Get('/')
  public async getAllConnections(
    @Request() req: express.Request,
    @Query('outOfBandId') outOfBandId?: UUID,
    @Query('alias') alias?: string,
    @Query('state') state?: DidExchangeState,
    @Query('myDid') myDid?: DID,
    @Query('theirDid') theirDid?: DID,
    @Query('theirLabel') theirLabel?: string
  ) {
    let connections

    if (outOfBandId) {
      req.log.info('retrieving OOB connections', connections)
      connections = await this.agent.connections.findAllByOutOfBandId(outOfBandId)
    } else {
      const connectionRepository = this.agent.dependencyManager.resolve(ConnectionRepository)
      req.log.info('retrieving by query connections %j', { alias, myDid, theirDid, theirLabel, state })
      connections = await connectionRepository.findByQuery(this.agent.context, {
        alias,
        myDid,
        theirDid,
        theirLabel,
        state,
      })

      return connections.map((c) => c.toJSON())
    }

    // if (alias) connections = connections.filter((c) => c.alias === alias)
    // if (state) connections = connections.filter((c) => c.state === state)
    // if (myDid) connections = connections.filter((c) => c.did === myDid)
    // if (theirDid) connections = connections.filter((c) => c.theirDid === theirDid)
    // if (theirLabel) connections = connections.filter((c) => c.theirLabel === theirLabel)

    return connections.map((c) => c.toJSON())
  }

  /**
   * Retrieve connection record by connection id
   * @param connectionId Connection identifier
   * @returns ConnectionRecord
   */
  @Example<ConnectionRecordProps>(ConnectionRecordExample)
  @Get('/:connectionId')
  @Response<NotFoundError['message']>(404)
  public async getConnectionById(@Request() req: express.Request, @Path('connectionId') connectionId: UUID) {
    const connection = await this.agent.connections.findById(connectionId)

    if (!connection) {
      throw new NotFoundError('connection not found')
    }

    req.log.debug('returning connection %j', connection.toJSON())
    return connection.toJSON()
  }

  /**
   * Hangs up an active connection
   * Optional boolean value to also delete the connection record (default = false)
   * i.e. /connectionId?delete=true
   *
   * @param connectionId Connection identifier
   */
  @Delete('/:connectionId')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async closeConnection(@Request() req: express.Request, @Path('connectionId') connectionId: string) {
    const deleteConnectionRecord: boolean = req.query.delete === 'true'
    try {
      this.setStatus(204)
      await this.agent.connections.hangup({ connectionId: connectionId, deleteAfterHangup: deleteConnectionRecord })
      req.log.info('%s disconnected', connectionId)
      if (deleteConnectionRecord === true) {
        req.log.info('%s record deleted', connectionId)
      }
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('connection record not found')
      }
      throw error
    }
  }

  /**
   * Accept a connection request as inviter by sending a connection response message
   * for the connection with the specified connection id.
   *
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId Connection identifier
   * @returns ConnectionRecord
   */
  @Example<ConnectionRecordProps>(ConnectionRecordExample)
  @Post('/:connectionId/accept-request')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(@Request() req: express.Request, @Path('connectionId') connectionId: UUID) {
    try {
      const connection = await this.agent.connections.acceptRequest(connectionId)
      req.log.info('accept %s connection request %j', connectionId, connection.toJSON())

      return connection.toJSON()
    } catch (error) {
      if (error instanceof CredoError) {
        throw new NotFoundError('connection request not found')
      }
      throw error
    }
  }

  /**
   * Accept a connection response as invitee by sending a trust ping message
   * for the connection with the specified connection id.
   *
   * This is not needed when auto accepting of connection is enabled.
   *
   * @param connectionId Connection identifier
   * @returns ConnectionRecord
   */
  @Example<ConnectionRecordProps>(ConnectionRecordExample)
  @Post('/:connectionId/accept-response')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptResponse(@Request() req: express.Request, @Path('connectionId') connectionId: UUID) {
    try {
      const connection = await this.agent.connections.acceptResponse(connectionId)
      req.log.info('accept %s connection response %j', connectionId, connection.toJSON())

      return connection.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFoundError('connection response not found')
      }
      throw error
    }
  }

  /**
   * @description Creates inbound out-of-band record from an implicit invitation, given as public DID the agent should be able to resolve.
   * If any existing connections for the DID exists, delete and replace them with a single new one.
   * @returns out-of-band record and connection record if one has been created.
   */
  @Post('/')
  public async post(@Request() req: express.Request, @Body() body: { did: DID }) {
    const { did } = body

    try {
      req.log.info('retrieving connection by %s DID', did)
      const connections = await this.agent.connections.findByInvitationDid(did)

      for (const { id, invitationDid } of connections) {
        if (invitationDid === did) {
          req.log.debug(`connection on DID ${did} already exists. deleting connection ${id}`)
          await this.agent.connections.deleteById(id)
        }
      }
      const { outOfBandRecord, connectionRecord } = await this.agent.oob.receiveImplicitInvitation({
        did,
        handshakeProtocols: [HandshakeProtocol.Connections],
      })

      req.log.info('returning OOB record %j', {
        OOB: outOfBandRecord.toJSON(),
        connection: connectionRecord?.toJSON(),
      })
      return {
        outOfBandRecord: outOfBandRecord.toJSON(),
        connectionRecord: connectionRecord?.toJSON(),
      }
    } catch (error) {
      if (error instanceof CredoError) {
        throw new BadRequest('invalid DID')
      }
      throw error
    }
  }
}
