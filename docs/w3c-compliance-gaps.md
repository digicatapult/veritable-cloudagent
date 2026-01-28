# W3C Compliance and Type Safety Gaps

This document tracks known issues and technical debt identified during PR #451 remediation. These items were deferred to avoid blocking the release but should be addressed in future refactoring.

## Unsafe Type Assertions

In several places, we use type assertions (`as InternalType`) to bridge between controller DTOs (TSOA/OpenAPI-facing) and the `RestAgent` method parameter types. This is risky because if the agent method parameter types change (e.g. in a Credo-TS upgrade), API inputs might no longer match what the agent expects, leading to runtime errors.

* **Locations:**
  * `src/controllers/v1/credentials/CredentialController.ts`: `offerCredential`, `proposeCredential`, `createOffer`, `acceptOffer` use `options as Internal...`.
  * `src/controllers/v1/proofs/ProofController.ts`:
    * `proposeProof` -> `InternalProposeProofOptions`
    * `acceptProposal` -> `InternalAcceptProofProposalOptions`
    * `createRequest` -> `InternalCreateProofRequestOptions`
    * `requestProof` -> `InternalRequestProofOptions`
    * `acceptRequest` -> `InternalAcceptProofRequestOptions`

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

## Loose W3C Context Definitions

Some JSON-LD / W3C structures (especially `@context`) are hard to represent precisely in OpenAPI/TSOA without either:

* using a very loose type, or
* requiring OpenAPI 3.1 tuple features.

* **Observation:** The W3C JSON-LD `@context` field is semantically constrained (e.g. first entry is typically a URI string), but enforcing tuple constraints in the OpenAPI schema is not currently practical.
* **Current approach:** We prefer re-exporting Credo’s JSON-LD credential format types from `@credo-ts/core` where possible, and rely on runtime behaviour in Credo for deeper validation.
* **Overcoming the gap:** If we want strict enforcement at the API boundary, add runtime validation (schema/type guards) for the specific JSON-LD structures we accept.

## Inconsistent Naming Conventions

* **`mimeType` naming**: Credential preview attributes use Credo’s `CredentialPreviewAttributeOptions`, which uses `mimeType`.
