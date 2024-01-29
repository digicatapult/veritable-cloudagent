import { addResponseParser } from './responseParser'
// import { generateKeyPairSync } from 'crypto'

export interface MetadataFile {
  blob: Blob
  filename: string
}

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
      throw new Error(`Error calling IPFS`)
    }
  }

  // public async publishToIPNS(key: string, file: Buffer): Promise<Buffer> {
  //   //need topublish to ipfs - which can be done before ==upload file
  //   const cid = this.uploadFile(file)
  //   //generate ipns keypair to sign and update ipns record -> done before publishing to ipns
  //   //publish ipns record
  //   const response = await this.makeIpfsRequest('/api/v0/name/publish', {
  //     arg: `/ipfs/${cid}`,
  //     key: key,
  //   })
  //   return Buffer.from(await response.arrayBuffer()) //we would want a name from the buffer
  // }

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

  // private async generateIPNSKeyPair() {
  //   const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  //     modulusLength: 2048,
  //     publicKeyEncoding: { type: 'spki', format: 'pem' },
  //     privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  //   })
  //   return {
  //     publicKey: publicKey.toString(),
  //     privateKey: privateKey.toString(),
  //   }
  // }
}
