# DID:web Generation Migration: Legacy Shape -> Canonical v0.6

## Summary

The auto-generated DID:web document now uses canonical Credo v0.6 key semantics.

This is a breaking contract change for consumers that parse verification method IDs or legacy key fields.

## What changed

Old generated shape (legacy):

- verification methods: `#owner`, `#encryption`
- key types: `Ed25519VerificationKey2020`, `X25519KeyAgreementKey2019`
- key material fields: `publicKeyMultibase` / `publicKeyBase58`
- no `capabilityInvocation`

New generated shape (canonical v0.6):

- verification methods: `#auth-key`, `#assertion-key`, `#agreement-key`
- key type: `JsonWebKey2020`
- key material field: `publicKeyJwk`
- explicit `capabilityInvocation: ["#auth-key"]`

Service behavior remains DIDComm v1-compatible (`did-communication`) for interoperability.

## Consumer impact

Update any logic that assumes:

- `#owner` or `#encryption` fragment IDs
- `publicKeyMultibase` / `publicKeyBase58` in generated DID docs

New logic should read:

- verification methods by relationship (`authentication`, `assertionMethod`, `keyAgreement`)
- JWK key material from `publicKeyJwk`

## Internal compatibility

Wallet decrypt key resolution now supports DID verification methods expressed as JWKs, and still falls back to compatibility key IDs where required.

## Related files

- `src/utils/didWebGenerator.ts`
- `src/controllers/v1/wallet/WalletController.ts`
- `docs/credo-did-documents-v0.5-v0.6.md`
