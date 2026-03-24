# W3C Compliance and Type Safety Gaps

This document tracks known issues and technical debt identified during PR #451 remediation. These items were deferred to avoid blocking the release but should be addressed in future refactoring.

## Unsafe Type Assertions

In several places, we use `satisfies` at the DTO boundary to align controller DTOs (TSOA/OpenAPI-facing) with `RestAgent` method parameter types, with explicit casts only where needed. This must be monitored because if the agent method parameter types change (e.g. in a Credo-TS upgrade), API inputs might no longer match what the agent expects, leading to runtime errors.

* **Locations:**
  * `src/controllers/v1/credentials/CredentialController.ts`: mostly uses `satisfies` for DTO-to-agent alignment.
  * `src/controllers/v1/proofs/ProofController.ts`: mostly uses `satisfies`, with explicit casts in `acceptRequest` for proof format handling.

* **Mitigation options:**
  * Add runtime validation for controller inputs (e.g. Zod schemas or type guards) before passing data into the agent.
  * Where the DTOs can remain TSOA-friendly, align them more tightly with `RestAgent` method parameters so fewer assertions are needed.
* **Current approach:** We rely on structural compatibility and explicit boundary assertions, and we derive the internal types from `RestAgent` method parameters (e.g. `type InternalX = Parameters<RestAgent['...']>[0]`) to reduce drift.

## TSOA Compatibility for Generic Outputs

We sometimes cast Credo-TS return objects (which can include complex generic typing) to JSON-ish object types in utility helpers so that controller response DTOs stay simple and TSOA schema generation stays reliable.

* **Location:** `src/utils/credentials.ts` (`transformToCredentialFormatData`).
* **Reason:** The OpenAPI surface should not depend on deep external generic type graphs. Returning a JSON-ish shape keeps the generated schema stable.
* **Technique:** We use a helper function to perform a controlled cast (`obj as Record<string, unknown>`) after strictly typing the input from the agent.
* **Risk:** The compilation safety ensures we receive the correct type from Credo-TS, but the cast erases the deep structure validation for the return value. If we try to return a type that is `not` JSON-compatible (e.g. a class instance or Function), TSOA might fail at runtime during serialization.

## Loose W3C Context Definitions (Partially Open)

Some JSON-LD / W3C structures (especially `@context`) are hard to represent precisely in OpenAPI/TSOA without either:

* using a very loose type, or
* requiring OpenAPI 3.1 tuple features.

* **Observation:** The W3C JSON-LD `@context` field is semantically constrained (e.g. first entry is typically a URI string), but enforcing tuple constraints in the OpenAPI schema is not currently practical.
* **Current approach (v0.6.x):** We use Credo DIDComm JSON-LD credential format types at the API boundary where possible, and rely on Credo runtime behaviour for deep JSON-LD checks.
* **Current limitation:** Upstream JSON-LD type surfaces still model `@context` as a broad union (e.g. `Array<string> | JsonObject`), so type-level strictness remains limited.
* **Implemented now:** Added targeted runtime validation at controller boundaries for JSON-LD payload shape safety (object-shape guards, valid `@context` shape, valid `type` shape, and object checks for `credentialSubject` / `options`).
* **Intentional policy:** Validation is shape-based and not tied to a single VC context URI or a mandatory `VerifiableCredential` type, to avoid over-restricting valid JSON-LD credential profiles.
* **Test coverage expanded:** Added/extended negative unit tests for structural-invalid JSON-LD inputs across propose/create-offer/offer endpoints, including malformed `options`, malformed `@context` entries, malformed `type`, and invalid `credentialSubject` shapes.

### Suggested next actions

* Keep the reusable JSON-LD guard utility under `src/utils/credentials.ts` aligned with accepted profile rules as they evolve.
* Continue applying guard checks in credential controller entry points for propose/offer/create-request JSON-LD inputs.
* Keep explicit `400` validation errors for unsupported/invalid JSON-LD profile shapes, with unit tests asserting both the `400` response and that agent credential operations are not invoked on invalid input.
* Keep the format-data JSON-compatibility guard covered by negative tests (non-JSON-safe payload returns `500`) to protect TSOA serialization boundaries.

### Dual-format controller acceptance plan (AnonCreds + JSON-LD)

The credential controllers support dual format payloads and should continue to do so.

* **Validation model:** validate each format branch independently.
  * If `credentialFormats.anoncreds` is present, run AnonCreds-path validation.
  * If `credentialFormats.jsonld` is present, run JSON-LD profile validation.
  * If both are present, run both validators and merge field errors.
* **Where JSON-LD profile validation applies now:**
  * `POST /v1/credentials/propose-credential`
  * `POST /v1/credentials/create-offer`
  * `POST /v1/credentials/offer-credential`
* **Where full JSON-LD credential validation should NOT be forced:**
  * `POST /v1/credentials/:credentialRecordId/accept-proposal` (`jsonld` stage shape is empty by design)
  * `POST /v1/credentials/:credentialRecordId/accept-offer` (`jsonld` stage shape is empty by design)
  * `POST /v1/credentials/:credentialRecordId/accept-request` (JSON-LD stage uses accept-request options such as `verificationMethod`, not full credential body)
* **Outcome:** preserve backward compatibility for AnonCreds-only and mixed clients while tightening JSON-LD input quality where full JSON-LD credential payloads are supplied.
