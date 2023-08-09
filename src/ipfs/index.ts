import { addResponseParser } from './responseParser'

export default class Ipfs {
  constructor(private origin: string) {
    try {
      new URL(origin)
    } catch (err) {
      throw new Error(`Invalid origin ${origin}`)
    }
  }

  public async getFile(cid: string): Promise<Buffer> {
    const response = await this.makeIpfsRequest('/api/v0/cat', {
      arg: cid,
    })
    return Buffer.from(await response.arrayBuffer())
  }

  public async uploadFile(file: Buffer): Promise<string> {
    const response = await this.makeIpfsRequest('/api/v0/add', { 'cid-version': '1' }, file)
    const responseJson = await response.json()

    try {
      const parsedResponse = addResponseParser.parse(responseJson)
      return parsedResponse.Hash
    } catch (err) {
      throw new Error(`Error calling IPFS`)
    }
  }

  private async makeIpfsRequest(route: string, args: Record<string, string>, body?: Buffer) {
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
