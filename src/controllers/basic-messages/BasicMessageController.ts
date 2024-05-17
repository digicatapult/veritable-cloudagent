import {
  type BasicMessageRecord,
  type BasicMessageStorageProps,
  Agent,
  RecordNotFoundError,
  ProofEventTypes,
  ProofStateChangedEvent,
} from '@credo-ts/core'
import { Body, Controller, Example, Get, Path, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { type RecordId, BasicMessageRecordExample } from '../examples.js'
import { BadRequest, HttpResponse, NotFound } from '../../error.js'
import { CreateProofRequestOptions } from '../types.js'

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
  public async sendMessage(
    @Path('connectionId') connectionId: RecordId,
    @Body() request: { content: string; requestProof?: CreateProofRequestOptions; timeoutMs?: number }
  ) {
    try {
      if (request.requestProof) {
        const { id } = await this.agent.proofs.requestProof({
          connectionId,
          ...request.requestProof,
        })

        await this.waitForProof(connectionId, id, request.timeoutMs ?? 1000)
      }
      await this.agent.basicMessages.sendMessage(connectionId, request.content)
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new NotFound(`connection with connection id "${connectionId}" not found.`)
      }
      throw error
    }
  }

  async waitForProof(connectionId: string, proofId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new HttpResponse({ message: `Proof request to connection '${connectionId}' timed out` }))
      }, timeoutMs)

      const onProofStateChanged = async ({ payload: { proofRecord } }: ProofStateChangedEvent) => {
        if (proofRecord.id === proofId && proofRecord.state === 'done') {
          clearTimeout(timeout)
          this.agent.events.off(ProofEventTypes.ProofStateChanged, onProofStateChanged)

          proofRecord.isVerified
            ? resolve()
            : reject(new BadRequest(`Agent connected with connection id "${connectionId}" is not verified.`))
        }
      }

      this.agent.events.on(ProofEventTypes.ProofStateChanged, onProofStateChanged)
    })
  }
}
