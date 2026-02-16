export const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
export const BOB_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'
export const CHARLIE_BASE_URL = process.env.CHARLIE_BASE_URL ?? 'http://localhost:3002'

export const ALICE_DID_WEB_URL = process.env.ALICE_DID_WEB_URL ?? 'https://localhost:8443'
export const BOB_DID_WEB_URL = process.env.BOB_DID_WEB_URL ?? 'https://localhost:8444'
export const CHARLIE_DID_WEB_URL = process.env.CHARLIE_DID_WEB_URL ?? 'https://localhost:8445'

export const DID_WEB_ALICE = 'did:web:alice%3A8443'
export const DID_WEB_BOB = 'did:web:bob%3A8443'
export const DID_WEB_CHARLIE = 'did:web:charlie%3A8443'

export const ISSUER_DID_KEY = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'

export const OOB_INVITATION_PAYLOAD = {
  handshake: true,
  handshakeProtocols: ['https://didcomm.org/connections/1.x'],
  autoAcceptConnection: true,
}
