# Credentials and Proofs Guide

This agent supports a hybrid identity architecture, enabling the issuance and verification of credentials using two distinct formats:

1. **AnonCreds** (Anonymous Credentials): Advanced privacy features like Zero-Knowledge Proofs (ZKPs) and selective disclosure. Typically requires a ledger like Indy or Cheqd.
2. **W3C Credentials** (Verifiable Credentials): Flexible, interoperable, and widely supported standard using JSON-LD or JWT formats. Can be used with ledger-agnostic methods like `did:key` or `did:web`.

## Supported DID Methods

* **`did:key`**: Best for testing and development.
  * **Pros**: Ledger-agnostic, instant generation, no network dependency.
  * **Cons**: Ephemeral (unless stored), cannot be rotated.
  * **Usage**: Ideal for W3C credential flows during development.
* **`did:web`**: Best for organizational identity.
  * **Pros**: Resolves to a domain name (HTTPS), trusted by browsers/humans.
  * **Cons**: Requires a hosted web server and SSL certificate.
  * **Usage**: The default for production agents representing institutions.
* **`did:peer`**: Best for private communication.
  * **Usage**: Automatically used for establishing secure DIDComm channels between agents.

---

## W3C Credential Flow

W3C credentials in this service use JSON-LD format. Verification uses Presentation Exchange (PEX) with a v1-compatible profile enforced at the API boundary. JWT VC/VP is not supported at this time.

### 1. Issuance (W3C)

**Issuer** offering a credential to a holder.

* **Endpoint**: `POST /v1/credentials/offer-credential`
* **Payload Example**:

```json
{
  "protocolVersion": "v2",
  "connectionId": "<connection-uuid>",
  "credentialFormats": {
    "jsonld": {
      "credential": {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "http://schema.org/"
        ],
        "type": [
          "VerifiableCredential",
          "Person"
        ],
        "issuer": "did:key:z6Mkr...",
        "issuanceDate": "2024-01-01T00:00:00Z",
        "credentialSubject": {
          "id": "did:key:z6Mkv...",
          "givenName": "Alice",
          "familyName": "Doe"
        }
      },
      "options": {
        "proofType": "Ed25519Signature2018",
        "proofPurpose": "assertionMethod"
      }
    }
  }
}
```

### 2. Verification (W3C with Presentation Exchange)

**Verifier** requests a proof from a holder using a Presentation Definition.

* **Endpoint**: `POST /v1/proofs/request-proof`
* **Payload Example**:

```json
{
  "protocolVersion": "v2",
  "connectionId": "<connection-uuid>",
  "proofFormats": {
    "presentationExchange": {
      "presentationDefinition": {
        "id": "person-verification-request",
        "name": "Person Identity Request",
        "purpose": "We need to verify your identity",
        "input_descriptors": [
          {
            "id": "person_credential",
            "name": "Person Credential",
            "constraints": {
              "fields": [
                {
                  "path": ["$.credentialSubject.givenName"],
                  "filter": {
                    "type": "string",
                    "pattern": "Alice"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```

---

## AnonCreds Credential Flow

AnonCreds provide strong privacy guarantees. This flow requires registering Schemas and Credential Definitions in the configured registry (in this repo: IPFS-backed Veritable registry).

### Prerequisites

Before issuing, you must register a Schema and Credential Definition.
See `scripts/register-schema.ts` for examples of how to perform this setup.

### 1. Issuance (AnonCreds)

* **Endpoint**: `POST /v1/credentials/offer-credential`
* **Payload structure**:

```json
{
  "protocolVersion": "v2",
  "connectionId": "<connection-uuid>",
  "credentialFormats": {
    "anoncreds": {
      "credentialDefinitionId": "<cred-def-id>",
      "attributes": [
        { "name": "name", "value": "Alice" },
        { "name": "age", "value": "30" }
      ]
    }
  }
}
```

### 2. Verification (AnonCreds)

AnonCreds allows for requesting specific attributes or predicates (e.g., `age >= 18`) without revealing the actual value.

* **Endpoint**: `POST /v1/proofs/request-proof`
* **Payload Example**:

```json
{
  "protocolVersion": "v2",
  "connectionId": "<connection-uuid>",
  "proofFormats": {
    "anoncreds": {
      "name": "Proof Request",
      "version": "1.0",
      "requested_attributes": {
        "attr1_referent": {
          "name": "name",
          "restrictions": [{ "cred_def_id": "<cred-def-id>" }]
        }
      },
      "requested_predicates": {
        "predicate1_referent": {
          "name": "age",
          "p_type": ">=",
          "p_value": 18,
          "restrictions": [{ "cred_def_id": "<cred-def-id>" }]
        }
      }
    }
  }
}
```

---

## Comparison Reference

| Feature | AnonCreds | W3C Credentials |
| :--- | :--- | :--- |
| **Privacy** | High (Zero-Knowledge Proofs, Selective Disclosure) | Variable (Supports selective disclosure via BBS+, but standard signatures reveal full payloads) |
| **Interoperability** | High within Hyperledger/Indy ecosystems | High across broader web ecosystems (JSON-LD) |
| **Ledger Dependency** | Strong (Requires Schema/CredDef registry) | Low (Can use `did:key`, `did:web`) |
| **Proof Format** | Proprietary JSON format | Presentation Exchange (PEX) |
| **Signatures** | CL Signatures (Camenisch-Lysyanskaya) | Ed25519, standard JWT/JWS |

---

## Accepting Proof Requests (Holder)

When an agent receives a proof request, it must select which credentials to present to satisfy the request. The agent supports an advanced mechanism for explicitly selecting credentials when multiple options are available.

For detailed documentation on how to control creating proofs with specific credentials, see [Explicit Credential Selection](./explicit-credential-selection.md).

---

## Developer Notes: Type Safety & Internal Casts

In the controller layer (`src/controllers/`), we use the `satisfies` keyword at the DTO boundary to align API types with the agent's internal method parameter types, with a small number of explicit casts where needed (e.g., proof accept-request formats).

### Why is this necessary?

The codebase bridges two distinct type systems:

1. **Rest API Types (TSOA):** Defined in `src/controllers/types.ts`. These are "Plain Old JavaScript Objects" (POJOs) optimized for generating clean OpenAPI/Swagger documentation. They explicitly list fields for supported protocols (like `anoncreds` and `w3c` in `credentialFormats`).
2. **Internal Framework Types (Credo-TS):** Defined dynamically throughout `@credo-ts/core`. These types often rely on complex TypeScript generics to support extensible modules (e.g., `CredentialFormatPayload<CredentialFormats[], 'acceptOffer'>`).

While the API type and the internal type are structurally compatible (they hold the same data), the TypeScript compiler cannot easily verify that the explicit TSOA object satisfies the complex generic constraints of the extensible agent modules.

Using `satisfies` and explicit casts only where necessary acts as a verified bridge. It confirms to the compiler that the API input conforms to the internal module requirements without circumventing type safety (which using `as unknown` would do). This ensures we can support polymorphic endpoints—handling both AnonCreds and W3C formats simultaneously—while maintaining strict compilation checks.
