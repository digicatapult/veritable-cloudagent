import { Controller, Route, Tags, Get, Response, Path, Post, Body } from 'tsoa'
import { injectable } from 'tsyringe'

import PolicyAgent from '../../../policyAgent/index.js'
import { NotFound } from '../../../error.js'

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
  public async getPolicyById(@Path('policyId') policyId: string) {
    return this.policyAgent.getPolicy(policyId)
  }

  /**
   * Evaluate against a package from a policy
   * @param packageId package identifier
   */
  @Post('data/:packageId/eval')
  @Response<NotFound['message']>(404)
  public async evaluate(@Path('packageId') packageId: string, @Body() requestBody: Record<string, unknown>) {
    return this.policyAgent.evaluate(packageId, requestBody)
  }
}
