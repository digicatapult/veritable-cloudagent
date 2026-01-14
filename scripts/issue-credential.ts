// This script issues a credential to maker(Bob) with (Charlie's)oem's did

// Offer a credential to maker
import { AutoAcceptCredential } from '@credo-ts/core'
import z from 'zod'
import type { OfferCredentialOptions } from '../src/controllers/types.js'

const connectionParser = z.array(
  z.object({
    id: z.string(),
    invitationDid: z.string(),
  })
)
interface ParsedArgs {
  credDefId?: string
  oemDid: string
  makerDid: string
  baseUrl: string
}
function printUsageAndExit(code: number): never {
  process.stderr.write(
    'Usage: issue-credential --oem <oemDid> --maker <makerDid> [--cred-def-id <credDefId>] [--base-url <url>]\n'
  )
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3000',
    oemDid: 'did:web:charlie%3A8443',
    makerDid: 'did:web:bob%3A8443',
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--oem' || a === '-o') {
      parsed.oemDid = args[++i]
      continue
    }
    if (a === '--maker' || a === '-m') {
      parsed.makerDid = args[++i]
      continue
    }
    if (a === '--cred-def-id' || a === '-c') {
      parsed.credDefId = args[++i]
      continue
    }
    if (a === '--base-url' || a === '-b') {
      parsed.baseUrl = args[++i]
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }

    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { credDefId: argsCredDefId, oemDid, makerDid, baseUrl } = parseArgs(process.argv)
  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  let credDefId = argsCredDefId

  if (!credDefId) {
    log(`Looking for credential definitions at ${baseUrl}...`)
    const credDefsResponse = await fetch(`${baseUrl}/v1/credential-definitions?createdLocally=true`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })

    if (!credDefsResponse.ok) {
      throw new Error(
        `Failed to retrieve credential definitions: ${credDefsResponse.status} ${credDefsResponse.statusText}`
      )
    }

    const credDefs = await credDefsResponse.json()

    if (!Array.isArray(credDefs) || credDefs.length === 0) {
      throw new Error('No credential definitions found on the agent.')
    }

    // Pick the most recent one (assuming the list is ordered or we just take the last one)
    const targetCredDef = credDefs[credDefs.length - 1]
    credDefId = targetCredDef.id
    log(`Found credential definition: ${credDefId}`)
  }

  if (!credDefId) {
    throw new Error('Could not determine credential definition ID')
  }

  // get connectionId for bob on alice
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

  // Offer a credential
  log('Offering credential to maker with oem_did', oemDid)
  const proposeCredRes = await fetch(`${baseUrl}/v1/credentials/offer-credential`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(offerCredentialBody),
  })

  if (!proposeCredRes.ok) {
    const text = await proposeCredRes.text()
    throw new Error(`Failed offering credential: ${proposeCredRes.status} ${text}`)
  }

  log('Credential offer sent to maker.')
  process.exit(0)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
