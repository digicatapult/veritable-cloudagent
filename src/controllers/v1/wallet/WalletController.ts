import { Agent, JsonEncoder, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Body, Controller, Post, Request, Response, Route, Tags } from '@tsoa/runtime'
import express from 'express'
import { injectable } from 'tsyringe'

import type { RestAgent } from '../../../agent.js'
import { BadRequest, HttpResponse } from '../../../error.js'

@Tags('Wallet')
@Route('/v1/wallet')
@injectable()
export class WalletController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * JWE decryption using ECDH-ES and A256GCM.
   * Public key must be a base64 encoded X25519 public key and correspond to a private key in the wallet.
   * @param request
   * @returns decrypted data of the JWE as a base64 encoded string
   */
  @Post('/decrypt')
  @Response<BadRequest['message']>(400)
  @Response<HttpResponse>(500)
  public async decrypt(
    @Request() req: express.Request,
    @Body()
    request: {
      jwe: string
      recipientPublicKey: string
      enc: 'A256GCM'
      alg: 'ECDH-ES'
    }
  ) {
    const { jwe, recipientPublicKey } = request
    req.log.info('decrypting jwe for recipient public key %s', recipientPublicKey)

    const jweParts = jwe.split('.')
    if (jweParts.length !== 5) {
      throw new HttpResponse({ message: 'Invalid compact JWE format', code: 400 })
    }

    const [encodedHeader, , encodedIv, encodedCiphertext, encodedTag] = jweParts
    const header = JsonEncoder.fromBase64(encodedHeader)

    if (!header?.epk) {
      throw new HttpResponse({ message: 'Invalid compact JWE header', code: 400 })
    }

    const recipientPublicKeyBytes = TypedArrayEncoder.fromBase64(recipientPublicKey)
    const recipientPublicJwk = Kms.PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: recipientPublicKeyBytes,
    })

    const kms = this.agent.context.resolve(Kms.KeyManagementApi)

    const decrypt = await kms.decrypt({
      encrypted: TypedArrayEncoder.fromBase64(encodedCiphertext),
      decryption: {
        algorithm: 'A256GCM',
        iv: TypedArrayEncoder.fromBase64(encodedIv),
        tag: TypedArrayEncoder.fromBase64(encodedTag),
        aad: TypedArrayEncoder.fromString(encodedHeader),
      },
      key: {
        keyAgreement: {
          algorithm: 'ECDH-ES',
          keyId: recipientPublicJwk.legacyKeyId,
          externalPublicJwk: Kms.PublicJwk.fromUnknown(header.epk).toJson(),
          apu: typeof header.apu === 'string' ? TypedArrayEncoder.fromBase64(header.apu) : undefined,
          apv: typeof header.apv === 'string' ? TypedArrayEncoder.fromBase64(header.apv) : undefined,
        },
      },
    })

    return TypedArrayEncoder.toBase64(decrypt.data)
  }
}
