import { Agent } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFound } from '../../../error.js'
import { type CredentialDefinitionId, type Did, type SchemaId, CredentialDefinitionExample } from '../../examples.js'
import type { AnonCredsCredentialDefinitionResponse } from '../../types.js'

@Tags('Credential Definitions')
@Route('/v1/credential-definitions')
@injectable()
export class CredentialDefinitionController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Retrieve credential definitions
   *
   * @returns AnonCredsCredentialDefinitionResponse[]
   */
  @Example<AnonCredsCredentialDefinitionResponse[]>([CredentialDefinitionExample])
  @Get('/')
  @Response<BadRequest['message']>(400)
  @Response<HttpResponse>(500)
  public async getCredentials(
    @Request() req: express.Request,
    @Query('createdLocally') createdLocally: boolean,
    @Query('issuerId') issuerId?: string,
    @Query('schemaId') schemaId?: string
  ): Promise<AnonCredsCredentialDefinitionResponse[]> {
    if (!createdLocally) {
      req.log.warn('can list only locally created credential definitions %j', { issuerId, schemaId, createdLocally })
      throw new BadRequest('Can only list credential definitions created locally')
    }

    const credentialDefinitionResult = await this.agent.modules.anoncreds.getCreatedCredentialDefinitions({
      issuerId,
      schemaId,
    })

    req.log.info('credential definitions found %j', credentialDefinitionResult)

    return credentialDefinitionResult.map((cd) => {
      return {
        id: cd.credentialDefinitionId,
        ...cd.credentialDefinition,
      }
    })
  }

  /**
   * Retrieve credential definition by credential definition id
   *
   * @param credentialDefinitionId
   * @returns AnonCredsCredentialDefinitionResponse
   */
  @Example<AnonCredsCredentialDefinitionResponse>(CredentialDefinitionExample)
  @Get('/:credentialDefinitionId')
  @Response<BadRequest['message']>(400)
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async getCredentialDefinitionById(
    @Request() req: express.Request,
    @Path('credentialDefinitionId') credentialDefinitionId: CredentialDefinitionId
  ): Promise<AnonCredsCredentialDefinitionResponse> {
    const {
      credentialDefinition,
      resolutionMetadata: { error },
    } = await this.agent.modules.anoncreds.getCredentialDefinition(credentialDefinitionId)

    if (error === 'notFound') {
      req.log.warn('%s credential definition not found', credentialDefinitionId)
      throw new NotFound(`credential definition with credentialDefinitionId "${credentialDefinitionId}" not found.`)
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      req.log.warn('credential definition has invalid structure %s', error)
      throw new BadRequest(`credentialDefinitionId "${credentialDefinitionId}" has invalid structure.`)
    }

    if (error !== undefined || credentialDefinition === undefined) {
      req.log.warn(`error occurred in GET /credential-definitions/:credentialDefinitionId ${error}`)
      throw error
    }

    req.log.debug('returning %s credential definition %j', credentialDefinitionId, credentialDefinition)

    return {
      id: credentialDefinitionId,
      ...credentialDefinition,
    }
  }

  /**
   * Creates a new credential definition.
   *
   * @param credentialDefinitionRequest
   * @returns AnonCredsCredentialDefinitionResponse
   */
  @Example<AnonCredsCredentialDefinitionResponse & { id: string }>(CredentialDefinitionExample)
  @Post('/')
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async createCredentialDefinition(
    @Request() req: express.Request,
    @Body()
    credentialDefinitionRequest: {
      issuerId: Did
      schemaId: SchemaId
      tag: string
    }
  ): Promise<AnonCredsCredentialDefinitionResponse> {
    req.log.debug('retrieving %s schema', credentialDefinitionRequest.schemaId)
    const {
      resolutionMetadata: { error },
    } = await this.agent.modules.anoncreds.getSchema(credentialDefinitionRequest.schemaId)

    if (error === 'notFound' || error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      req.log.warn('%s schema  not found', credentialDefinitionRequest.schemaId)
      throw new NotFound(`schema with schemaId "${credentialDefinitionRequest.schemaId}" not found.`)
    }
    if (error) {
      req.log.warn(`error occurred in POST /credential-definitions ${error}`)
      throw error
    }

    req.log.info('registering a credential definition %j', credentialDefinitionRequest)
    const {
      credentialDefinitionState: { state, credentialDefinitionId, credentialDefinition },
    } = await this.agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        issuerId: credentialDefinitionRequest.issuerId,
        schemaId: credentialDefinitionRequest.schemaId,
        tag: credentialDefinitionRequest.tag,
      },
      options: { supportRevocation: false },
    })

    if (state !== 'finished' || credentialDefinitionId === undefined || credentialDefinition === undefined) {
      req.log.warn('error occurred while creating a credential definition %j', { state, credentialDefinition })
      throw new HttpResponse({ message: `something went wrong creating credential definition` })
    }

    req.log.debug('success registering new credential definition %j', credentialDefinition)

    return {
      id: credentialDefinitionId,
      ...credentialDefinition,
    }
  }
}
