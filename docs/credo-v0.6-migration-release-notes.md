# Credo v0.6 Migration Release Notes

## Scope

This document summarizes externally visible changes introduced by the Credo-TS v0.6 migration in `veritable-cloudagent`.

## Breaking Changes

### DIDComm API surface

- DIDComm capabilities are now accessed via `agent.didcomm.*` instead of legacy direct module access patterns.
- Event enums/types now use `@credo-ts/didcomm` naming (for example `DidCommConnectionEventTypes`, `DidCommCredentialEventTypes`, `DidCommProofEventTypes`).

### Event payload contract

Credential state-change payloads now expose `payload.credentialExchangeRecord` and no longer expose `payload.credentialRecord`.

No compatibility alias is emitted.

Old (v0.5.x) payload shape:

```json
{
  "type": "CredentialStateChanged",
  "payload": {
    "credentialRecord": {
      "id": "...",
      "state": "offer-received"
    }
  }
}
```

New (v0.6) payload shape:

```json
{
  "type": "DidCommCredentialStateChanged",
  "payload": {
    "credentialExchangeRecord": {
      "id": "...",
      "state": "offer-received"
    }
  }
}
```

Consumer migration checklist:

- Replace all `payload.credentialRecord` reads with `payload.credentialExchangeRecord`.
- Update DTOs/schemas and required fields to `credentialExchangeRecord`.
- Update runtime guards to require the new field.
- Update analytics/ETL mappings from `credentialRecord.*` to `credentialExchangeRecord.*`.
- Update contract tests to assert presence of `credentialExchangeRecord` and absence of `credentialRecord`.

### DID:web generated document shape

Auto-generated DID:web documents now use v0.6-aligned canonical semantics:

- `verificationMethod` uses `JsonWebKey2020` with `publicKeyJwk`
- method fragments: `#auth-key`, `#assertion-key`, `#agreement-key`
- explicit relationship arrays:
  - `authentication` -> `#auth-key`
  - `assertionMethod` -> `#assertion-key`
  - `keyAgreement` -> `#agreement-key`
  - `capabilityInvocation` -> `#auth-key`

Service configuration remains DIDComm v1-compatible (`did-communication`) for interoperability.

Legacy generated shape (for comparison):

- verification methods: `#owner`, `#encryption`
- key types: `Ed25519VerificationKey2020`, `X25519KeyAgreementKey2019`
- key fields: `publicKeyMultibase` / `publicKeyBase58`
- no `capabilityInvocation`

Consumer migration guidance:

- stop resolving keys by fixed fragments (`#owner`, `#encryption`)
- resolve verification methods by relationship (`authentication`, `assertionMethod`, `keyAgreement`)
- read key material from `publicKeyJwk`

Internal runtime note:

- wallet decrypt key resolution supports JWK-expressed verification methods and keeps compatibility key-id fallback where required.

### Out-of-band invitation label contract

- REST endpoints for invitation receipt/acceptance are v0.6-aligned for `label`.
- `label` is now required for:
  - `POST /v1/oob/receive-invitation`
  - `POST /v1/oob/receive-invitation-url`
  - `POST /v1/oob/:outOfBandId/accept-invitation`
- Requests missing `label` are rejected at validation boundary (`422`) instead of being defaulted server-side.

### Out-of-band accept-invitation config contract

`POST /v1/oob/:outOfBandId/accept-invitation` request body is v0.6-aligned with Credo API options:

- removed legacy field: `mediatorId`
- supported fields now include:
  - `routing`
  - `timeoutMs`
  - `ourDid`

Clients using `mediatorId` must migrate to routing-based configuration.

### DID import/create DTO contract alignment

- DID import payloads are v0.6-aligned with Credo naming:
  - removed: `privateKeys`
  - use: `keys` (`DidDocumentKey[]`)
- DID create pass-through maps remain intentionally broad and Credo-aligned:
  - `options: Record<string, unknown>`
  - `secret: Record<string, unknown>`

Requests still using `privateKeys` will fail validation (`422`).

### Agent bootstrap and Askar config

- v0.6 moves key handling to KMS-first flows (`agent.kms`), and this change requires Askar registration to be process-global (`ensureAskarRegistered`): `registerAskar({ askar: askarNodeJS })` executes once per process and is shared across agent boots.
- Askar store config is explicit at top-level bootstrap input (`askarStoreConfig`), not inferred from `agentConfig.walletConfig`.
- KMS-first patterns are used in migrated crypto paths (`agent.kms`), with DID key mapping persistence for DID:web imports.

`src/agent.ts` Askar + AnonCreds wiring changes in v0.6:

- The Askar module is constructed explicitly with the NodeJS binding and provided store config (`new AskarModule({ askar: askarNodeJS, store: askarStoreConfig })`).
- AnonCreds uses the NodeJS binding (`@hyperledger/anoncreds-nodejs`) and is wired into `AnonCredsModule` with the IPFS-backed `VeritableAnonCredsRegistry`.
- Bootstrap now enforces link-secret existence at startup: if no link secret exists, one default secret is created.

Bootstrap idempotence regression tests were added in `tests/unit/agent.test.ts` to ensure repeated `setupAgent()` runs against the same Askar store do not create additional AnonCreds link secrets. This is necessary in v0.6 because key operations now follow KMS-first flows (`agent.kms`) while Askar registration is process-global (single registration shared across agent boots), so restart/re-bootstrap paths must be proven free of duplicate side effects in shared stores.

In short: the KMS migration in v0.6 is the reason Askar becomes process-global, and that is why bootstrap and AnonCreds initialization were tightened to be idempotent across repeated agent setup in the same process.

### PEX accept-request credential selection contract

- `POST /v1/proofs/:proofRecordId/accept-request` now rejects client-supplied `proofFormats.presentationExchange.credentials` with `422`.
- PEX credential selection remains server-side/agent-side for this release.
- PEX credential payloads are redacted in proof-format logging paths.

This is an intentional hardening boundary for v0.6 migration stability.

Future support for client-selected PEX credentials (descriptor->record-id contract) remains out of scope for this migration release and should be planned as a separate post-migration API enhancement.

### JSON-LD credential boundary validation

- `POST /v1/credentials/propose-credential`, `POST /v1/credentials/create-offer`, and `POST /v1/credentials/offer-credential` now enforce runtime JSON-LD shape validation and return `422` for structurally invalid payloads.
- Validation is intentionally shape-based (for example: `credential` object required, valid `@context` shape, valid `type` shape, object checks for `credentialSubject`/`options`) and is not restricted to a single context URI or fixed credential type.

## Operational Notes

- Existing consumers that parse legacy DID fragments (`#owner`, `#encryption`) or legacy key fields (`publicKeyMultibase`, `publicKeyBase58`) must migrate.
- Existing webhook/WebSocket consumers must update credential event parsing to `credentialExchangeRecord`.
- Integrations storing raw event payloads should treat this as a schema-version boundary: keep historical v0.5 events as-is, ingest v0.6 events with the new field, and normalize cross-version analytics outside runtime API contracts.
- PEX clients should not submit `presentationExchange.credentials` in `accept-request` for this release; rely on server-side credential selection.

## Recommended Consumer Migration Order

1. Update payload parsers and DTOs for credential events.
2. Update DID:web consumers for `JsonWebKey2020` + relationship-based key lookup.
3. Deploy consumer updates before enabling new producer/runtime versions in shared environments.
4. Remove any temporary dual-reader fallback after all producers are on v0.6.

## Verification Steps

1. Trigger a credential flow that emits credential state changes.
2. Confirm payload includes `credentialExchangeRecord`.
3. Confirm payload does not include `credentialRecord`.
4. Confirm downstream processing (queues, DB writes, analytics, UI) remains healthy.

## Upgrade Examples

### OOB accept-invitation payload

Before (legacy):

```json
{
  "label": "Alice",
  "mediatorId": "<id>"
}
```

Legacy payload behavior: rejected with `422` (validation error).

After (v0.6-aligned):

```json
{
  "label": "Alice",
  "routing": {
    "recipientKey": { "kty": "OKP", "crv": "Ed25519", "x": "..." },
    "routingKeys": [],
    "endpoints": ["https://example.com/didcomm"],
    "mediatorId": "<optional>"
  },
  "timeoutMs": 20000,
  "ourDid": "did:key:z6Mk..."
}
```

### DID import payload

Before (legacy):

```json
{
  "did": "did:key:z6Mk...",
  "privateKeys": [
    {
      "keyType": "Ed25519",
      "privateKey": "..."
    }
  ]
}
```

Legacy payload behavior: rejected with `422` (validation error).

After (v0.6-aligned):

```json
{
  "did": "did:key:z6Mk...",
  "keys": [
    {
      "kmsKeyId": "<wallet-key-id>",
      "didDocumentRelativeKeyId": "#z6Mk..."
    }
  ],
  "overwrite": false
}
```

## Related Docs

- `docs/credo-did-documents-v0.5-v0.6.md`
