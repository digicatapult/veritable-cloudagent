import { logger } from '../index.js'
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
      logger.debug(`${err}`)
      throw new Error(`Invalid origin ${origin}`)
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
    const blob = new Blob([file])
    form.append('file', blob, 'file')
    const response = await this.makeIpfsRequest('/api/v0/add', { 'cid-version': '1' }, form)
    const responseJson = await response.json()

    try {
      const parsedResponse = addResponseParser.parse(responseJson)
      return parsedResponse.Hash
    } catch (err) {
      logger.debug(`${err}`)
      throw new Error(`Error calling IPFS`)
    }
  }

  private async makeIpfsRequest(route: string, args: Record<string, string>, body?: FormData) {
    const url = new URL(route, this.origin)
    const search = new URLSearchParams(args)
    url.search = search.toString()

    const response = await fetch(url.toString(), {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      throw new Error(`Error calling IPFS`)
    }

    return response
  }
}
