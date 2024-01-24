import type { RestAgent } from '../../utils/agent'
import type { Did, SchemaId } from '../examples'
import type { AnonCredsCredentialDefinitionResponse } from '../types'

import { Agent } from '@aries-framework/core'
import { Body, Controller, Example, Get, Path, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { CredentialDefinitionExample, CredentialDefinitionId } from '../examples'
import { HttpResponse, NotFound, BadRequest } from '../../error'

@Tags('Credential Definitions')
@Route('/credential-definitions')
@injectable()
export class CredentialDefinitionController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
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
      supportRevocation: boolean
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
      options: { supportRevocation: credentialDefinitionRequest.supportRevocation },
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
