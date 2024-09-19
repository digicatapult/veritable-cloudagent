import { Agent } from '@credo-ts/core'
import express from 'express'
import { Body, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, NotFound } from '../../../error.js'
import { type Did, type SchemaId, type Version, SchemaExample } from '../../examples.js'
import type { AnonCredsSchemaResponse } from '../../types.js'

@Tags('Schemas')
@Route('/v1/schemas')
@injectable()
export class SchemaController {
  private agent: RestAgent

  public constructor(agent: Agent) {
    this.agent = agent
  }

  /**
   * Retrieve schema
   *
   * @returns AnonCredsSchemaResponse[]
   */
  @Example<AnonCredsSchemaResponse[]>([SchemaExample])
  @Get('/')
  @Response<BadRequest['message']>(400)
  @Response<HttpResponse>(500)
  public async getCredentials(
    @Request() req: express.Request,
    @Query('createdLocally') createdLocally: boolean,
    @Query('issuerId') issuerId?: string,
    @Query('schemaName') schemaName?: string,
    @Query('schemaVersion') schemaVersion?: string
  ): Promise<AnonCredsSchemaResponse[]> {
    if (!createdLocally) {
      req.log.warn('can list only local schemas %j', { issuerId, schemaName, createdLocally, schemaVersion })
      throw new BadRequest('Can only list schema created locally')
    }

    const schemaResult = await this.agent.modules.anoncreds.getCreatedSchemas({
      issuerId,
      schemaName,
      schemaVersion,
    })

    req.log.debug('returning schemas found %j', schemaResult)

    return schemaResult.map((schema) => {
      return {
        id: schema.schemaId,
        ...schema.schema,
      }
    })
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
  public async getSchemaById(@Request() req: express.Request, @Path('schemaId') schemaId: SchemaId) {
    const { schema, resolutionMetadata } = await this.agent.modules.anoncreds.getSchema(schemaId)

    const error = resolutionMetadata?.error

    if (error === 'notFound') {
      req.log.warn('%s schema not found', schemaId)
      throw new NotFound(`schema definition with schemaId "${schemaId}" not found.`)
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      req.log.warn('invalid schema structure %s', error)
      throw new BadRequest(`schemaId "${schemaId}" has invalid structure.`)
    }

    if (error !== undefined || schema === undefined) {
      req.log.warn('error occured %s', error)
      throw new HttpResponse({ message: `something went wrong: schema is undefined or ${error}` })
    }

    req.log.debug('schema %s has been found %j', schemaId, schema)

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
    @Request() req: express.Request,
    @Body()
    schema: {
      issuerId: Did
      name: string
      version: Version
      attrNames: string[]
    }
  ) {
    req.log.info('registering a new schema %j', schema)
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
      req.log.warn('schema registration failed %j', schemaState)
      throw new HttpResponse({ message: `something went wrong: ${schemaState.reason}` })
    }

    if (schemaState.state !== 'finished' || schemaState.schemaId === undefined || schemaState.schema === undefined) {
      req.log.warn('error occured while creating schema %j', schemaState)
      throw new HttpResponse({ message: `something went wrong creating schema: unknown` })
    }

    req.log.info('%s schema has been created %j', schemaState.schemaId, schemaState)

    return {
      id: schemaState.schemaId,
      ...schemaState.schema,
    }
  }
}
