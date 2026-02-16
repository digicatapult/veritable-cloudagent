# OpenAPI ↔ Credo TS v0.5.x type alignment (current approach)

This document explains how veritable-cloudagent aligns its **TSOA/OpenAPI DTO types** with **Credo TS v0.5.x** internal types while keeping OpenAPI generation stable.

It is intentionally short and describes the *current implementation* on this branch.

---

## Why we need alignment

- Credo TS is the runtime source of truth, but many Credo types (especially DIF PEX types) indirectly depend on **Sphereon PEX model graphs**, which are not stable to use in TSOA controller signatures.
- TSOA schema generation must remain deterministic; introducing complex external type graphs has previously caused duplicate model names and discouraged `Object` diagnostics.
- Some Credo APIs are **stage-specific** (e.g., proof `acceptProposal` vs `createRequest`), but naive “one shape fits all” DTOs lead to unsound typing and runtime surprises.

---

## Core pattern (DTO boundary)

We treat controller types as *DTOs for OpenAPI*, and we bridge to Credo types at runtime boundaries.

1. **TSOA-safe controller DTOs**
   - Defined under `src/controllers/types/*`.
   - Prefer re-exporting Credo types when they are simple and stable for TSOA.
   - Keep local “JSON-ish” approximations when importing Credo types would pull Sphereon graphs into controller signatures.

2. **Runtime boundary validation**
   - When DTOs are more permissive than Credo, validate the effective contract at the boundary.
   - For PEX `presentationDefinition`, we enforce a conservative **v1-compatible profile** (see below).

3. **Boundary adapters (DTO → agent options)**
   - We build agent-call option objects explicitly and type-check them using `satisfies Parameters<...>[0]` where possible.
   - For proofs, proof-format payloads are adapted in `src/utils/proofs.ts`.

4. **Stage correctness enforced by DTO shape + 422s**
   - Requests that provide stage-inappropriate payloads are rejected with a TSOA `ValidateError` (HTTP 422).

---

## Proofs: DIF Presentation Exchange (PEX)

### DTO shape vs Credo v0.5.x expectations

- Controller DTOs model `presentationDefinition` as a TSOA-friendly, “v2-looking” approximation (`PresentationDefinitionV2`) in `src/controllers/types/pex.ts`.
- Credo v0.5.x’s declared PEX type surface is **V1-shaped** (e.g., `DifPresentationExchangeDefinitionV1`).

### How we keep this safe on v0.5.x

1. **Runtime validator: v1-compatible PEX profile**
   - Implemented as `validatePexV1Presentation` in `src/utils/proofs.ts`.
   - Enforced by controllers before calling the agent for:
     - `POST /v1/proofs/propose-proof`
     - `POST /v1/proofs/create-request`
     - `POST /v1/proofs/request-proof`
     - Verified DRPC proof request option validation
   - Rejections are returned as `ValidateError` (422) via the existing error handler.

2. **Boundary cast to Credo type (in adapters)**
   - After runtime validation, we cast the DTO `presentationDefinition` to the agent’s expected type inside the proof-format adapters.
   - This is done inline in `transformProofFormats` and `transformProposeProofFormats` using the local alias `AgentPresentationDefinition`.

3. **Adapters for proof formats**
   - `transformProofFormats` (create-request/request-proof)
   - `transformProposeProofFormats` (propose-proof)

### Stage correctness: PEX accept-proposal

- Credo’s PEX `acceptProposal` is **options-only**; it should not accept a `presentationDefinition`.
- The API enforces this and unit tests assert a 422 when a PEX `presentationDefinition` is sent to `/v1/proofs/:id/accept-proposal`.

---

## Proofs: accept-request and “simple formats”

`POST /v1/proofs/:proofRecordId/accept-request` supports three modes:

- **Auto-selection** when `proofFormats` is omitted (`selectCredentialsForRequest`).
- **Simplified AnonCreds selection** (`SimpleProofFormats`) which is hydrated server-side.
- **Full proof formats** passthrough (with defensive checks for empty AnonCreds selections).

This is a deliberate API/UX choice: Credo expects full `ProofFormatPayload<..., 'acceptRequest'>`, but we also support a simpler client-facing shape for AnonCreds.

### Known mismatch: PEX accept-request credential selection

- Credo expects PEX accept-request selections as a mapping from input descriptor ids to **Credo credential record objects**.
- Our TSOA DTO models this as `Record<string, unknown[]>` to avoid importing record types and to keep OpenAPI stable.

Result: this is **not a stable public client contract today**; client-driven PEX selection requires an explicit contract decision (e.g., record IDs resolved server-side).

---

## Credentials: re-using Credo types where safe

Where Credo exports stable, simple interface types that don’t pull in problematic graphs, we prefer to reuse them rather than redefining local DTO approximations.

Example (already done in this repo): JSON-LD credential format types are re-exported for controller typing.

---

## Practical rules of thumb (v0.5.x)

- If importing a Credo type into a controller signature drags in Sphereon PEX models: **do not import it**. Define a local DTO and bridge at the boundary.
- If DTOs are intentionally broader than Credo: add a **runtime validator** and return a 422 on unsupported input.
- Prefer `satisfies` for agent option objects (DTO → internal) to avoid wide `as Internal...` casts.
- Keep stage-specific payloads stage-correct in DTOs; don’t accept request-stage payloads in accept-stage endpoints.

---

## Key files (implementation)

- `src/controllers/types/pex.ts` — PEX DTOs (TSOA-friendly)
- `src/utils/proofs.ts` — PEX validator + proof format adapters
- `src/controllers/v1/proofs/ProofController.ts` — boundary validation + agent calls
- `tests/unit/proof.test.ts` — stage correctness + PEX validation expectations
