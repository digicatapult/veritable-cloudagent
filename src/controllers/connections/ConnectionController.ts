import {
  type ConnectionRecordProps,
  ConnectionRepository,
  DidExchangeState,
  Agent,
  AriesFrameworkError,
  RecordNotFoundError,
} from '@aries-framework/core'
import { Controller, Delete, Example, Get, Path, Post, Query, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { type RecordId, ConnectionRecordExample } from '../examples.js'
import { HttpResponse, NotFound } from '../../error.js'

@Tags('Connections')
@Route('/connections')
@injectable()
export class ConnectionController extends Controller {
  private agent: Agent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve all connections records
   * @param alias Alias
   * @param state Connection state
   * @param myDid My DID
   * @param theirDid Their DID
   * @param theirLabel Their label
   * @returns ConnectionRecord[]
   */
  @Example<ConnectionRecordProps[]>([ConnectionRecordExample])
  @Get('/')
  public async getAllConnections(
    @Query('outOfBandId') outOfBandId?: string,
    @Query('alias') alias?: string,
    @Query('state') state?: DidExchangeState,
    @Query('myDid') myDid?: string,
    @Query('theirDid') theirDid?: string,
    @Query('theirLabel') theirLabel?: string
  ) {
    let connections

    if (outOfBandId) {
      connections = await this.agent.connections.findAllByOutOfBandId(outOfBandId)
    } else {
      const connectionRepository = this.agent.dependencyManager.resolve(ConnectionRepository)

      const connections = await connectionRepository.findByQuery(this.agent.context, {
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
  @Response<NotFound['message']>(404)
  public async getConnectionById(@Path('connectionId') connectionId: RecordId) {
    const connection = await this.agent.connections.findById(connectionId)

    if (!connection) throw new NotFound(`connection with connection id "${connectionId}" not found.`)

    return connection.toJSON()
  }

  /**
   * Deletes a connection record from the connection repository.
   *
   * @param connectionId Connection identifier
   */
  @Delete('/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async deleteConnection(@Path('connectionId') connectionId: RecordId) {
    try {
      this.setStatus(204)
      await this.agent.connections.deleteById(connectionId)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptRequest(@Path('connectionId') connectionId: RecordId) {
    try {
      const connection = await this.agent.connections.acceptRequest(connectionId)
      return connection.toJSON()
    } catch (error) {
      if (error instanceof AriesFrameworkError) {
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
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
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async acceptResponse(@Path('connectionId') connectionId: RecordId) {
    try {
      const connection = await this.agent.connections.acceptResponse(connectionId)
      return connection.toJSON()
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
      }
      throw error
    }
  }
}
