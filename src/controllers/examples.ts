import type { AnonCredsCredentialDefinition, AnonCredsSchema } from '@credo-ts/anoncreds'
import {
  type AutoAcceptProof,
  type BasicMessageRole,
  type CredentialExchangeRecordProps,
  CredentialRole,
  type CredentialState,
  type DidExchangeRole,
  type DidExchangeState,
  type OutOfBandInvitationOptions,
  type OutOfBandRecordProps,
  type OutOfBandRole,
  type OutOfBandState,
  type ProofExchangeRecordProps,
  ProofRole,
  type ProofState,
} from '@credo-ts/core'

/**
 * @example "821f9b26-ad04-4f56-89b6-e2ef9c72b36e"
 */
export type RecordId = string

/**
 * @example "did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL"
 */
export type Did = string

/**
 * @example "1.0.0"
 */
export type Version = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:3:CL:20:tag"
 */
export type CredentialDefinitionId = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0"
 */
export type SchemaId = string

export const BasicMessageRecordExample = {
  _tags: {
    role: 'sender',
    connectionId: '2aecf74c-3073-4f98-9acb-92415d096834',
  },
  metadata: {},
  id: '74bcf865-1fdc-45b4-b517-9def02dfd25f',
  createdAt: new Date('2022-08-18T08:38:40.216Z'),
  content: 'string',
  sentTime: '2022-08-18T08:38:40.216Z',
  connectionId: '2aecf74c-3073-4f98-9acb-92415d096834',
  role: 'sender' as BasicMessageRole,
}

export const ConnectionRecordExample = {
  _tags: {
    invitationDid:
      'did:peer:2.SeyJzIjoiaHR0cHM6Ly9kYTIzLTg5LTIwLTE2Mi0xNDYubmdyb2suaW8iLCJ0IjoiZGlkLWNvbW11bmljYXRpb24iLCJwcmlvcml0eSI6MCwicmVjaXBpZW50S2V5cyI6WyJkaWQ6a2V5Ono2TWtualg3U1lXRmdHMThCYkNEZHJnemhuQnA0UlhyOGVITHZxQ3FvRXllckxiTiN6Nk1rbmpYN1NZV0ZnRzE4QmJDRGRyZ3pobkJwNFJYcjhlSEx2cUNxb0V5ZXJMYk4iXSwiciI6W119',
    did: 'did:peer:1zQmfQh1T3rSqarP2FZ37uKjdQHPKFdVyo2mGiAPHZ8Ep7hv',
    state: 'invitation-sent' as DidExchangeState,
    invitationKey: '9HG4rJFpLiWf56MWxHj9rgdpErFzim2zEpHuxy1dw7oz',
    outOfBandId: 'edbc89fe-785f-4774-a288-46012486881d',
    verkey: '9HG4rJFpLiWf56MWxHj9rgdpErFzim2zEpHuxy1dw7oz',
    role: 'responder' as DidExchangeRole,
  },
  metadata: {},
  id: '821f9b26-ad04-4f56-89b6-e2ef9c72b36e',
  createdAt: new Date('2022-01-01T00:00:00.000Z'),
  did: 'did:peer:1zQmfQh1T3rSqarP2FZ37uKjdQHPKFdVyo2mGiAPHZ8Ep7hv',
  state: 'invitation-sent' as DidExchangeState,
  role: 'responder' as DidExchangeRole,
  invitationDid:
    'did:peer:2.SeyJzIjoiaHR0cHM6Ly9kYTIzLTg5LTIwLTE2Mi0xNDYubmdyb2suaW8iLCJ0IjoiZGlkLWNvbW11bmljYXRpb24iLCJwcmlvcml0eSI6MCwicmVjaXBpZW50S2V5cyI6WyJkaWQ6a2V5Ono2TWtualg3U1lXRmdHMThCYkNEZHJnemhuQnA0UlhyOGVITHZxQ3FvRXllckxiTiN6Nk1rbmpYN1NZV0ZnRzE4QmJDRGRyZ3pobkJwNFJYcjhlSEx2cUNxb0V5ZXJMYk4iXSwiciI6W119',
  outOfBandId: 'edbc89fe-785f-4774-a288-46012486881d',
}

export const DidRecordExample = {
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

export const DidStateExample = {
  state: 'finished' as const,
  did: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMuVvfGzLmc',
  didDocument: {
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
  secret: {},
}

type OutOfBandRecordProperties = Omit<OutOfBandRecordProps, 'outOfBandInvitation'>
export type OutOfBandInvitationProps = Omit<
  OutOfBandInvitationOptions,
  'handshakeProtocols' | 'services' | 'appendedAttachments'
>

export interface OutOfBandRecordWithInvitationProps extends OutOfBandRecordProperties {
  outOfBandInvitation: OutOfBandInvitationProps
}

export const outOfBandInvitationExample = {
  '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/out-of-band/1.1/invitation',
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

export const outOfBandRecordExample = {
  _tags: {
    invitationId: '1cbd22e4-1906-41e9-8807-83d84437f978',
    state: 'await-response',
    role: 'sender',
    recipientKeyFingerprints: ['z6MktUCPZjfRJXD4GMcYuXiqX2qZ8vBw6UAYpDFiHEUfwuLj'],
  },
  outOfBandInvitation: outOfBandInvitationExample,
  metadata: {},
  id: '42a95528-0e30-4f86-a462-0efb02178b53',
  createdAt: new Date('2022-01-01T00:00:00.000Z'),
  role: 'sender' as OutOfBandRole,
  state: 'await-response' as OutOfBandState,
  reusable: false,
}

export const CredentialExchangeRecordExample: CredentialExchangeRecordProps = {
  tags: {
    state: 'offer-sent',
    threadId: '82701488-b43c-4d7b-9244-4bb204a7ae26',
    connectionId: 'ac6d0fdd-0db8-4f52-8a3d-de7ff8ddc14b',
  },
  role: CredentialRole.Issuer,
  credentials: [],
  id: '821f9b26-ad04-4f56-89b6-e2ef9c72b36e',
  createdAt: new Date('2022-01-01T00:00:00.000Z'),
  state: 'offer-sent' as CredentialState,
  connectionId: 'ac6d0fdd-0db8-4f52-8a3d-de7ff8ddc14b',
  threadId: '82701488-b43c-4d7b-9244-4bb204a7ae26',
  credentialAttributes: [],
  protocolVersion: 'v1',
}

export const CredentialFormatDataExample = {
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

export const ProofRecordExample: ProofExchangeRecordProps = {
  id: '821f9b26-ad04-4f56-89b6-e2ef9c72b36e',
  protocolVersion: 'v2',
  role: ProofRole.Verifier,
  state: 'proposal-sent' as ProofState,
  threadId: '0019d466-5eea-4269-8c40-031b4896c5b7',
  connectionId: '2aecf74c-3073-4f98-9acb-92415d096834',
  createdAt: new Date('2022-01-01T00:00:00.000Z'),
  autoAcceptProof: 'always' as AutoAcceptProof,
}

export const SchemaExample: AnonCredsSchema & { id: string } = {
  id: 'WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0',
  issuerId: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
  name: 'schema',
  version: '1.0',
  attrNames: ['string'],
}

export const CredentialDefinitionExample: AnonCredsCredentialDefinition & { id: string } = {
  id: 'WgWxqztrNooG92RXvxSTWv:3:CL:20:tag',
  issuerId: 'did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL',
  schemaId: '351936',
  type: 'CL',
  tag: 'definition',
  value: {
    primary: {
      n: 'string',
      s: 'string',
      r: {
        master_secret: 'string',
        string: 'string',
      },
      rctxt: 'string',
      z: 'string',
    },
    revocation: {
      g: '1 string',
      g_dash: 'string',
      h: 'string',
      h0: 'string',
      h1: 'string',
      h2: 'string',
      htilde: 'string',
      h_cap: 'string',
      u: 'string',
      pk: 'string',
      y: 'string',
    },
  },
}
