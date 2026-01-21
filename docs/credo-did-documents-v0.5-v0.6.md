
# Credo-TS DID Key Handling: v0.5.x vs v0.6.x

## Executive Summary

This document explains how Credo-TS versions 0.5.x and 0.6.x consume encryption and verification keys from DID Documents, how this differs between versions, and how each maps to canonical W3C DID Core semantics.

---

## 1. Canonical DID Core Key Model

A DID Document may define multiple **verification methods**, each referenced by one or more **relationships**:

- authentication
- assertionMethod
- keyAgreement
- capabilityInvocation
- capabilityDelegation

DID Core does **not** mandate cryptographic algorithms or curves; these are selected by consuming protocols.

---

## 2. Credo-TS v0.5.x Key Model

### 2.1 Supported Algorithms

#### v0.5.x Signing / Verification

- Ed25519 only

#### Encryption (DIDComm v1)

- X25519 only
- Often derived by converting Ed25519 keys

### 2.2 Expected DID Document Shape

Credo v0.5.x implicitly assumes:

- authentication → Ed25519
- assertionMethod → Ed25519
- keyAgreement → X25519 (explicit or derived)

Other key types (RSA, P-256, secp256k1, JWK-only keys) are typically ignored or rejected.

### 2.3 Example: v0.5-Compatible DID Document

```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:example:alice",
  "verificationMethod": [
    {
      "id": "#ed25519-1",
      "type": "Ed25519VerificationKey2018",
      "controller": "did:example:alice",
      "publicKeyBase58": "H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV"
    },
    {
      "id": "#x25519-1",
      "type": "X25519KeyAgreementKey2019", // Must be this for credo-ts 0.5.x
      "controller": "did:example:alice",
      "publicKeyBase58": "8h8m1yD3rNWf7oF4Y9t8a5y2u6j3oP6kL3r8X5n2w4g"
    }
  ],
  "authentication": ["#ed25519-1"],
  "assertionMethod": ["#ed25519-1"],
  "keyAgreement": ["#x25519-1"],
  "service": [
    {
      "id": "#did-communication",
      "type": "did-communication",
      "priority": 0,
      "recipientKeys": ["#ed25519-1"],
      "routingKeys": [],
      "serviceEndpoint": "https://example.com/endpoint"
    }
  ]
}
```

#### v0.5.x Notes

- Single Ed25519 key reused for authentication and signing
- X25519 key dedicated to DIDComm encryption
- Aries-style, implicit semantics
- For DIDComm v1, `recipientKeys` must resolve to an Ed25519 key (Credo will derive/convert to X25519 internally for encryption)
- In this DIDDoc form, that means `recipientKeys` should reference the Ed25519 verification method (e.g. `#ed25519-1` / `...#owner`), not the X25519 `keyAgreement` key

---

## 3. Credo-TS v0.6.x Key Model

### 3.1 Supported Algorithms

#### v0.6.x Signing / Verification

- Ed25519
- ECDSA (P-256, secp256k1)
- JWK-based signing keys

#### Encryption

- X25519
- P-256 (ECDH-ES)
- JWK-based ECDH keys

### 3.2 Relationship Fidelity

Credo v0.6.x strictly respects DID Core relationships:

- authentication → DID authentication
- assertionMethod → credential / JWT signing
- keyAgreement → message encryption
- capabilityInvocation → agent control

Keys are selected by **relationship + algorithm compatibility**, not inferred.

### 3.3 Example: v0.6-Canonical DID Document

```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:web:example.com",
  "verificationMethod": [
    {
      "id": "#auth-key",
      "type": "JsonWebKey2020",
      "controller": "did:web:example.com",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      }
    },
    {
      "id": "#assertion-key",
      "type": "JsonWebKey2020",
      "controller": "did:web:example.com",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "secp256k1",
        "x": "...",
        "y": "..."
      }
    },
    {
      "id": "#agreement-key",
      "type": "JsonWebKey2020",
      "controller": "did:web:example.com",
      "publicKeyJwk": {
        "kty": "EC",
        "crv": "P-256",
        "x": "...",
        "y": "..."
      }
    }
  ],
  "authentication": ["#auth-key"],
  "assertionMethod": ["#assertion-key"],
  "keyAgreement": ["#agreement-key"],
  "capabilityInvocation": ["#auth-key"]
}
```

#### v0.6.x Notes

- Explicit separation of concerns
- JWK-native keys for OpenID4VC and JWT-based flows
- No key conversion or implicit reuse

---

## 4. Side-by-Side Comparison

| Aspect | v0.5.x | v0.6.x |
| ------ | -------- | -------- |
| DIDComm | v1-centric | v1 + v2-ready |
| Encryption keys | X25519 only | X25519, P-256, JWK |
| Signing keys | Ed25519 only | Ed25519, ECDSA, JWK |
| Key inference | Implicit | Explicit |
| Relationship fidelity | Loose | Strict |
| Algorithm agility | No | Yes |

---

## 5. Canonical vs Credo Enforcement

### DID Core allows

- Any key type
- Multiple algorithms
- Independent signing & encryption keys

### Credo v0.5.x enforces

- Aries-style constraints
- Ed25519 dominance
- Key conversion assumptions

### Credo v0.6.x enforces

- Explicit relationships
- Algorithm compatibility
- Standards-aligned usage

---

## 6. Practical Guidance

- DIDComm-only agents → v0.5.x acceptable
- OpenID4VC + DIDComm → v0.6.x required
- did:web / did:jwk → v0.6.x strongly recommended
- Enterprise PKI → v0.6.x only

---

## 7. Core Takeaway

Credo-TS v0.5.x treats the DID Document as a **key container**.  
Credo-TS v0.6.x treats it as a **cryptographic contract**.
