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

  private isBase64UrlSegment(value: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(value)
  }

  private decodeBase64UrlSegment(value: string, errorMessage: string): Uint8Array {
    if (!this.isBase64UrlSegment(value)) {
      throw new BadRequest(errorMessage)
    }

    try {
      return TypedArrayEncoder.fromBase64(value)
    } catch {
      throw new BadRequest(errorMessage)
    }
  }

  private decodeBase64UrlJson<T>(value: string, errorMessage: string): T {
    if (!this.isBase64UrlSegment(value)) {
      throw new BadRequest(errorMessage)
    }

    try {
      return JsonEncoder.fromBase64(value) as T
    } catch {
      throw new BadRequest(errorMessage)
    }
  }

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

    const header = this.decodeBase64UrlJson<Record<string, unknown>>(encodedHeader, 'Invalid compact JWE header')

    if (!header?.epk) {
      throw new HttpResponse({ message: 'Invalid compact JWE header', code: 400 })
    }

    const externalPublicJwk = Kms.PublicJwk.fromUnknown(header.epk).toJson()
    if (externalPublicJwk.kty !== 'OKP' || externalPublicJwk.crv !== 'X25519') {
      throw new HttpResponse({ message: 'Invalid compact JWE header key type', code: 400 })
    }

    let recipientPublicKeyBytes: Uint8Array

    try {
      recipientPublicKeyBytes = TypedArrayEncoder.fromBase64(recipientPublicKey)
    } catch {
      throw new BadRequest('Invalid compact JWE recipient public key')
    }

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

    const encrypted = this.decodeBase64UrlSegment(encodedCiphertext, 'Invalid compact JWE segment encoding')
    const iv = this.decodeBase64UrlSegment(encodedIv, 'Invalid compact JWE segment encoding')
    const tag = this.decodeBase64UrlSegment(encodedTag, 'Invalid compact JWE segment encoding')

    let apu: Uint8Array | undefined
    let apv: Uint8Array | undefined

    if (typeof header.apu === 'string') {
      apu = this.decodeBase64UrlSegment(header.apu, 'Invalid compact JWE header agreement parameters')
    }

    if (typeof header.apv === 'string') {
      apv = this.decodeBase64UrlSegment(header.apv, 'Invalid compact JWE header agreement parameters')
    }

    const decrypt = await kms.decrypt({
      encrypted,
      decryption: {
        algorithm: 'A256GCM',
        iv,
        tag,
        aad: TypedArrayEncoder.fromString(encodedHeader),
      },
      key: {
        keyAgreement: {
          algorithm: 'ECDH-ES',
          keyId,
          externalPublicJwk,
          apu,
          apv,
        },
      },
    })

    return TypedArrayEncoder.toBase64(decrypt.data)
  }
}
