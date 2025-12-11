# Explicit Credential Selection

When responding to a Proof Request, an agent may hold multiple credentials that satisfy the request's requirements (e.g., multiple credentials from the same issuer, or multiple credentials with the same attribute names). By default, the agent might select any valid credential, which can lead to incorrect data being shared if a specific credential was intended.

The **Explicit Credential Selection** feature allows a client (controller) to specify exactly which credential ID should be used for each requested attribute or predicate.

## The Problem

1. **Ambiguity**: If a user has two "Employee ID" credentials, the agent doesn't know which one to present.
2. **Complexity**: The underlying Credo-TS `acceptRequest` method requires a highly complex `proofFormats` object containing deep metadata (`schemaId`, `credDefId`, `revocationRegistryId`, raw values, etc.) to specify a credential. Constructing this object on the client side is difficult and error-prone.

## The Solution: Simplified Proof Formats

The `veritable-cloudagent` API supports a **Simplified Proof Format**. Clients can provide a lightweight object specifying only the `credentialId` and `revealed` status for each attribute. The agent's controller then "hydrates" this object by fetching the full credential details from the wallet before passing it to the core agent.

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
     * If attributes are missing in the simplified format, the API returns a `400 Bad Request`.
     * If no matching credentials are found to satisfy the request, the API returns a `404 Not Found`.

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
          }
        }
      }
    }
    ```

4. **Bob's Agent** looks up `credential-123`, retrieves its full metadata, and generates a proof using that specific credential.
