import { Buffer, JsonEncoder, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { afterEach, describe, test } from 'mocha'
import { restore as sinonRestore, stub } from 'sinon'

import { WalletController } from '../../src/controllers/v1/wallet/WalletController.js'

describe('WalletController', () => {
  afterEach(() => {
    sinonRestore()
  })

  describe('Decrypt JWE', () => {
    test('should return plaintext data from JWE', async () => {
      const kms = {
        decrypt: async () => ({ data: Buffer.from('test') }),
      }
      const agent = {
        kms,
        dids: {
          getCreatedDids: async () => [],
        },
      }
      const walletController = new WalletController(agent as never)

      const decryptResult = {
        data: Buffer.from('test'),
      }
      const spy = stub(kms, 'decrypt')
      spy.resolves(decryptResult)

      const encodedHeader = JsonEncoder.toBase64URL({
        epk: {
          kty: 'OKP',
          crv: 'X25519',
          x: TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(1)),
        },
      })

      const jwe = `${encodedHeader}..${TypedArrayEncoder.toBase64URL(new Uint8Array(12).fill(2))}.${TypedArrayEncoder.toBase64URL(new Uint8Array([3, 4, 5]))}.${TypedArrayEncoder.toBase64URL(new Uint8Array(16).fill(6))}`

      const params = {
        jwe,
        recipientPublicKey: TypedArrayEncoder.toBase64(new Uint8Array(32).fill(7)),
        enc: 'A256GCM' as const,
        alg: 'ECDH-ES' as const,
      }

      const response = await walletController.decrypt(
        {
          log: {
            info: () => {},
          },
        } as never,
        params
      )

      expect(response).to.equal(decryptResult.data.toString('base64'))
    })
  })
})
