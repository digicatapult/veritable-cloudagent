import { Agent } from '@credo-ts/core'
import { Body, Controller, Example, Get, Path, Post, Route, Tags, Response, Query } from 'tsoa'
import { injectable } from 'tsyringe'

import { type Did, type SchemaId, type CredentialDefinitionId, CredentialDefinitionExample } from '../../examples.js'
import type { AnonCredsCredentialDefinitionResponse } from '../../types.js'
import { HttpResponse, NotFound, BadRequest } from '../../../error.js'
import { RestAgent } from '../../../agent.js'

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
    @Query('createdLocally') createdLocally: boolean,
    @Query('issuerId') issuerId?: string,
    @Query('schemaId') schemaId?: string
  ): Promise<AnonCredsCredentialDefinitionResponse[]> {
    if (!createdLocally) {
      throw new BadRequest('Can only list credential definitions created locally')
    }

    const credentialDefinitionResult = await this.agent.modules.anoncreds.getCreatedCredentialDefinitions({
      issuerId,
      schemaId,
    })

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
    @Path('credentialDefinitionId') credentialDefinitionId: CredentialDefinitionId
  ): Promise<AnonCredsCredentialDefinitionResponse> {
    const {
      credentialDefinition,
      resolutionMetadata: { error },
    } = await this.agent.modules.anoncreds.getCredentialDefinition(credentialDefinitionId)

    if (error === 'notFound') {
      throw new NotFound(`credential definition with credentialDefinitionId "${credentialDefinitionId}" not found.`)
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new BadRequest(`credentialDefinitionId "${credentialDefinitionId}" has invalid structure.`)
    }

    if (error !== undefined || credentialDefinition === undefined) {
      throw error
    }

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
    @Body()
    credentialDefinitionRequest: {
      issuerId: Did
      schemaId: SchemaId
      tag: string
    }
  ): Promise<AnonCredsCredentialDefinitionResponse> {
    const {
      resolutionMetadata: { error },
    } = await this.agent.modules.anoncreds.getSchema(credentialDefinitionRequest.schemaId)

    if (error === 'notFound' || error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new NotFound(`schema with schemaId "${credentialDefinitionRequest.schemaId}" not found.`)
    }
    if (error) {
      throw error
    }

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
      throw new HttpResponse({ message: `something went wrong creating credential definition` })
    }

    return {
      id: credentialDefinitionId,
      ...credentialDefinition,
    }
  }
}
