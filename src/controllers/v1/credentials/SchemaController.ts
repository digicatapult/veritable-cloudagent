import { Agent } from '@credo-ts/core'
import { Body, Example, Get, Path, Post, Route, Tags, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import type { RestAgent } from '../../../utils/agent.js'
import { type Did, type Version, type SchemaId, SchemaExample } from '../../examples.js'
import type { AnonCredsSchemaResponse } from '../../types.js'
import { HttpResponse, NotFound, BadRequest } from '../../../error.js'

@Tags('Schemas')
@Route('/v1/schemas')
@injectable()
export class SchemaController {
  private agent: RestAgent

  public constructor(agent: Agent) {
    this.agent = agent
  }

  /**
   * Retrieve schema by schema id
   *
   * @param schemaId
   * @returns AnonCredsSchemaResponse
   */
  @Example<AnonCredsSchemaResponse>(SchemaExample)
  @Get('/:schemaId')
  @Response<BadRequest['message']>(400)
  @Response<NotFound['message']>(404)
  @Response<HttpResponse>(500)
  public async getSchemaById(@Path('schemaId') schemaId: SchemaId) {
    const { schema, resolutionMetadata } = await this.agent.modules.anoncreds.getSchema(schemaId)

    const error = resolutionMetadata?.error

    if (error === 'notFound') {
      throw new NotFound(`schema definition with schemaId "${schemaId}" not found.`)
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new BadRequest(`schemaId "${schemaId}" has invalid structure.`)
    }

    if (error !== undefined || schema === undefined) {
      throw new HttpResponse({ message: `something went wrong: schema is undefined or ${error}` })
    }

    return {
      id: schemaId,
      ...schema,
    }
  }

  /**
   * Creates a new schema and registers schema on ledger
   *
   * @param schema
   * @returns AnonCredsSchemaResponse
   */
  @Example<AnonCredsSchemaResponse>(SchemaExample)
  @Post('/')
  @Response<HttpResponse>(500)
  public async createSchema(
    @Body()
    schema: {
      issuerId: Did
      name: string
      version: Version
      attrNames: string[]
    }
  ) {
    const { schemaState } = await this.agent.modules.anoncreds.registerSchema({
      schema: {
        issuerId: schema.issuerId,
        name: schema.name,
        version: schema.version,
        attrNames: schema.attrNames,
      },
      options: {},
    })

    if (schemaState.state === 'failed') {
      throw new HttpResponse({ message: `something went wrong: ${schemaState.reason}` })
    }

    if (schemaState.state !== 'finished' || schemaState.schemaId === undefined || schemaState.schema === undefined) {
      throw new HttpResponse({ message: `something went wrong creating schema: unknown` })
    }

    return {
      id: schemaState.schemaId,
      ...schemaState.schema,
    }
  }
}
