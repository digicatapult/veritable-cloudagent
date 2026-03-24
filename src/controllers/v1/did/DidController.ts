import { Agent, CredoError } from '@credo-ts/core'
import { Body, Controller, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, InternalError, NotFoundError } from '../../../error.js'
import { DidRecordExample, DidStateExample } from '../../examples.js'
import type {
  DID,
  DidCreateOptions,
  DidCreateResult,
  DidResolutionResult,
  ImportDidOptions,
} from '../../types/index.js'

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
   * @returns DidResolutionResult[]
   */
  @Example<DidResolutionResult[]>([DidRecordExample])
  @Get('/')
  @Response<BadRequest>(400)
  @Response<HttpResponse>(500)
  public async listDids(
    @Request() req: express.Request,
    @Query('createdLocally') createdLocally: boolean,
    @Query('method') method?: string
  ): Promise<DidResolutionResult[]> {
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
      throw new InternalError('one or more DID resolutions failed', {
        rejectedCount: rejected.length,
        firstError: rejected[0] instanceof Error ? rejected[0].message : String(rejected[0]),
      })
    }
    return fulfilled
  }

  /**
   * Resolves DID and returns DID resolution result
   * @param did Decentralized Identifier
   * @returns DidResolutionResult
   */
  @Example<DidResolutionResult>(DidRecordExample)
  @Get('/:did')
  public async getDidRecordByDid(@Request() req: express.Request, @Path('did') did: DID) {
    req.log.debug('resolving %s', did)
    const resolveResult = await this.agent.dids.resolve(did)

    req.log.info('retrieving DID document for %s', did)
    if (!resolveResult.didDocument) {
      throw new NotFoundError('DID document not found', {
        did,
      })
    }

    req.log.debug('returning DID document %j', resolveResult.didDocument.toJSON())
    return { ...resolveResult, didDocument: resolveResult.didDocument.toJSON() }
  }

  /**
   * Import a DID to the Agent and return the DID resolution result
   *
   * @param options
   * @returns DidResolutionResult
   */
  @Example<DidResolutionResult>(DidRecordExample)
  @Post('/import')
  @Response<BadRequest>(400)
  @Response<HttpResponse>(500)
  public async importDid(@Request() req: express.Request, @Body() options: ImportDidOptions) {
    try {
      req.log.info('importing DIDs %j', options)
      await this.agent.dids.import(options)
      req.log.debug('%s successfully imported', options.did)
      return this.getDidRecordByDid(req, options.did)
    } catch (error) {
      if (error instanceof CredoError) {
        throw new BadRequest('error importing DID', {
          did: options.did,
          cause: error.message,
        })
      }
      throw error
    }
  }

  /**
   * Create a DID and return the DID resolution result
   *
   * @param options
   * @returns DidResolutionResult
   */
  @Example<DidCreateResult>(DidStateExample)
  @Post('/create')
  @Response<BadRequest>(400)
  public async createDid(@Request() req: express.Request, @Body() options: DidCreateOptions) {
    const { didState } = await this.agent.dids.create(options)

    if (didState.state === 'failed') {
      throw new BadRequest('error creating DID', {
        reason: didState.reason,
      })
    }
    req.log.debug('DID created %j', didState)

    return didState
  }
}
