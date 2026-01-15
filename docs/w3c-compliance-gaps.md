# W3C Compliance and Type Safety Gaps

This document tracks known issues and technical debt identified during PR #451 remediation. These items were deferred to avoid blocking the release but should be addressed in future refactoring.

## Unsafe Type Assertions

In several places, we use type assertions (`as InternalType`) to bypass strict type checking between our API types and Credo-TS internal types. This is risky because if the internal types change (e.g. in a Credo-TS upgrade), our API inputs might no longer match what the agent expects, leading to runtime errors.

* **Locations:**
  * `src/controllers/v1/credentials/CredentialController.ts`: `offerCredential`, `proposeCredential`, `createOffer`, `acceptOffer` use `options as Internal...`.
  * `src/controllers/v1/proofs/ProofController.ts`:
    * `proposeProof` -> `InternalProposeProofOptions`
    * `acceptProposal` -> `InternalAcceptProofProposalOptions`
    * `createRequest` -> `InternalCreateProofRequestOptions`
    * `requestProof` -> `InternalRequestProofOptions`
    * `acceptRequest` -> `InternalAcceptProofRequestOptions`

* **Remediation:** Implement Zod schemas or dedicated type guard functions that validate the structure at runtime before casting, or valid mappings.
* **Resolution:** We have decided to rely on structural type compatibility. The local types defined in `src/controllers/types.ts` are designed to mirror the Credo-TS internal types (although they are slightly looser, e.g. allowing `null`). We use direct type assertions (e.g. `options as InternalOptions`) to map these types.

## Loose W3C Context Definitions

While we have tightened `W3cCredential` to require a tuple for `@context`, other parts of the system might still use looser definitions.

* **Observation:** Credo-TS internals often use `string | string[] | ...` for context, while W3C spec (and our new type) enforces `[string, ...string[]]`. We rely on the loose typing of `ApiJsonObject` (allowing undefined) in some places.
* **TSOA Limitation:** We attempted to define strict `JsonLdContext = [string, ...(string | GenericRecord)[]]`, but TSOA generation failed with `Unknown type: TupleType`. We reverted to `(string | GenericRecord)[]` with a comment.
* **Future Fix:** TSOA v7.0 (currently in alpha) adds OpenAPI 3.1 support, which uses `prefixItems` to validate variadic tuples. Upgrading to TSOA v7 in the future will allow us to restore the strict tuple definition.

## Inconsistent Naming Conventions

* **`mime-type` vs `mimeType`**: We use `mime-type` in `CredentialAttribute` to match Credo-TS internals / Aries RFCs, but this violates standard camelCase conventions for JSON APIs in some styles.
