import type { BasicMessageRecord, BasicMessageStorageProps } from '@aries-framework/core'

import { Agent, RecordNotFoundError } from '@aries-framework/core'
import { Body, Controller, Example, Get, Path, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { BasicMessageRecordExample, RecordId } from '../examples.js'
import { HttpResponse, NotFound } from '../../error.js'

@Tags('Basic Messages')
@Route('/basic-messages')
@injectable()
export class BasicMessageController extends Controller {
  private agent: Agent

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
  public async sendMessage(@Path('connectionId') connectionId: RecordId, @Body() request: Record<'content', string>) {
    try {
      this.setStatus(204)
      await this.agent.basicMessages.sendMessage(connectionId, request.content)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
      }
      throw error
    }
  }
}
