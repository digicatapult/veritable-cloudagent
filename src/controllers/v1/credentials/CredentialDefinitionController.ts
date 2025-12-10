import { Agent } from '@credo-ts/core'
import { Body, Controller, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFoundError } from '../../../error.js'
import { CredentialDefinitionExample } from '../../examples.js'
import type { AnonCredsCredentialDefinitionResponse, CredentialDefinitionId, DID, SchemaId } from '../../types.js'

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
    @Query('issuerId') issuerId?: DID,
    @Query('schemaId') schemaId?: SchemaId
  ): Promise<AnonCredsCredentialDefinitionResponse[]> {
    if (!createdLocally) {
      throw new BadRequest(
        `can only list credential definitions created locally. issuer ${issuerId}, schema ${schemaId}`
      )
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
  @Response<NotFoundError['message']>(404)
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
      throw new NotFoundError('credential definition not found')
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new BadRequest(`credentialDefinitionId "${credentialDefinitionId}" has invalid structure.`)
    }

    if (error !== undefined || credentialDefinition === undefined) {
      throw new Error(`${error}`)
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
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async createCredentialDefinition(
    @Request() req: express.Request,
    @Body()
    credentialDefinitionRequest: {
      issuerId: DID
      schemaId: SchemaId
      tag: string
    }
  ): Promise<AnonCredsCredentialDefinitionResponse> {
    req.log.debug('retrieving schema %s', credentialDefinitionRequest.schemaId)
    const {
      resolutionMetadata: { error },
    } = await this.agent.modules.anoncreds.getSchema(credentialDefinitionRequest.schemaId)

    if (error === 'notFound' || error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new NotFoundError('credential definition not found, invalid or unsupported')
    }
    if (error) {
      throw new Error(`${error}`)
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
      throw new HttpResponse({
        message: `Something went wrong creating credential definition ${credentialDefinition}. state: ${state}`,
      })
    }

    req.log.debug('success registering new credential definition %j', credentialDefinition)

    return {
      id: credentialDefinitionId,
      ...credentialDefinition,
    }
  }
}
