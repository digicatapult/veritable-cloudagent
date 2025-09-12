import { Agent } from '@credo-ts/core'
import express from 'express'
import { Controller, Get, Request, Route, SuccessResponse, Response } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../agent.js'
import { BadRequest, HttpResponse, NotFoundError } from '../error.js'
import { DidWebService } from './service.js'
import PinoLogger from '../utils/logger.js'

type HealthResponse = {
  status: 'ok'
  service: string
}

@Route('')
@injectable()
export class DidWebController extends Controller {
  private agent: RestAgent
  private didWebService: DidWebService
  private logger: PinoLogger

  public constructor(agent: Agent) {
    super()
    this.agent = agent as RestAgent
    this.logger = this.agent.config.logger
    this.didWebService = new DidWebService(this.agent, this.logger)
  }

  /**
   * Get DID document from .well-known path
   * @summary Retrieve DID document for root did:web identifier
   */
  @SuccessResponse(200, 'DID document retrieved successfully')
  @Response<BadRequest['message']>(400, 'Bad request')
  @Response<NotFoundError['message']>(404, 'DID document not found')
  @Response<HttpResponse>(500, 'Internal server error')
  @Get('/.well-known/did.json')
  public async getWellKnownDid(@Request() req: express.Request): Promise<Record<string, unknown>> {
    try {
      const didId = this.constructDidFromPath(req)
      // Use the controller's logger if req.log is not available
      const logger = req.log || this.logger
      logger.info(`DID document requested for path: ${req.path}`)
      logger.debug(`Constructed DID: ${didId}`)

      // Ensure the DID exists before trying to get it
      await this.didWebService.ensureDidExists(didId)

      const didDocument = await this.didWebService.getDidDocument(didId)
      if (!didDocument) {
        logger.warn(`DID document not found for: ${didId}`)
        throw new NotFoundError('DID document not found')
      }

      logger.info(`Serving DID document for: ${didId}`)
      return didDocument
    } catch (error) {
      const logger = req.log || this.logger
      logger.error(`Error serving DID document: ${error}`)
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new HttpResponse(500, 'Internal server error')
    }
  }

  /**
   * Health check endpoint for did:web server
   * @summary Check health of did:web server
   */
  @SuccessResponse(200, 'Service is healthy')
  @Get('/health')
  public async getHealth(@Request() req: express.Request): Promise<HealthResponse> {
    const logger = req.log || this.logger
    logger.trace('did:web health controller called')
    return {
      status: 'ok',
      service: 'did:web-server',
    }
  }

  private constructDidFromPath(req: express.Request): string {
    const host = req.get('host')
    if (!host) {
      throw new BadRequest('Host header is required')
    }

    const pathname = req.path

    // Handle .well-known/did.json case (root DID)
    if (pathname === '/.well-known/did.json') {
      return `did:web:${host.replace(/:/g, '%3A')}`
    }

    // Handle path-based DID (remove /did.json suffix and convert slashes to colons)
    const pathWithoutDidJson = pathname.replace(/\/did\.json$/, '')
    const pathParts = pathWithoutDidJson.split('/').filter(part => part.length > 0)
    const didPath = pathParts.join(':')

    return `did:web:${host.replace(/:/g, '%3A')}:${didPath}`
  }
}