import { singleton } from 'tsyringe'
import { LogLevel } from '@aries-framework/core'

import { TsLogger } from '../utils/logger'

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
      throw new Error(`Error calling Policy Agent`)
    }

    return response.json()
  }
}
