import { singleton } from 'tsyringe'

import { HttpResponse, NotFound } from '../error.js'
import { Env } from '../env.js'

type Policy = {
  id: string
  raw: string
  ast: {
    package: {
      path: { type: string; value: string }[]
    }
    rules: Record<string, unknown>[]
  }
}
@singleton()
export default class PolicyAgent {
  private origin: string

  constructor(private env: Env) {
    this.origin = env.get('OPA_ORIGIN')
    try {
      new URL(this.origin)
    } catch (err) {
      throw new Error(`Invalid PolicyAgent origin ${this.origin}`)
    }
  }

  public async getPolicies(): Promise<Policy[]> {
    const response = await fetch(`${this.origin}/v1/policies`)

    if (!response.ok) {
      throw new HttpResponse({ message: `Error calling Policy Agent` })
    }

    const { result } = (await response.json()) as { result: Policy[] }
    return result
  }

  public async getPolicy(id: string): Promise<Policy> {
    const response = await fetch(`${this.origin}/v1/policies/${id}`)

    if (response.ok) {
      const { result } = (await response.json()) as { result: Policy }
      return result
    }

    if (response.status === 404) {
      throw new NotFound(`policy with id '${id}' not found`)
    }

    throw new HttpResponse({ message: `Error calling Policy Agent` })
  }

  public async evaluate(packageId: string, requestBody: Record<string, unknown>) {
    const opaEndpoint = `${this.origin}/v1/data/${packageId}`

    const response = await fetch(opaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (response.ok) {
      const { result } = (await response.json()) as { result: Record<string, unknown> }
      return result
    }

    throw new HttpResponse({ message: `Error calling Policy Agent` })
  }
}
