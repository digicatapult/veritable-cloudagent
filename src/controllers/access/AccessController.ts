import { Controller, Route, Tags, Get, Response, Path } from 'tsoa'
import { injectable } from 'tsyringe'

import PolicyAgent from '../../policyAgent'
import { NotFound } from '../../error'

@Tags('Access')
@Route('/access')
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
  public async getConnectionById(@Path('policyId') policyId: string) {
    return this.policyAgent.getPolicy(policyId)
  }
}
