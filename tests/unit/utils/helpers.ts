import type { AnonCredsCredentialDefinition, AnonCredsSchema } from '@credo-ts/anoncreds'
import type { Socket } from 'node:net'

import {
  type ConnectionRecordProps,
  type DidCreateResult,
  AgentMessage,
  ConnectionInvitationMessage,
  ConnectionRecord,
  CredentialExchangeRecord,
  DidDocument,
  DidExchangeRole,
  DidExchangeState,
  JsonTransformer,
  OutOfBandInvitation,
  OutOfBandRecord,
  ProofExchangeRecord,
  TrustPingMessage,
} from '@credo-ts/core'
import { JsonEncoder } from '@credo-ts/core/build/utils/JsonEncoder.js'
import { randomUUID } from 'crypto'
import { container } from 'tsyringe'
import { WebSocket } from 'ws'

import { RestAgent, setupAgent } from '../../../src/agent.js'
import { setupServer } from '../../../src/server.js'
import PinoLogger from '../../../src/utils/logger.js'

export async function getTestAgent(name: string, port: number) {
  const logger = new PinoLogger('silent')
  container.register(PinoLogger, { useValue: logger })
  return await setupAgent({
    agentConfig: {
      // add some randomness to ensure test isolation
      label: `${name} (${randomUUID()})`,
      endpoints: [`http://localhost:${port}`],
      walletConfig: { id: randomUUID(), key: name },
      useDidSovPrefixWhereAllowed: true,
      logger,
      autoUpdateStorageOnStartup: true,
      backupBeforeStorageUpdate: false,
    },

    inboundTransports: [
      {
        transport: 'http',
        port: port,
      },
    ],
    outboundTransports: ['http'],

    logger,
    ipfsOrigin: 'https://localhost:5001',
    verifiedDrpcOptions: { proofRequestOptions: { protocolVersion: 'v2', proofFormats: {} } },
  })
}

export async function getTestServer(agent: RestAgent) {
  const socketServer = new WebSocket.Server({ noServer: true })
  const app = await setupServer(agent, new PinoLogger('silent'), {
    socketServer,
  })
  const server = app.listen(0, () => {})

  server.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket as Socket, head, () => {
      // incoming messages aren't expected so ignore
      return
    })
  })

  return server
}

export function objectToJson<T>(result: T) {
  const serialized = JsonTransformer.serialize(result)
  return JsonEncoder.fromString(serialized)
}

export function getTestDidRecord() {
  const json = {
    didDocument: {
      '@context': [
        'https://w3id.org/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
        'https://w3id.org/security/suites/x25519-2019/v1',
      ],
      id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      alsoKnownAs: undefined,
      controller: undefined,
      verificationMethod: [
        {
          id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
          type: 'Ed25519VerificationKey2018',
          controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
          publicKeyBase58: '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx',
        },
      ],
      authentication: [
        'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      ],
      assertionMethod: [
        'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      ],
      capabilityInvocation: [
        'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      ],
      capabilityDelegation: [
        'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
      ],
      keyAgreement: [
        {
          id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6LSrdqo4M24WRDJj1h2hXxgtDTyzjjKCiyapYVgrhwZAySn',
          type: 'X25519KeyAgreementKey2019',
          controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
          publicKeyBase58: 'FxfdY3DCQxVZddKGAtSjZdFW9bCCW7oRwZn1NFJ2Tbg2',
        },
      ],
      service: undefined,
    },
    didDocumentMetadata: {},
    didResolutionMetadata: {
      contentType: 'application/did+ld+json',
    },
  }

  return json
}

export function getTestOutOfBandInvitation() {
  const json = {
    '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
    '@id': 'd6472943-e5d0-4d95-8b48-790ed5a41931',
    label: 'Aries Test Agent',

    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    handshake_protocols: ['https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x'],
    services: [
      {
        id: '#inline-0',
        serviceEndpoint: 'https://6b77-89-20-162-146.ngrok.io',
        type: 'did-communication',
        recipientKeys: ['did:key:z6MkmTBHTWrvLPN8pBmUj7Ye5ww9GiacXCYMNVvpScSpf1DM'],
        routingKeys: [],
      },
    ],
  }
  return JsonTransformer.fromJSON(json, OutOfBandInvitation)
}

export function getTestOutOfBandLegacyInvitation() {
  const json = {
    id: '42a95528-0e30-4f86-a462-0efb02178b53',
    label: 'Aries Test Agent',
    did: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    recipientKeys: ['did:key:z6MkmTBHTWrvLPN8pBmUj7Ye5ww9GiacXCYMNVvpScSpf1DM'],
    serviceEndpoint: 'https://6b77-89-20-162-146.ngrok.io',
    routingKeys: [],
    imageUrl: 'https://example.com/image-url',
  }
  return JsonTransformer.fromJSON(json, ConnectionInvitationMessage)
}

export function getTestOutOfBandRecord() {
  const json = {
    _tags: {
      invitationId: '1cbd22e4-1906-41e9-8807-83d84437f978',
      state: 'await-response',
      role: 'sender',
      recipientKeyFingerprints: ['z6MktUCPZjfRJXD4GMcYuXiqX2qZ8vBw6UAYpDFiHEUfwuLj'],
    },
    metadata: {},
    id: '42a95528-0e30-4f86-a462-0efb02178b53',
    createdAt: new Date('2022-01-01T00:00:00.000Z'),
    outOfBandInvitation: {
      '@type': 'https://didcomm.org/out-of-band/1.1/invitation',
      '@id': 'd6472943-e5d0-4d95-8b48-790ed5a41931',
      label: 'Aries Test Agent',
      accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
      handshake_protocols: ['https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x'],
      services: [
        {
          id: '#inline-0',
          serviceEndpoint: 'https://6b77-89-20-162-146.ngrok.io',
          type: 'did-communication',
          recipientKeys: ['did:key:z6MkmTBHTWrvLPN8pBmUj7Ye5ww9GiacXCYMNVvpScSpf1DM'],
          routingKeys: [],
        },
      ],
    },
    role: 'sender',
    state: 'await-response',
    reusable: false,
  }
  return JsonTransformer.fromJSON(json, OutOfBandRecord)
}

export function getTestCredential() {
  const json = {
    _tags: {
      connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
      state: 'proposal-sent',
      threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
    },
    type: 'CredentialRecord',
    id: '222222aa-aa22-42a2-aa22-222a2aa22222',
    createdAt: '2021-01-01T00:00:00.000Z',
    state: 'proposal-sent',
    connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
    metadata: {
      credentialDefinitionId: 'AAAAAAAAAAAAAAAAAAAAA:3:CL:3210:test',
      schemaId: 'AAAAAAAAAAAAAAAAAAAAA:2:string:1.0',
    },
    threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
    offerMessage: {
      type: 'https://didcomm.org/issue-credential/1.0/offer-credential',
      id: '333333aa-aa33-43a3-aa33-333a3aa33333',
      comment: 'string',
      credentialPreview: {
        type: 'https://didcomm.org/issue-credential/1.0/credential-preview',
        attributes: [
          {
            mimeType: 'text/plain',
            name: 'name',
            value: 'test',
          },
        ],
      },
      offerAttachments: [
        {
          id: 'cred-offer-0',
          mimeType: 'application/json',
          data: {
            base64: 'string',
          },
        },
      ],
    },
    credentialAttributes: [
      {
        mimeType: 'text/plain',
        name: 'name',
        value: 'test',
      },
    ],
  }

  return JsonTransformer.fromJSON(json, CredentialExchangeRecord)
}

export function getCredentialFormatData() {
  return {
    proposalAttributes: [
      {
        'mime-type': 'text/plain',
        name: 'attr1',
        value: 'value',
      },
    ],
    offerAttributes: [
      {
        'mime-type': 'text/plain',
        name: 'attr1',
        value: 'value',
      },
    ],
    proposal: {
      anoncreds: {
        schema_id: '351936',
        cred_def_id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
      },
    },
    offer: {
      anoncreds: {
        schema_id: '351936',
        cred_def_id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        key_correctness_proof: {},
        nonce: '333868740182662939520186',
      },
    },
    request: {
      anoncreds: {
        cred_def_id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        blinded_ms: {},
        blinded_ms_correctness_proof: {},
        nonce: '86778542088265913483731',
      },
    },
    credential: {
      anoncreds: {
        schema_id: '351936',
        cred_def_id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
        values: {
          val: {
            raw: 'value',
            encoded: '19970150736239713706088444570146546354146685096673408908105596072151101138862',
          },
        },
        signature: {
          p_credential: {},
        },
        signature_correctness_proof: {},
      },
    },
  }
}

export function getTestOffer() {
  const json = {
    message: {
      type: 'https://didcomm.org/issue-credential/1.0/offer-credential',
      id: '333333aa-aa33-43a3-aa33-333a3aa33333',
      comment: 'string',
      credentialPreview: {
        type: 'https://didcomm.org/issue-credential/1.0/credential-preview',
        attributes: [
          {
            mimeType: 'text/plain',
            name: 'name',
            value: 'test',
          },
        ],
      },
      offerAttachments: [
        {
          id: 'cred-offer-0',
          mimeType: 'application/json',
          data: {
            base64: 'string',
          },
        },
      ],
    },
    credentialRecord: {
      _tags: {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        state: 'proposal-sent',
        threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
      },
      type: 'CredentialRecord',
      id: '222222aa-aa22-42a2-aa22-222a2aa22222',
      createdAt: '2021-01-01T00:00:00.000Z',
      state: 'proposal-sent',
      connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
      metadata: {
        credentialDefinitionId: 'AAAAAAAAAAAAAAAAAAAAA:3:CL:3210:test',
        schemaId: 'AAAAAAAAAAAAAAAAAAAAA:2:string:1.0',
      },
      threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
      offerMessage: {
        type: 'https://didcomm.org/issue-credential/1.0/offer-credential',
        id: '333333aa-aa33-43a3-aa33-333a3aa33333',
        comment: 'string',
        credentialPreview: {
          type: 'https://didcomm.org/issue-credential/1.0/credential-preview',
          attributes: [
            {
              mimeType: 'text/plain',
              name: 'name',
              value: 'test',
            },
          ],
        },
        offerAttachments: [
          {
            id: 'cred-offer-0',
            mimeType: 'application/json',
            data: {
              base64: 'string',
            },
          },
        ],
      },
      credentialAttributes: [
        {
          mimeType: 'text/plain',
          name: 'name',
          value: 'test',
        },
      ],
    },
  }

  return {
    message: JsonTransformer.fromJSON(json.message, AgentMessage),
    credentialRecord: JsonTransformer.fromJSON(json.credentialRecord, CredentialExchangeRecord),
  }
}

export function getTestSchema(): AnonCredsSchema {
  return {
    issuerId: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    name: 'test',
    version: '1.0',
    attrNames: ['prop1', 'prop2'],
  }
}

export function getTestCredDef(): AnonCredsCredentialDefinition {
  return {
    issuerId: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    schemaId: '9999',
    type: 'CL',
    tag: 'latest',
    value: {
      primary: {
        n: 'x',
        s: 'x',
        r: {
          master_secret: 'x',
          name: 'x',
          title: 'x',
        },
        rctxt: 'x',
        z: 'x',
      },
    },
  }
}

export function getTestProofResponse() {
  const json = {
    _tags: {
      connectionId: '4b70e399-d0d3-42c9-b511-dc0b972e362d',
      state: 'done',
      threadId: '9b5fce7c-e0d2-4b72-a3f8-20d0934c11c7',
    },
    metadata: {},
    id: '222222aa-aa22-42a2-aa22-222a2aa22222',
    createdAt: '2023-12-11T18:19:46.771Z',
    protocolVersion: 'v2',
    state: 'done',
    connectionId: '4b70e399-d0d3-42c9-b511-dc0b972e362d',
    threadId: '9b5fce7c-e0d2-4b72-a3f8-20d0934c11c7',
    autoAcceptProof: 'always',
    updatedAt: '2023-12-11T18:20:14.128Z',
    isVerified: true,
  }

  return JsonTransformer.fromJSON(json, ProofExchangeRecord)
}

export function getTestProof() {
  const json = {
    _tags: {
      connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
      threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
      state: 'string',
    },
    type: 'ProofRecord',
    id: '222222aa-aa22-42a2-aa22-222a2aa22222',
    createdAt: '2021-01-01T00:00:00.000Z',
    requestMessage: {
      type: 'https://didcomm.org/present-proof/1.0/request-presentation',
      id: '333333aa-aa33-43a3-aa33-333a3aa33333',
      comment: 'string',
      requestPresentationAttachments: [
        {
          id: 'bbbbbbbb-bb11-41b1-bb11-111b1bb11111',
          mimeType: 'application/json',
          data: {
            base64: 'string',
          },
        },
      ],
    },
    state: 'string',
    connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
    threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
    isVerified: true,
    presentationMessage: {
      type: 'https://didcomm.org/present-proof/1.0/presentation',
      presentationAttachments: [
        {
          id: 'cccccccc-cc11-41c1-ac11-111c1cc11111',
          mimeType: 'application/json',
          data: {
            base64: 'string',
          },
        },
      ],
      id: '444444aa-aa44-44a4-aa44-444a4aa44444',
      thread: {
        threadId: '111111aa-aa11-41a1-aa11-111a1aa11111',
        senderOrder: 0,
        receivedOrders: {},
      },
    },
  }
  return JsonTransformer.fromJSON(json, ProofExchangeRecord)
}

export function getTestTrustPingMessage({
  id = '00000000-1111-4c47-8a5a-111111111111',
  comment = 'test-comment',
  responseRequested = true,
}: Partial<TrustPingMessage> = {}) {
  return new TrustPingMessage({ id, comment, responseRequested })
}

export function getTestConnection({
  state = DidExchangeState.InvitationReceived,
  role = DidExchangeRole.Requester,
  id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  did = 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMu00000000',
  threadId = '33333333-3333-4c47-8a5a-333333333333',
  invitationDid = 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMu11111111',
  tags = {},
  theirLabel,
  theirDid = 'did:key:z6MkmTBHTWrvLPN8pBmUj7Ye5ww9GiacXCYMNVvpScSpf1DM',
}: Partial<ConnectionRecordProps> = {}) {
  return new ConnectionRecord({
    did,
    invitationDid,
    threadId,
    theirDid,
    id,
    role,
    state,
    tags,
    theirLabel,
  })
}

export function getTestDidDocument() {
  return {
    '@context': [
      'https://w3id.org/did/v1',
      'https://w3id.org/security/suites/ed25519-2018/v1',
      'https://w3id.org/security/suites/x25519-2019/v1',
    ],
    id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    verificationMethod: [
      {
        id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        publicKeyBase58: '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx',
      },
    ],
    authentication: [
      'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    ],
    assertionMethod: [
      'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    ],
    keyAgreement: [
      {
        id: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6LSrdqo4M24WRDJj1h2hXxgtDTyzjjKCiyapYVgrhwZAySn',
        type: 'X25519KeyAgreementKey2019',
        controller: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
        publicKeyBase58: 'FxfdY3DCQxVZddKGAtSjZdFW9bCCW7oRwZn1NFJ2Tbg2',
      },
    ],
    capabilityInvocation: [
      'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    ],
    capabilityDelegation: [
      'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL#z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
    ],
  } as { [x: string]: unknown }
}

export function getTestDidCreate() {
  return {
    didDocumentMetadata: {},
    didRegistrationMetadata: {},
    didState: {
      state: 'finished',
      did: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
      didDocument: JsonTransformer.fromJSON(
        {
          '@context': [
            'https://w3id.org/did/v1',
            'https://w3id.org/security/suites/ed25519-2018/v1',
            'https://w3id.org/security/suites/x25519-2019/v1',
          ],
          id: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
          verificationMethod: [
            {
              id: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
              publicKeyBase58: 'ApexJxnhZHC6Ctq4fCoNHKYgu87HuRTZ7oSyfehG57zE',
            },
          ],
          authentication: [
            'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
          ],
          assertionMethod: [
            'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
          ],
          keyAgreement: [
            {
              id: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6LSm5B4fB9NA55xB7PSeMYTMS9sf8uboJvyZBaDLLSZ7Ryd',
              type: 'X25519KeyAgreementKey2019',
              controller: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
              publicKeyBase58: 'APzu8sLW4cND5j1g7i2W2qwPozNV6hkpgCrXqso2Q4Cs',
            },
          ],
          capabilityInvocation: [
            'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
          ],
          capabilityDelegation: [
            'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc#z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
          ],
        },
        DidDocument
      ),
      secret: {},
    },
  } as DidCreateResult
}

export async function openWebSocket(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}`)
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  return ws
}

export async function closeWebSocket(ws: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    if (!ws || ws.readyState === ws.CLOSED) return resolve()
    ws.removeAllListeners()
    ws.once('close', () => resolve())
    ws.once('error', (err) => reject(err))
    ws.close()
  })
}
