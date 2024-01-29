import sinon from 'sinon'

export const exampleCid = 'QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR'
export const exampleContent = { id: '1234' }

export const withHappyIpfs = (
  catResult: Uint8Array = new Uint8Array(Buffer.from(JSON.stringify(exampleContent), 'utf8'))
) => {
  const ipfs = {
    cat: sinon
      .stub<[string], AsyncIterator<Uint8Array>>()
      .withArgs(exampleCid)
      .callsFake(async function* () {
        yield catResult
      }),
    add: sinon.stub<[Buffer], Promise<{ cid: string }>>().resolves({ cid: exampleCid }),
  }

  return ipfs
}

export const withIpfsErrors = (errOnGet = true, errOnUpload = true) => {
  const ipfs = {
    cat: errOnGet
      ? sinon.stub<[string], AsyncIterator<Uint8Array>>().withArgs(exampleCid).rejects(new Error())
      : sinon
          .stub<[string], AsyncIterator<Uint8Array>>()
          .withArgs(exampleCid)
          .callsFake(async function* () {
            yield new Uint8Array(Buffer.from(JSON.stringify(exampleContent), 'utf8'))
          }),
    add: errOnUpload
      ? sinon.stub<[Buffer], Promise<{ cid: string }>>().rejects(new Error())
      : sinon.stub<[Buffer], Promise<{ cid: string }>>().resolves({ cid: exampleCid }),
  }

  return ipfs
}
