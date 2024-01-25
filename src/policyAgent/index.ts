import { singleton } from 'tsyringe'
import { LogLevel } from '@aries-framework/core'

import { TsLogger } from '../utils/logger'
import { HttpResponse, NotFound } from '../error'

@singleton()
export default class PolicyAgent {
  private logger: TsLogger

  constructor(private origin: string) {
    this.logger = new TsLogger(LogLevel.debug)
    try {
      new URL(origin)
    } catch (err) {
      throw new Error(`Invalid PolicyAgent origin ${origin}`)
    }
  }

  public async getPolicies() {
    const response = await fetch(`${this.origin}/v1/policies`)

    if (!response.ok) {
      throw new HttpResponse({ message: `Error calling Policy Agent` })
    }

    return response.json()
  }

  public async getPolicy(id: string) {
    const response = await fetch(`${this.origin}/v1/policies/${id}`)

    if (response.ok) {
      return response.json()
    }
    if (response.status === 404) {
      throw new NotFound(`policy with id '${id}' not found`)
    }

    throw new HttpResponse({ message: `Error calling Policy Agent` })
  }
}
