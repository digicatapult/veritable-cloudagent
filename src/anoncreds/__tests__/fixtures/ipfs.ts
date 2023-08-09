import sinon from 'sinon'

import Ipfs from '../../../ipfs'

export const exampleCid = 'QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR'
export const exampleContent = { id: '1234' }

export const withHappyIpfs = (getFileResult: Buffer = Buffer.from(JSON.stringify(exampleContent), 'utf8')) => {
  const ipfs = sinon.createStubInstance(Ipfs, {
    getFile: sinon.stub<[string], Promise<Buffer>>().withArgs(exampleCid).resolves(getFileResult),
    uploadFile: sinon.stub<[Buffer], Promise<string>>().resolves(exampleCid),
  })

  return ipfs
}

export const withIpfsErrors = (errOnGet = true, errOnUpload = true) => {
  const ipfs = sinon.createStubInstance(Ipfs, {
    getFile: errOnGet
      ? sinon.stub<[string], Promise<Buffer>>().withArgs(exampleCid).rejects(new Error())
      : sinon
          .stub<[string], Promise<Buffer>>()
          .withArgs(exampleCid)
          .resolves(Buffer.from(JSON.stringify(exampleContent), 'utf8')),
    uploadFile: errOnUpload
      ? sinon.stub<[Buffer], Promise<string>>().rejects(new Error())
      : sinon.stub<[Buffer], Promise<string>>().resolves(exampleCid),
  })

  return ipfs
}
