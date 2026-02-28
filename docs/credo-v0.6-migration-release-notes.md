# Credo v0.6 Migration Release Notes

## Scope

This document summarizes externally visible changes introduced by the Credo TS v0.6 migration in `veritable-cloudagent`.

## Breaking Changes

### DIDComm API surface

- DIDComm capabilities are now accessed via `agent.didcomm.*` instead of legacy direct module access patterns.
- Event enums/types are migrated to `@credo-ts/didcomm` naming (for example `DidCommConnectionEventTypes`, `DidCommCredentialEventTypes`, `DidCommProofEventTypes`).

### Event payload contract

Credential state-change payloads now expose:

- `payload.credentialExchangeRecord`

and no longer expose:

- `payload.credentialRecord`

No compatibility alias is emitted by the runtime.

### DID:web generated document shape

Auto-generated DID:web documents now use canonical v0.6 semantics:

- `verificationMethod` uses `JsonWebKey2020` with `publicKeyJwk`
- method fragments: `#auth-key`, `#assertion-key`, `#agreement-key`
- explicit relationship arrays:
  - `authentication` -> `#auth-key`
  - `assertionMethod` -> `#assertion-key`
  - `keyAgreement` -> `#agreement-key`
  - `capabilityInvocation` -> `#auth-key`

Service configuration remains DIDComm v1-compatible (`did-communication`) for interoperability.

### Agent bootstrap and Askar config

- Askar store config is explicit at top-level bootstrap input (`askarStoreConfig`), not inferred from `agentConfig.walletConfig`.
- KMS-first patterns are used in migrated crypto paths (`agent.kms`), with DID key mapping persistence for DID:web imports.

## Operational Notes

- Existing consumers that parse legacy DID fragments (`#owner`, `#encryption`) or legacy key fields (`publicKeyMultibase`, `publicKeyBase58`) must migrate.
- Existing webhook/WebSocket consumers must update credential event parsing to `credentialExchangeRecord`.

## Recommended Consumer Migration Order

1. Update payload parsers and DTOs for credential events.
2. Update DID:web consumers for `JsonWebKey2020` + relationship-based key lookup.
3. Deploy consumer updates before enabling new producer/runtime versions in shared environments.

## Related Docs

- `docs/credentialrecord-to-credentialexchangerecord-migration.md`
- `docs/didweb-canonical-v0.6-migration.md`
- `docs/credo-did-documents-v0.5-v0.6.md`
