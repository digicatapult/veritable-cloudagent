import { Agent, CredoError, TypedArrayEncoder } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFoundError } from '../../../error.js'
import { type Did, DidRecordExample, DidStateExample } from '../../examples.js'
import type { DidCreateOptions, DidCreateResult, DidResolutionResultProps, ImportDidOptions } from '../../types.js'

@Tags('Dids')
@Route('/v1/dids')
@injectable()
export class DidController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve schema
   *
   * @returns DidResolutionResultProps[]
   */
  @Example<DidResolutionResultProps[]>([DidRecordExample])
  @Get('/')
  @Response<BadRequest['message']>(400)
  @Response<HttpResponse>(500)
  public async listDids(
    @Request() req: express.Request,
    @Query('createdLocally') createdLocally: boolean,
    @Query('method') method?: string
  ): Promise<DidResolutionResultProps[]> {
    if (!createdLocally) {
      throw new BadRequest('can only list DIDs created locally')
    }

    const didResult = await this.agent.dids.getCreatedDids({
      method,
    })

    req.log.info('attempting to resolve DIDs found %j', didResult)

    const results = await Promise.allSettled(
      didResult.map(({ did }) => {
        req.log.debug('resolving %s', did)
        return this.agent.dids.resolve(did)
      })
    )
    const fulfilled = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    const rejected = results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason)

    if (rejected.length > 0) {
      throw new Error(`${rejected.length} DIDs were rejected with Error: ${rejected[0]}`)
    }
    return fulfilled
  }

  /**
   * Resolves did and returns did resolution result
   * @param did Decentralized Identifier
   * @returns DidResolutionResult
   */
  @Example<DidResolutionResultProps>(DidRecordExample)
  @Get('/:did')
  public async getDidRecordByDid(@Request() req: express.Request, @Path('did') did: Did) {
    req.log.debug('resolving %s', did)
    const resolveResult = await this.agent.dids.resolve(did)

    req.log.info('retrieving DID document for %s', did)
    if (!resolveResult.didDocument) {
      throw new NotFoundError('DID document not found')
    }

    req.log.debug('returning DID document %j', resolveResult.didDocument.toJSON())
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
  public async importDid(@Request() req: express.Request, @Body() options: ImportDidOptions) {
    try {
      const { privateKeys, ...rest } = options
      req.log.info('importing DIDs %j', rest)
      await this.agent.dids.import({
        ...rest,
        privateKeys: privateKeys?.map(({ keyType, privateKey }) => ({
          keyType,
          privateKey: TypedArrayEncoder.fromBase64(privateKey),
        })),
      })
      req.log.debug('%s successfully imported', options.did)
      return this.getDidRecordByDid(req, options.did)
    } catch (error) {
      if (error instanceof CredoError) {
        throw new BadRequest(`error importing DID ${error.message}`)
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
  @Response<BadRequest['message']>(400)
  public async createDid(@Request() req: express.Request, @Body() options: DidCreateOptions) {
    const { didState } = await this.agent.dids.create(options)

    if (didState.state === 'failed') {
      throw new BadRequest(`error creating DID - ${didState.reason}`)
    }
    req.log.debug('DID created %j', didState)

    return didState
  }
}
