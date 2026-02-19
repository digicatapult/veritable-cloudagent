import { addResponseParser } from './responseParser.js'

export interface MetadataFile {
  blob: Blob
  filename: string
}

export default class Ipfs {
  constructor(private origin: string) {
    try {
      new URL(origin)
    } catch (err) {
      throw new Error(`Invalid origin ${origin} ${err}`)
    }
  }

  public async getFile(cid: string): Promise<Buffer> {
    const response = await this.makeIpfsRequest('/api/v0/cat', {
      arg: cid,
    })
    return Buffer.from(await response.arrayBuffer())
  }
  //needs to pass on form data
  public async uploadFile(file: Buffer): Promise<string> {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(file)])
    form.append('file', blob, 'file')
    const response = await this.makeIpfsRequest('/api/v0/add', { 'cid-version': '1' }, form)
    const responseJson = await response.json()

    try {
      const parsedResponse = addResponseParser.parse(responseJson)
      return parsedResponse.Hash
    } catch (err) {
      throw new Error(`Error calling IPFS ${err}`)
    }
  }

  private async makeIpfsRequest(route: string, args: Record<string, string>, body?: FormData) {
    const url = new URL(route, this.origin)
    const search = new URLSearchParams(args)
    url.search = search.toString()

    const maxRetries = 5
    let delay = 1000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          body,
        })

        if (response.ok) {
          return response
        }

        // If this was the last attempt, parse the error and throw
        if (attempt === maxRetries) {
          const text = await response.text().catch(() => 'No response body')
          throw new Error(`Error calling IPFS: ${response.status} ${response.statusText} - ${text}`)
        }
      } catch (err) {
        // If this was a network error and it's the last attempt, rethrow
        if (attempt === maxRetries) {
          throw err
        }
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }

    throw new Error(`IPFS request failed after ${maxRetries} retries`)
  }
}
