// This script issues a credential to maker(Bob) with (Charlie's) oem's did

// Get credential definiton and schema
// Propose a credential to maker
import { AutoAcceptCredential } from '@credo-ts/core'
import z from 'zod'
import type { OfferCredentialOptions } from '../src/controllers/types.js'

const schemaParser = z.array(
  z.object({
    id: z.string(),
    issuerId: z.string(),
    name: z.string(),
    version: z.string(),
    attrNames: z.array(z.string()),
  })
)
const credentialParser = z.array(
  z.object({
    id: z.string(),
    schemaId: z.string(),
    tag: z.string(),
    issuerId: z.string(),
  })
)
const connectionParser = z.array(
  z.object({
    id: z.string(),
    invitationDid: z.string(),
  })
)

async function getschemaAndCredentialDefinition(
  baseUrl: string,
  issuerId: string,
  log: (msg: string, extra?: unknown) => void
) {
  try {
    log('Fetching schemas from', `${baseUrl}/v1/schemas`)
    const res = await fetch(`${baseUrl}/v1/schemas?createdLocally=true`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch schemas: ${res.status} ${res.statusText}`)
    }

    const jsonRes = await res.json()
    const parsedSchema = schemaParser.parse(jsonRes)

    if (parsedSchema.length === 0) {
      throw new Error('No schemas found')
    }

    const schemaId = parsedSchema[0].id
    log(`${schemaId} schemas found`)

    // Get credential definition for schema
    log(`Fetching credential definitions for schema ${schemaId}`)
    const credDef = await fetch(`${baseUrl}/v1/credential-definitions?createdLocally=true&schemaId=${schemaId}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })

    if (!credDef.ok) {
      throw new Error(`Failed to fetch credential definitions: ${credDef.status} ${credDef.statusText}`)
    }

    const credDefRes = await credDef.json()
    const parsedCredDef = credentialParser.parse(credDefRes)

    if (parsedCredDef.length === 0) {
      throw new Error(`No credential definitions found for schema ${schemaId}`)
    }

    log(`credDef ${parsedCredDef[0].id} found for schema ${schemaId}`)
    return { parsedSchema: parsedSchema[0], credDefId: parsedCredDef[0].id }
  } catch (error) {
    log('Error during credential setup:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function main() {
  const log = (msg: string, extra?: unknown) => {
    // use stderr so that any stdout piping (e.g. capturing id) is clean
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }
  // we are alice atm and are connected to both bob and charlie
  const oemDid = 'did:web:charlie%3A8443'
  const makerDid = 'did:web:bob%3A8443'
  const modDid = 'did:web:alice%3A8443'
  const baseUrl = 'http://localhost:3000'

  const { parsedSchema, credDefId } = await getschemaAndCredentialDefinition(baseUrl, oemDid, log)
  // get connectionId for bob
  const connections = await fetch(`${baseUrl}/v1/connections`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  })
  if (!connections.ok) {
    const text = await connections.text()
    throw new Error(`Failed getting connections: ${connections.status} ${text}`)
  }
  const connectionsJson = await connections.json()
  const parsedConnections = connectionParser.parse(connectionsJson)
  log(`Found ${parsedConnections.length} connections`)
  log('Looking for maker connection based on invitation DID', makerDid)

  const makerConnection = parsedConnections.find((c) => c.invitationDid === makerDid)
  if (!makerConnection) {
    throw new Error(`No connection found for maker DID ${makerDid}`)
  }
  const connectionId = makerConnection.id
  log('Found connection for maker', connectionId)

  // propose credential for someone we already have a connection with
  const offerCredentialBody: OfferCredentialOptions = {
    connectionId: connectionId,
    protocolVersion: 'v2',
    autoAcceptCredential: AutoAcceptCredential.Always,
    credentialFormats: {
      anoncreds: {
        credentialDefinitionId: credDefId,

        attributes: [
          {
            name: 'request_id',
            value: 'REQ-2025-001',
          },
          {
            name: 'requested_part_number',
            value: 'P-12345-ABC',
          },
          {
            name: 'requested_part_name',
            value: 'Engine Control Unit',
          },
          {
            name: 'requester_unit',
            value: 'Manufacturing Division',
          },
          {
            name: 'requester_contact_name',
            value: 'John Smith',
          },
          {
            name: 'requester_contact_email',
            value: 'john.smith@example.com',
          },
          {
            name: 'authorising_body',
            value: 'Quality Assurance Department',
          },
          {
            name: 'authorisation_scope',
            value: 'Manufacturing and Testing',
          },
          {
            name: 'authorisation_issue_date',
            value: '2025-10-09',
          },
          {
            name: 'authorisation_expiry_date',
            value: '2026-10-09',
          },
          {
            name: 'security_classification',
            value: 'Internal Use Only',
          },
          {
            name: 'export_control_classification',
            value: 'EAR99',
          },
          {
            name: 'tdp_reference',
            value: 'TDP-2025-ECU-001',
          },
          {
            name: 'tdp_version',
            value: '1.0',
          },
          {
            name: 'tdp_format',
            value: 'PDF',
          },
          {
            name: 'permitted_use',
            value: 'Manufacturing and Quality Testing',
          },
          {
            name: 'caveats',
            value: 'Not for reverse engineering',
          },
          {
            name: 'revocation_reference',
            value: 'REV-2025-001',
          },
          {
            name: 'oem_did',
            value: oemDid,
          },
        ],
      },
    },
  }

  //propose a credential

  log('Proposing credential to maker with oem_did', oemDid)
  const proposeCredRes = await fetch(`${baseUrl}/v1/credentials/offer-credential`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(offerCredentialBody),
  })

  if (!proposeCredRes.ok) {
    const text = await proposeCredRes.text()
    throw new Error(`Failed proposing credential: ${proposeCredRes.status} ${text}`)
  }

  log('Credential offer sent to maker. Awaiting acceptance...')
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
