# Credo v0.6 Clean Renaming Plan (DidComm Prefix Alignment)

## Status

- **Phase 1 (runtime rename): complete**
- **Phase 2 (tests/fixtures rename): complete**
- **Phase 3 (docs/migration notes): complete**

## Goal
Remove legacy/internal aliases (e.g. `DidCommProofState as ProofState`) and adopt explicit `DidComm*` naming directly across the codebase as a clean breaking change.

## Scope Count (current repo)

- **14 files** contain `DidComm* as <internal-name>` aliasing
- **53 alias import lines** total
- Breakdown:
  - **12 runtime files / 40 alias lines**
  - **2 test files / 13 alias lines**

### Files in scope

#### Runtime (12)
1. `src/controllers/examples.ts`
2. `src/controllers/v1/basic-messages/BasicMessageController.ts`
3. `src/controllers/v1/connections/ConnectionController.ts`
4. `src/controllers/v1/credentials/CredentialController.ts`
5. `src/controllers/v1/outofband/OutOfBandController.ts`
6. `src/controllers/v1/proofs/ProofController.ts`
7. `src/modules/verified-drpc/VerifiedDrpcApi.ts`
8. `src/modules/verified-drpc/handlers/VerifiedDrpcRequestHandler.ts`
9. `src/modules/verified-drpc/handlers/VerifiedDrpcResponseHandler.ts`
10. `src/modules/verified-drpc/services/VerifiedDrpcService.ts`
11. `src/utils/proofs.ts`
12. `src/utils/webhook.ts`

#### Tests (2)
1. `src/modules/verified-drpc/__tests__/VerifiedDrpcMessageService.test.ts`
2. `src/modules/verified-drpc/__tests__/fixtures/mockProofExchangeRecord.ts`

## Migration Approach

### Phase 1: Runtime-first rename (breaking)
For each runtime file:
1. Replace aliased imports with direct `DidComm*` imports.
2. Rename local type/value usages to the same `DidComm*` symbol names.
3. Preserve behavior; this is naming-only unless compiler indicates a real API drift.

Example:
- from: `import { DidCommProofState as ProofState } ...`
- to: `import { DidCommProofState } ...`
- then update all `ProofState` references to `DidCommProofState`.

### Phase 2: Tests and fixtures
1. Apply the same direct naming in test files.
2. Keep fixture semantics unchanged; rename only symbols.

### Phase 3: Docs and migration notes
1. Update migration notes to explicitly state we removed alias compatibility names in source.
2. Add a short contributor note: “Prefer direct `DidComm*` names; do not alias to legacy/internal names.”

## Validation Plan

1. `npm run lint`
2. `npm run check`
3. `npm run test:unit`
4. Optional confidence pass: `npm run test:integration` (if testnet is available)

## Acceptance Criteria

- Zero matches for alias pattern in source:
  - `DidComm[A-Za-z0-9_]+ as [A-Za-z0-9_]+`
- No runtime behavior changes expected beyond naming cleanup.
- All CI checks pass.

## Outcome (executed)

- Alias pattern in `src` (`DidComm[A-Za-z0-9_]+ as [A-Za-z0-9_]+`) is now **0 matches**.
- Runtime and test unit validation succeeded after rename execution:
  - `npm run check` passed
  - `npm run test:unit` passed

## Risks / Notes

- Some upstream Credo exports are inconsistently named (e.g., `TrustPingResponseReceivedEvent` without `DidComm` prefix). Those should remain as upstream-defined names unless we introduce a local wrapper type strategy.
- This is intentionally a **clean breaking style change** in code conventions, not a public API transport/payload contract change.
