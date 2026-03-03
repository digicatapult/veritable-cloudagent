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

- `verificationMethod` uses:
  - `Ed25519VerificationKey2020` (`#auth-key`, `#assertion-key`) with `publicKeyMultibase`
  - `X25519KeyAgreementKey2019` (`#agreement-key`) with `publicKeyBase58`
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
- read key material from method-type-specific fields (`publicKeyMultibase`, `publicKeyBase58`)

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
- Runtime config reads are v0.6-aligned with `AgentConfig` semantics:
  - DIDComm endpoints are read from `agent.didcomm.config.endpoints` (module config source), not from `agent.config.endpoints`.
  - Optional custom init fields (for example `label`) are read via `agent.config.toJSON()` with guards, instead of casting `agent.config` to ad-hoc shapes.

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

- `POST /v1/credentials/propose-credential`, `POST /v1/credentials/create-offer`, and `POST /v1/credentials/offer-credential` now enforce runtime JSON-LD shape validation and return `400` for structurally invalid payloads.
- Validation is intentionally shape-based (for example: `credential` object required, valid `@context` shape, valid `type` shape, object checks for `credentialSubject`/`options`) and is not restricted to a single context URI or fixed credential type.

### HTTP 400 error response contract (`BadRequest`)

`BadRequest` handling was enhanced during PR review to address two concrete contract issues:

- **OpenAPI mismatch on 400 responses:** some endpoints documented `400` as a plain string while runtime handlers could return additional validation context.
- **Inconsistent error payload shape:** error middleware returned a mix of string and object responses depending on code path.

Contract update applied:

- `400` responses now use object payloads consistently, with `message` and optional `details`.
- Controller `@Response(400)` annotations were aligned to `BadRequest` to reflect this contract.
- Existing validation flows now attach structured context in `details` where helpful (instead of overloading the message string).
- `details` is intentionally selective: include only actionable context (for example identifier/reason/error arrays), and avoid echoing values that are already fully implied by `message`.

Current canonical `400` shape:

```json
{
  "message": "Validation Failed",
  "details": { "...": "..." }
}
```

`details` is optional and present only when additional error context exists.

## Operational Notes

- Existing consumers that parse legacy DID fragments (`#owner`, `#encryption`) or legacy key fields (`publicKeyMultibase`, `publicKeyBase58`) must migrate.
- Existing webhook/WebSocket consumers must update credential event parsing to `credentialExchangeRecord`.
- Integrations storing raw event payloads should treat this as a schema-version boundary: keep historical v0.5 events as-is, ingest v0.6 events with the new field, and normalize cross-version analytics outside runtime API contracts.
- PEX clients should not submit `presentationExchange.credentials` in `accept-request` for this release; rely on server-side credential selection.

### TypeScript ESM compiler settings

- TypeScript compiler settings are aligned to the Digital Catapult ESM standard:
  - `target: ES2022`
  - `module: NodeNext`
  - `moduleResolution: nodenext`

### Unit test teardown standard for v0.6 migration

- Unit test teardown now uses shared helper-based store cleanup (`deleteAgentStore(...)`) instead of direct per-test wallet/store deletion calls.
- This keeps Askar cleanup behavior consistent with v0.6 bootstrap/storage wiring and reduces test-specific teardown drift across suites.

### Integration test hook and cleanup standard for v0.6 migration

- Integration tests keep long-lived Docker testnet agents running for the full suite (no per-test/per-suite agent restart), to avoid heavy runtime penalties.
- Hook usage was normalized across integration specs:
  - explicit Mocha imports in all integration test files
  - consistent short pause hook style (`beforeEach(async () => await sleep(200))`) where inter-test settling is needed
  - resource cleanup moved to hooks for test-owned resources (for example WebSocket close in media-sharing events), not as terminal test steps.
- This improves consistency and failure resilience while preserving shared-agent execution semantics required for practical integration runtime.

### Why `scripts/patch-credo.cjs` is required in this migration

This repository currently applies a `postinstall` patch pass (`node scripts/patch-credo.cjs`) as a migration safeguard for Credo v0.6 runtime compatibility.

The script patches two dependency-level behaviors in installed `@credo-ts/core` build artifacts:

- **PEX proof type selection fix:** patches DIF Presentation Exchange proof-type selection from a first-supported fallback (`supportedSignatureSuites[0]`) to selected-suite output (`foundSignatureSuite`) to prevent incorrect proof type emission in some PEX paths.
- **JSON-LD strict ESM loader fix:** rewrites JSON-LD document loader imports/requires to include explicit `.js` extensions (`.../node.js`, `.../xhr.js`) so strict ESM resolution works reliably in runtime environments using the packaged Credo build outputs.

Operational intent:

- The patch is idempotent (safe to run repeatedly) and skips already-patched files.
- It is a temporary compatibility layer until equivalent upstream fixes are available and consumed via normal dependency upgrades.
- If dependency layout changes (or upstream ships corrected artifacts), this script may become unnecessary and should then be removed to reduce maintenance overhead.

### BadRequest error type

Clients should parse `response.body.message` and optionally `response.body.details`.

## Recommended Consumer Migration Order

1. Update payload parsers and DTOs for credential events.
2. Update DID:web consumers for relationship-based key lookup and method-specific key fields (`publicKeyMultibase` / `publicKeyBase58`).
3. Deploy consumer updates before enabling new producer/runtime versions in shared environments.
4. Remove any temporary dual-reader fallback after all producers are on v0.6.

## Verification Steps

1. Trigger a credential flow that emits credential state changes.
2. Confirm payload includes `credentialExchangeRecord`.
3. Confirm payload does not include `credentialRecord`.
4. Confirm downstream processing (queues, DB writes, analytics, UI) remains healthy.

Integration validation performed for this migration branch:

- `npm run test:integration` completed successfully against the Docker testnet (`71 passing`).

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
