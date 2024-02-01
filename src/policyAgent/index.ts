import { singleton } from 'tsyringe'
import { LogLevel } from '@aries-framework/core'

import { TsLogger } from '../utils/logger'
import { HttpResponse, NotFound } from '../error'

type Policy = {
  id: string
  raw: string
  ast: {
    package: {
      path: { type: string; value: string }[]
    }
    rules: object[]
  }
}
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

  public async getPolicies(): Promise<Policy[]> {
    const response = await fetch(`${this.origin}/v1/policies`)

    if (!response.ok) {
      throw new HttpResponse({ message: `Error calling Policy Agent` })
    }

    const { result } = await response.json()
    return result
  }

  public async getPolicy(id: string): Promise<Policy> {
    const response = await fetch(`${this.origin}/v1/policies/${id}`)

    if (response.ok) {
      const { result } = await response.json()
      return result
    }

    if (response.status === 404) {
      throw new NotFound(`policy with id '${id}' not found`)
    }

    throw new HttpResponse({ message: `Error calling Policy Agent` })
  }

  public async evaluate(packageId: string, requestBody: object) {
    const opaEndpoint = `${this.origin}/v1/data/${packageId}`

    const response = await fetch(opaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (response.ok) {
      const { result } = await response.json()
      return result
    }

    throw new HttpResponse({ message: `Error calling Policy Agent` })
  }
}
