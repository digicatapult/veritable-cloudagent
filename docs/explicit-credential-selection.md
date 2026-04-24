# Explicit Credential Selection

> **Note**: For a general overview of supported credential formats (AnonCreds vs W3C) and basic flows, please refer to the [Credentials and Proofs Guide](./credentials-and-proofs.md).

When responding to a Proof Request, an agent may hold multiple credentials that satisfy the request's requirements (e.g., multiple credentials from the same issuer, or multiple credentials with the same attribute names). By default, the agent might select any valid credential, which can lead to incorrect data being shared if a specific credential was intended.

The **Explicit Credential Selection** feature allows a client (controller) to specify exactly which credential ID should be used for each requested attribute or predicate.

## The Problem

1. **Ambiguity**: If a user has two "Employee ID" credentials, the agent doesn't know which one to present.
2. **Complexity**: The underlying Credo-TS `acceptRequest` method requires a highly complex `proofFormats` object containing deep metadata (`schemaId`, `credDefId`, `revocationRegistryId`, raw values, etc.) to specify a credential. Constructing this object on the client side is difficult and error-prone.

## The Solution: Simplified Proof Formats

The `veritable-cloudagent` API supports a **Simplified Proof Format**. Clients can provide a lightweight object specifying only the `credentialId` and `revealed` status for each attribute. The agent's controller then "hydrates" this object by fetching the full credential details from the wallet before passing it to the core agent.

Note: the simplified selection payload applies to AnonCreds proof formats only. PEX/W3C credential selection remains pass-through at this API boundary.

### API Usage

**Endpoint**: `POST /v1/proofs/{proofRecordId}/accept-request`

**Body**:

```json
{
  "autoAcceptProof": "contentApproved",
  "proofFormats": {
    "anoncreds": {
      "attributes": {
        "attribute_name_1": {
          "credentialId": "credential-uuid-1",
          "revealed": true
        },
        "attribute_name_2": {
          "credentialId": "credential-uuid-1",
          "revealed": true
        }
      },
      "predicates": {
        "predicate_name_1": {
          "credentialId": "credential-uuid-2"
        }
      }
    }
  }
}
```

### How it Works

The `ProofController` employs a three-path logic flow to handle proof acceptance:

1. **Auto-Selection (No `proofFormats` provided)**
   * If the client omits `proofFormats`, the agent automatically selects the best available credentials that satisfy the request.
   * This is useful for simple use cases where ambiguity is not a concern.

2. **Hydration (Simplified `proofFormats` provided)**
   * The controller detects the simplified format (missing `credentialInfo`).
   * It queries the agent for all valid credentials for this proof request.
   * It matches the `credentialId` provided by the client with the available credentials.
   * It populates the required `credentialInfo` (Schema ID, Cred Def ID, etc.) into the request object.
   * **Validation**:
     * If the requested credential cannot be used due to reveal mismatch, the API returns `400 Bad Request`.
     * If no matching credentials are found for the requested attributes/predicates, the API returns `404 Not Found`.

3. **Pass-Through (Full `proofFormats` provided)**
   * If the client provides the full, complex Credo-TS proof format, the controller passes it directly to the agent.
   * This supports advanced use cases where the client needs full control over the cryptographic metadata.

### Example Scenario

**Scenario**: A Manufacturer (Bob) needs to prove the `tdp_reference` of a specific product to an OEM (Charlie). Bob has multiple credentials for different products.

1. **Charlie** sends a Proof Request for `tdp_reference`.
2. **Bob's Client** inspects the request and identifies that `credential-123` contains the correct TDP reference.
3. **Bob's Client** calls `accept-request` with:

    ```json
    {
      "proofFormats": {
        "anoncreds": {
          "attributes": {
            "tdp_reference": {
              "credentialId": "credential-123",
              "revealed": true
            }
          },
          "predicates": {}
        }
      }
    }
    ```

4. **Bob's Agent** looks up `credential-123`, retrieves its full metadata, and generates a proof using that specific credential.

## Retrieving Proof Context

To construct the `accept-request` body, the client often needs to know what attributes are being requested and what credentials are available.

### 1. Get Proof Record with Content

To avoid making multiple calls, you can fetch the proof record along with its content (request and presentation data) in a single request.

**Endpoint**: `GET /v1/proofs/{proofRecordId}?includeContent=true`

**Response**:
Returns the `ProofExchangeRecord` with an additional `content` property containing the raw proof format data.

### 2. Get Matching Credentials

Before accepting a proof request, you may want to know which credentials in your wallet satisfy the request requirements.

**Endpoint**: `GET /v1/proofs/{proofRecordId}/credentials`

**Response**:
Returns a `MatchingCredentialsResponse` containing the proof formats with matching credentials from the wallet.

```json
{
  "proofFormats": {
    "anoncreds": {
      "attributes": {
        "attribute_referent_1": [
          {
            "credentialId": "credential-id-1",
            "revealed": true,
             "credentialInfo": { ... }
          }
        ]
      },
      "predicates": { ... }
    }
  }
}
```

### 3. Get Simplified Proof Content

The raw proof content can be complex to parse. You can request a simplified view that flattens the structure into simple key-value pairs.

**Endpoint**: `GET /v1/proofs/{proofRecordId}/content?view=simplified`

**Response**:

```json
{
  "attribute_name_1": "value_1",
  "attribute_name_2": "value_2"
}
```

This is particularly useful for displaying the values of a received proof (Verifier role) or understanding what is being requested (Prover role) without navigating the deep AnonCreds structure.

## Developer Experience

While the simplified format is much cleaner than the raw format, constructing the nested JSON object can still be verbose. It is recommended to use a helper function in your client application to generate this structure.

### Client-Side Helper Example (TypeScript)

> **Important**: The `credentialId` used in the selection payload must be the **Wallet Credential ID** (the ID of the credential stored in the wallet), NOT the **Credential Exchange Record ID** (the ID of the record tracking the issuance process).
>
> In Credo-TS, you can access this via `credentialRecord.credentials[0].credentialRecordId`.

```typescript
/**
 * Helper to construct the simplified proof format payload.
 * 
 * @param selections A map where the key is the attribute name and the value is the credential ID to use.
 * @returns The formatted payload ready for the API.
 */
function createSelection(selections: Record<string, string>) {
  const attributes: Record<string, { credentialId: string; revealed: boolean }> = {};
  
  for (const [key, credId] of Object.entries(selections)) {
    attributes[key] = { credentialId: credId, revealed: true };
  }

  return {
    proofFormats: {
      anoncreds: {
        attributes
      }
    }
  };
}

// Usage Example:
// 1. User selects specific credentials for the requested attributes
const userSelections = {
  'name': 'credential-uuid-123',
  'email': 'credential-uuid-456'
};

// 2. Generate the payload
const payload = createSelection(userSelections);

// 3. Send to API
await client.acceptProofRequest(proofRecordId, payload);
```
