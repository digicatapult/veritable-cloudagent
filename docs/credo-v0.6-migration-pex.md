# Migration plan — Credo TS v0.5.x → v0.6.x (DIF Presentation Exchange)

This document describes a low-risk path to migrate veritable-cloudagent from Credo TS v0.5.x to v0.6.x while keeping TSOA/OpenAPI generation stable and maintaining predictable behavior for DIF Presentation Exchange (PEX).

Important: this is not a “do all this before upgrading” checklist. It separates:

- Changes we expect to be required because Credo TS v0.6.x changed.
- Optional follow-ups we may choose to do after upgrading (e.g., to expose more W3C/PEX capabilities safely).

Context:

- Credo TS v0.5.x exposes DIF PEX proof-format types that are explicitly V1-shaped (`DifPresentationExchangeDefinitionV1`).
- Importing Sphereon PEX model graphs into controller DTOs destabilizes TSOA schema generation.
- We currently model a TSOA-friendly “v2-looking” `presentationDefinition` DTO (`PresentationDefinitionV2`) and bridge at runtime.

The goal is to avoid two failure modes:

1. Silent acceptance of payloads that “sometimes work” but break in Credo or at runtime.
2. Frequent OpenAPI churn as we iterate on internal type-safety.

---

## 1) Current state on v0.5.x (as implemented)

### 1.1 DTO strategy (TSOA-safe)

- Controller DTOs intentionally avoid importing Sphereon PEX model graphs.
- We use a TSOA-friendly, “v2-looking” approximation for `presentationDefinition` (`PresentationDefinitionV2`) in `src/controllers/types/pex.ts`.

### 1.2 Runtime PEX profile enforcement

- We enforce a conservative **v1-compatible PEX profile** at the REST boundary.
- The validator is implemented as `validatePexV1Presentation` in `src/utils/proofs.ts` and is invoked by:
  - `/v1/proofs/propose-proof`
  - `/v1/proofs/create-request`
  - `/v1/proofs/request-proof`
  - Verified DRPC proof request options validation
- Rejections are returned as TSOA `ValidateError` (HTTP 422) with `{ message, details }` via the existing error middleware.

### 1.3 Stage correctness (accept-proposal)

- `accept-proposal` is options-only for DIF PEX; `presentationDefinition` is rejected at the API boundary.
- This behavior is covered by unit tests (e.g., `tests/unit/proof.test.ts` includes a 422 when `presentationDefinition` is sent to `accept-proposal`).

### 1.4 Boundary adapters to Credo types

- We bridge TSOA DTO shapes to Credo agent option shapes in `src/utils/proofs.ts` via:
  - `transformProofFormats` (create/request)
  - `transformProposeProofFormats` (propose)
- `presentationDefinition` is cast at the adapter boundary (inline) to match Credo’s internal PEX typing.
  - This is an intentional boundary cast (DTOs stay TSOA-safe; the agent call receives the expected type).

### 1.5 Accept-request behavior (current)

- `/v1/proofs/:proofRecordId/accept-request` supports:
  - auto-selection when `proofFormats` is omitted (via `selectCredentialsForRequest`)
  - simplified AnonCreds selection (hydrated server-side)
  - full proof formats passthrough (with defensive validation for empty AnonCreds selections)
- For DIF PEX accept-request credential selection specifically, our DTO typing remains intentionally generic (`Record<string, unknown[]>`) to keep TSOA stable.
  - Credo expects record objects for PEX selection, so this is not a stable client contract today.

---

## 2) What changes when upgrading to v0.6.x

Credo TS v0.6.0 is explicitly called out upstream as a “very big release”, and the upstream release notes recommend consulting per-package changelogs.

What we can say up front (based on upstream v0.6.0/v0.6.1 release notes):

- W3C VC support changes in v0.6.x (e.g., VCDM 2.0 support and expanded v2 credential types; upstream PRs include #2387, #2418). This may affect any code paths that assume v0.5.x-only W3C VC shapes.
- There are multiple PEX-related fixes/improvements in v0.6.0 (upstream PRs include #2104, #2148, #2253). The release notes don’t enumerate a full behavioral diff, so we should assume subtle changes in edge cases (especially around multi-credential handling).
- The default JSON-LD document loader behavior changes (e.g., adding missing contexts like Linked Verifiable Presentation v1; upstream PR #2566), which can affect verification for JSON-LD proof flows.

So the pragmatic approach is:

### 2.1 Upgrade-driven checks

After bumping Credo dependencies:

- Re-run `npm run check` and the proof unit/integration suites to catch compile-time and behavioral changes.
- Re-check Credo’s PEX type surface:
  - whether `presentationDefinition` typing changes (e.g., v2-capable types becoming available)
  - whether credential-selection structures change shape for W3C/SD-JWT/mdoc
- Re-check JSON-LD verification behavior because the default document loader changed in v0.6.x.

### 2.2 Default posture after upgrade

- Keep the current v1-compatible runtime validator in place unless a v0.6.x change forces us to widen it.
- Only widen accepted `presentationDefinition` constructs when there is a concrete use-case and a test proving it works end-to-end.

---

## 3) Optional W3C/PEX follow-ups (not required by the v0.6.x upgrade)

This section captures concrete, still-open items for **W3C credentials + PEX**. These are not “migration blockers”; they’re follow-ups we might choose to do once v0.6.x is landed and stable.

### 3.1 PEX accept-request credential-selection contract (only needed for client-driven selection)

Credo’s DIF PEX accept-request typing expects a mapping of input descriptor IDs to **Credo credential records**:

- `DifPexInputDescriptorToCredentials = Record<string, Array<W3cCredentialRecord | SdJwtVcRecord | MdocRecord>>`

In veritable-cloudagent, the controller DTO currently models PEX `acceptRequest.credentials` as:

- `Record<string, unknown[]>`

This mismatch forces a cast at the accept-request boundary and makes the REST API contract ambiguous.

If we want to safely accept client-provided PEX credential selections in the future, we will need an explicit REST contract. Two viable shapes:

Option A (low-risk):

- Keep `/v1/proofs/:proofRecordId/accept-request` supporting:
  - “auto select” (omit `proofFormats`) and
  - “simple anoncreds selection” (existing `SimpleProofFormats`)
- Do **not** accept PEX `credentials` from clients (or ignore/reject it with 422) until we have a stable ID-based contract.

Option B (full capability, more work):

- Change PEX accept-request DTO to accept **record IDs** (not record objects), e.g.
  - `Record<string, string[]>` where values are record IDs
- In the controller, resolve those IDs to records via the agent repositories/modules (W3C / SD-JWT / mdoc) before calling Credo.
- Add validation:
  - IDs exist
  - record type matches expected claim format
  - record is usable for the requested input descriptor

Either option makes the client contract explicit and avoids pushing internal record objects across the API boundary.

### 3.2 Safe “PEX credentials for request” response shape (W3C-aware)

Credo’s `getCredentialsForRequest` / `selectCredentialsForRequest` data structures contain record objects.
Even if we only use them server-side, we should avoid returning (or logging) raw record objects.

If we expose W3C/PEX selection data via the REST API, we will need a REST-friendly response shape that contains:

- input descriptor id
- credential record id
- minimal metadata needed for client choice (e.g., schema/type, issuer, subject, dates)
- claim format (`JwtVc`, `LdpVc`, `SdJwtVc`, `MsoMdoc`)

This keeps the API usable for W3C selection flows without exposing internal record layouts.

### 3.3 Logging/redaction for PEX paths

Today `redactProofFormats` primarily handles AnonCreds selections.
For W3C/PEX flows, ensure we never log raw PEX credential records.

Current gap (if we start accepting client-driven PEX selection):

- Extend redaction to handle `presentationExchange.acceptRequest.credentials` by replacing arrays with `[REDACTED]` or record IDs only.
- Avoid logging `selectCredentialsForRequest` outputs at info level when they may contain W3C record objects.

### 3.4 Post-upgrade verification (once on v0.6.x)

Once Credo is upgraded, verify the actual behavior we rely on:

- Re-check whether Credo’s PEX type surface becomes V2-capable (presentation definition typing).
  - If so, remove any “V1-only” adapters that exist purely for type compatibility.
- Re-run end-to-end proof flows for:
  - AnonCreds
  - W3C VC (JWT / JSON-LD)
  - SD-JWT VC (if enabled)
  - mdoc (if enabled)

### 3.5 Tests to add/extend (only if we expand W3C/PEX support)

- Unit: ensure `/accept-request` rejects ambiguous/unsupported PEX credential input if Option A is chosen.
- Unit: if Option B is chosen, add tests for ID resolution failures (404/422) and successful resolution.
- Integration: add at least one PEX proof request that can be satisfied by a W3C credential and verify the full verifier↔prover flow.

---

## 4) Tests that reflect current behavior

These behaviors are already enforced and should continue to pass after the upgrade:

- **`accept-proposal` stage correctness**
  - Valid: anoncreds accept-proposal payload shape and PEX options-only.
  - Invalid: request-stage payloads rejected with 422.

- **PEX profile enforcement**
  - Valid: minimal V1-compatible presentation definition accepted.
  - Invalid: unknown/v2-only-ish keys rejected with 422.

Post-upgrade (v0.6.x), add tests that prove each newly-enabled PEX structure is accepted and correctly forwarded to the agent.

---

## 5) Rollout / rollback notes

- Rollout:
  - Upgrade Credo to v0.6.x.
  - Keep current runtime validation and stage-correctness in place.
  - Only widen accepted PEX constructs when there is a clear requirement and test coverage.

- Rollback:
  - Keep the strict v1-compatible profile in place.
  - If any newly-enabled construct causes issues, revert the validator allowlist change without needing OpenAPI changes.
