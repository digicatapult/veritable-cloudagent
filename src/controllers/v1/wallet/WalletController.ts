import { Agent, Key, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Post, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { RestAgent } from '../../../agent.js'
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

    if (!this.agent.context.wallet.directDecryptCompactJweEcdhEs) {
      throw new HttpResponse({ message: 'Wallet not configured for ECDH-ES' })
    }
    const recipientKey = new Key(TypedArrayEncoder.fromBase64(recipientPublicKey), KeyType.X25519)

    const decrypt = await this.agent.context.wallet.directDecryptCompactJweEcdhEs({
      compactJwe: jwe,
      recipientKey,
    })

    return decrypt.data.toString('base64')
  }
}
