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

  private getVerificationMethodPublicKeyBase58(verificationMethod: {
    publicKeyBase58?: string
    publicKeyJwk?: unknown
  }): string | undefined {
    if (verificationMethod.publicKeyBase58) {
      return verificationMethod.publicKeyBase58
    }

    if (!verificationMethod.publicKeyJwk) {
      return undefined
    }

    const publicJwk = Kms.PublicJwk.fromUnknown(verificationMethod.publicKeyJwk).toJson()
    if (publicJwk.kty !== 'OKP' || typeof publicJwk.x !== 'string') {
      return undefined
    }

    return TypedArrayEncoder.toBase58(TypedArrayEncoder.fromBase64(publicJwk.x))
  }

  private async resolveKmsKeyIdForRecipientPublicKey(recipientPublicKeyBase58: string, fallbackKeyId: string) {
    const importedDids = await this.agent.dids.getCreatedDids()

    for (const didRecord of importedDids) {
      const verificationMethods = didRecord.didDocument?.verificationMethod ?? []

      for (const verificationMethod of verificationMethods) {
        const verificationMethodPublicKey = this.getVerificationMethodPublicKeyBase58(verificationMethod)
        if (!verificationMethodPublicKey || verificationMethodPublicKey !== recipientPublicKeyBase58) continue

        const mappedKeyId = didRecord.keys?.find(({ didDocumentRelativeKeyId }) =>
          verificationMethod.id.endsWith(didDocumentRelativeKeyId)
        )?.kmsKeyId

        if (mappedKeyId) {
          return mappedKeyId
        }
      }
    }

    return fallbackKeyId
  }

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

    const externalPublicJwk = Kms.PublicJwk.fromUnknown(header.epk).toJson()
    if (externalPublicJwk.kty !== 'OKP' || externalPublicJwk.crv !== 'X25519') {
      throw new HttpResponse({ message: 'Invalid compact JWE header key type', code: 400 })
    }

    const recipientPublicKeyBytes = TypedArrayEncoder.fromBase64(recipientPublicKey)
    const recipientPublicJwk = Kms.PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: recipientPublicKeyBytes,
    })

    const kms = this.agent.kms
    const recipientPublicKeyBase58 = TypedArrayEncoder.toBase58(recipientPublicKeyBytes)
    const keyId = await this.resolveKmsKeyIdForRecipientPublicKey(
      recipientPublicKeyBase58,
      recipientPublicJwk.legacyKeyId
    )

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
          keyId,
          externalPublicJwk,
          apu: typeof header.apu === 'string' ? TypedArrayEncoder.fromBase64(header.apu) : undefined,
          apv: typeof header.apv === 'string' ? TypedArrayEncoder.fromBase64(header.apv) : undefined,
        },
      },
    })

    return TypedArrayEncoder.toBase64(decrypt.data)
  }
}
