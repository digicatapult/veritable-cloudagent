import { JsonEncoder, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { describe, it } from 'mocha'

import { WalletController } from '../../src/controllers/v1/wallet/WalletController.js'
import { HttpResponse } from '../../src/error.js'

describe('Decryption', () => {
  it('should throw 400 for invalid compact JWE format', async function () {
    const walletController = new WalletController({} as never)

    await walletController
      .decrypt(
        {
          log: {
            info: () => {},
          },
        } as never,
        {
          jwe: 'invalid-format',
          recipientPublicKey: TypedArrayEncoder.toBase64(new Uint8Array(32).fill(1)),
          enc: 'A256GCM',
          alg: 'ECDH-ES',
        }
      )
      .then(() => {
        throw new Error('Expected decrypt to throw')
      })
      .catch((error: HttpResponse) => {
        expect(error.code).to.equal(400)
        expect(error.message).to.equal('Invalid compact JWE format')
      })
  })

  it('should throw 400 for compact JWE header without epk', async function () {
    const walletController = new WalletController({} as never)

    const encodedHeader = JsonEncoder.toBase64URL({ alg: 'ECDH-ES', enc: 'A256GCM' })
    const jwe = `${encodedHeader}..${TypedArrayEncoder.toBase64URL(new Uint8Array(12).fill(2))}.${TypedArrayEncoder.toBase64URL(new Uint8Array([3, 4, 5]))}.${TypedArrayEncoder.toBase64URL(new Uint8Array(16).fill(6))}`

    await walletController
      .decrypt(
        {
          log: {
            info: () => {},
          },
        } as never,
        {
          jwe,
          recipientPublicKey: TypedArrayEncoder.toBase64(new Uint8Array(32).fill(1)),
          enc: 'A256GCM',
          alg: 'ECDH-ES',
        }
      )
      .then(() => {
        throw new Error('Expected decrypt to throw')
      })
      .catch((error: HttpResponse) => {
        expect(error.code).to.equal(400)
        expect(error.message).to.equal('Invalid compact JWE header')
      })
  })
})
