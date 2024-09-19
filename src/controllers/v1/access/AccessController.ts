import express from 'express'
import { Body, Controller, Get, Path, Post, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { NotFound } from '../../../error.js'
import PolicyAgent from '../../../policyAgent/index.js'

@Tags('Access')
@Route('/v1/access')
@injectable()
export class AccessController extends Controller {
  constructor(private policyAgent: PolicyAgent) {
    super()
  }

  /**
   * Retrieve all access policies
   */
  @Get('/policies')
  public async getPolicies() {
    return this.policyAgent.getPolicies()
  }

  /**
   * Retrieve a policy by policy id
   * @param policyId policy identifier
   */
  @Get('policies/:policyId')
  @Response<NotFound['message']>(404)
  public async getPolicyById(@Request() req: express.Request, @Path('policyId') policyId: string) {
    req.log.info('retrieving policy %s', policyId)
    return this.policyAgent.getPolicy(policyId)
  }

  /**
   * Evaluate against a package from a policy
   * @param packageId package identifier
   */
  @Post('data/:packageId/eval')
  @Response<NotFound['message']>(404)
  public async evaluate(
    @Request() req: express.Request,
    @Path('packageId') packageId: string,
    @Body() requestBody: Record<string, unknown>
  ) {
    req.log.info('evaluating package %j', { body: requestBody, packageId })
    return this.policyAgent.evaluate(packageId, requestBody)
  }
}
