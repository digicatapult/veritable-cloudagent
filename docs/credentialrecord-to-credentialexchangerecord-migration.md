# Migration Guide: `credentialRecord` (v0.5.x) → `credentialExchangeRecord` (v0.6)

This guide explains how API/webhook/WebSocket consumers of veritable-cloudagent should migrate from the old v0.5.x credential event payload shape to the v0.6 contract.

## Breaking change summary

As of the Credo v0.6 migration in this project, credential state-change event payloads now expose:

- `payload.credentialExchangeRecord`

and no longer expose:

- `payload.credentialRecord`

No aliasing or compatibility shim is provided in the v0.6 contract.

---

## What changed

### Old (v0.5.x)

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

### New (v0.6)

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

---

## Consumer migration checklist

1. Update event payload readers:
   - Replace all reads of `payload.credentialRecord` with `payload.credentialExchangeRecord`.
2. Update DTOs/schemas:
   - Rename typed fields and JSON schema properties to `credentialExchangeRecord`.
3. Update runtime guards:
   - Validation logic should require `credentialExchangeRecord` and reject/ignore old shape.
4. Update analytics pipelines:
   - ETL mappings and dashboards that reference `credentialRecord.*` should be renamed.
5. Update contract tests:
   - Assertions should verify the new field name and absence of `credentialRecord`.

---

## Common code changes

### TypeScript

Before:

```ts
const record = event.payload.credentialRecord
handleCredential(record.id, record.state)
```

After:

```ts
const record = event.payload.credentialExchangeRecord
handleCredential(record.id, record.state)
```

### JSON schema (example)

Before:

```json
{
  "type": "object",
  "required": ["credentialRecord"],
  "properties": {
    "credentialRecord": { "type": "object" }
  }
}
```

After:

```json
{
  "type": "object",
  "required": ["credentialExchangeRecord"],
  "properties": {
    "credentialExchangeRecord": { "type": "object" }
  }
}
```

---

## Back-end integration impact

If your integration stores raw event payloads, you should treat this as a schema-version boundary:

- Existing stored v0.5.x events remain valid historical data.
- New v0.6 events should be ingested under the new field name.
- If you need cross-version queries, normalize in your analytics layer (e.g., map both to a virtual column), not in the runtime API contract.

---

## Recommended rollout plan

1. **Prepare consumer release** with dual-reader logic in your own application (optional transition step).
2. **Deploy consumer first** to production.
3. **Upgrade cloudagent to v0.6 branch**.
4. **Remove temporary dual-reader fallback** once all producers are on v0.6.

> Note: The cloudagent itself intentionally does not emit both keys in v0.6.

---

## Verification steps

After upgrading:

1. Trigger a credential flow that emits credential state changes.
2. Confirm received event payload includes `credentialExchangeRecord`.
3. Confirm payload does not include `credentialRecord`.
4. Confirm downstream processing (queues, DB writes, analytics, UI) remains green.

---

## Related docs

- `docs/credo-v0.6-migration-pex.md`
- `docs/openapi-credo-v0.5.x-type-alignment.md`
- `docs/credentials-and-proofs.md`
