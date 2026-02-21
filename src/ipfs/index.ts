import { addResponseParser } from './responseParser.js'

export interface MetadataFile {
  blob: Blob
  filename: string
}

export default class Ipfs {
  constructor(
    private origin: string,
    private timeoutMs: number
  ) {
    try {
      new URL(origin)
    } catch (err) {
      throw new Error(`Invalid origin ${origin} ${err}`)
    }
  }

  public async getFile(cid: string): Promise<Buffer> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response

    try {
      response = await this.makeIpfsRequest(
        '/api/v0/cat',
        {
          arg: cid,
        },
        undefined,
        controller.signal
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout fetching file ${cid} from IPFS`)
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer)
  }
  //needs to pass on form data
  public async uploadFile(file: Buffer): Promise<string> {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(file)])
    form.append('file', blob, 'file')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response

    try {
      response = await this.makeIpfsRequest('/api/v0/add', { 'cid-version': '1' }, form, controller.signal)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout uploading file to IPFS`)
      }
      throw new Error(`Error calling IPFS`)
    } finally {
      clearTimeout(timeout)
    }

    try {
      const responseJson = await response.json()
      const parsedResponse = addResponseParser.parse(responseJson)
      return parsedResponse.Hash
    } catch {
      throw new Error(`Error calling IPFS`)
    }
  }

  private async makeIpfsRequest(route: string, args: Record<string, string>, body?: FormData, signal?: AbortSignal) {
    const url = new URL(route, this.origin)
    const search = new URLSearchParams(args)
    url.search = search.toString()

    const response = await fetch(url.toString(), {
      method: 'POST',
      body,
      signal,
    })

    if (!response.ok) {
      throw new Error(`Error calling IPFS`)
    }

    return response
  }
}
