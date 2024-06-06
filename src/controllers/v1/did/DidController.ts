import { Agent, CredoError, TypedArrayEncoder } from '@credo-ts/core'
import { Body, Controller, Example, Get, Path, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import type { DidCreateOptions, DidCreateResult, DidResolutionResultProps, ImportDidOptions } from '../../types.js'
import { type Did, DidRecordExample, DidStateExample } from '../../examples.js'
import { HttpResponse, BadRequest } from '../../../error.js'

@Tags('Dids')
@Route('/v1/dids')
@injectable()
export class DidController extends Controller {
  private agent: Agent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Resolves did and returns did resolution result
   * @param did Decentralized Identifier
   * @returns DidResolutionResult
   */
  @Example<DidResolutionResultProps>(DidRecordExample)
  @Get('/:did')
  public async getDidRecordByDid(@Path('did') did: Did) {
    const resolveResult = await this.agent.dids.resolve(did)

    if (!resolveResult.didDocument) {
      this.setStatus(500)
      return { resolveResult }
    }

    return { ...resolveResult, didDocument: resolveResult.didDocument.toJSON() }
  }

  /**
   * Import a Did to the Agent and return the did resolution result
   *
   * @param options
   * @returns DidResolutionResultProps
   */
  @Example<DidResolutionResultProps>(DidRecordExample)
  @Post('/import')
  @Response<BadRequest['message']>(400)
  @Response<HttpResponse>(500)
  public async importDid(@Body() options: ImportDidOptions) {
    try {
      const { privateKeys, ...rest } = options
      await this.agent.dids.import({
        ...rest,
        privateKeys: privateKeys?.map(({ keyType, privateKey }) => ({
          keyType,
          privateKey: TypedArrayEncoder.fromBase64(privateKey),
        })),
      })
      return this.getDidRecordByDid(options.did)
    } catch (error) {
      if (error instanceof CredoError) {
        throw new BadRequest(`Error importing Did - ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Create a Did and return the did resolution result
   *
   * @param options
   * @returns DidResolutionResultProps
   */
  @Example<DidCreateResult>(DidStateExample)
  @Post('/create')
  @Response<HttpResponse>(500)
  public async createDid(@Body() options: DidCreateOptions) {
    const { didState } = await this.agent.dids.create(options)

    if (didState.state === 'failed') {
      throw new HttpResponse({
        message: `Error creating Did - ${didState.reason}`,
      })
    }

    return didState
  }
}
