import { Agent } from '@credo-ts/core'
import { Body, Example, Get, Path, Post, Query, Request, Response, Route, Tags } from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse, InternalError, NotFoundError } from '../../../error.js'
import { SchemaExample } from '../../examples.js'
import type { AnonCredsSchemaResponse, DID, SchemaId, Version } from '../../types/index.js'

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
  @Response<BadRequest>(400)
  @Response<HttpResponse>(500)
  public async getCredentials(
    @Request() req: express.Request,
    @Query('createdLocally') createdLocally: boolean,
    @Query('issuerId') issuerId?: DID,
    @Query('schemaName') schemaName?: string,
    @Query('schemaVersion') schemaVersion?: Version
  ): Promise<AnonCredsSchemaResponse[]> {
    if (!createdLocally) {
      throw new BadRequest('Can only list schemas created locally')
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
  @Response<BadRequest>(400)
  @Response<NotFoundError>(404)
  @Response<HttpResponse>(500)
  public async getSchemaById(@Request() req: express.Request, @Path('schemaId') schemaId: SchemaId) {
    const { schema, resolutionMetadata } = await this.agent.modules.anoncreds.getSchema(schemaId)

    const error = resolutionMetadata?.error

    if (error === 'notFound') {
      throw new NotFoundError('schema not found')
    }

    if (error === 'invalid' || error === 'unsupportedAnonCredsMethod') {
      throw new BadRequest('schemaId has invalid structure.', {
        schemaId,
        resolutionError: error,
      })
    }

    if (error !== undefined || schema === undefined) {
      throw new InternalError('schema resolution failed', {
        schemaId,
        resolutionError: error ?? 'unknown',
      })
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
      issuerId: DID
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
      throw new InternalError('schema registration failed', {
        issuerId: schema.issuerId,
        schemaName: schema.name,
        schemaVersion: schema.version,
        reason: schemaState.reason,
      })
    }

    if (schemaState.state !== 'finished' || schemaState.schemaId === undefined || schemaState.schema === undefined) {
      throw new InternalError('schema registration returned invalid state', {
        state: schemaState.state,
        hasSchemaId: schemaState.schemaId !== undefined,
        hasSchema: schemaState.schema !== undefined,
      })
    }

    req.log.info('%s schema has been created %j', schemaState.schemaId, schemaState)

    return {
      id: schemaState.schemaId,
      ...schemaState.schema,
    }
  }
}
