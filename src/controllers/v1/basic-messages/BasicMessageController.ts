import { type BasicMessageRecord, type BasicMessageStorageProps, Agent, RecordNotFoundError } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Example, Get, Path, Post, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { HttpResponse, NotFound } from '../../../error.js'
import { type RecordId, BasicMessageRecordExample } from '../../examples.js'

@Tags('Basic Messages')
@Route('/v1/basic-messages')
@injectable()
export class BasicMessageController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve basic messages by connection id
   *
   * @param connectionId Connection identifier
   * @returns BasicMessageRecord[]
   */
  @Example<BasicMessageStorageProps[]>([BasicMessageRecordExample])
  @Get('/:connectionId')
  public async getBasicMessages(@Path('connectionId') connectionId: RecordId): Promise<BasicMessageRecord[]> {
    return await this.agent.basicMessages.findAllByQuery({ connectionId })
  }

  /**
   * Send a basic message to a connection
   *
   * @param connectionId Connection identifier
   * @param content The content of the message
   */
  @Post('/:connectionId')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async sendMessage(
    @Request() req: express.Request,
    @Path('connectionId') connectionId: RecordId,
    @Body() body: Record<'content', string>
  ) {
    try {
      this.setStatus(204)
      req.log.info('sending basic message %j to %s connection', body, connectionId)
      await this.agent.basicMessages.sendMessage(connectionId, body.content)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        req.log.warn('%s connection not found', connectionId)
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
      }
      req.log.warn('error occured %j', error)
      throw error
    }
  }
}
