import { Controller, Route, Tags, Get } from 'tsoa'
import { injectable } from 'tsyringe'

import PolicyAgent from '../../policyAgent'

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
}
