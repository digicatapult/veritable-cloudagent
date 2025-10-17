import express from 'express'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 3003
const AUTO_CONNECT_TO_OEM_SCRIPT_PATH = './scripts/maker-connect-to-oem.ts'
const PROPOSE_PROOF_SCRIPT_PATH = './scripts/maker-propose-proof-to-oem.ts'
const ACCEPT_PROOF_SCRIPT_PATH = './scripts/maker-accept-proof-from-oem.ts'
const TRIGGER_STATES = (process.env.TRIGGER_STATES || 'offer-received,credential-issued')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
let credentialRecordId = ''
const { log, error } = console

const app = express()
app.use(express.json({ type: '*/*' }))

// Handle credential events, in our demo this is the credential sent from Alice(MoD) to Bob(Maker)
app.post('/credentials', (req, res) => {
  const cred = req.body || {}
  credentialRecordId = cred.id
  const state = String(cred.state || '').toLowerCase()
  if (!credentialRecordId) return res.status(400).json({ error: 'missing id' })
  if (!TRIGGER_STATES.includes(state)) return res.status(204).end()

  const child = spawn('npx', ['tsx', AUTO_CONNECT_TO_OEM_SCRIPT_PATH, '--credential-id', String(credentialRecordId)], {
    stdio: 'inherit',
    env: { ...process.env, CREDENTIAL_RECORD_ID: String(credentialRecordId) },
  })
  child.on('exit', (code) => {
    if (code !== 0) {
      error(`Child process exited with code ${code}`)
    }
  })
  return res.status(202).end()
})

// Handle connection events, in our demo this is the connection completed between Bob(Maker) and Charlie(OEM)
app.post('/connections', (req, res) => {
  const conn = req.body.connectionRecord || {}
  const connectionId = conn.id
  if (!connectionId) return res.status(400).json({ error: 'missing id' })
  const state = String(conn.state || '').toLowerCase()
  if (state !== 'completed') return res.status(204).end()
  log(`Using credential record id: ${credentialRecordId}`)
  const child = spawn(
    'npx',
    [
      'tsx',
      PROPOSE_PROOF_SCRIPT_PATH,
      '--credential-id',
      String(credentialRecordId),
      '--connection-id',
      String(connectionId),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, CREDENTIAL_RECORD_ID: String(credentialRecordId) },
    }
  )
  child.on('exit', (code) => {
    if (code !== 0) {
      error(`Child process exited with code ${code}`)
    }
  })
  return res.status(202).end()
})

app.post('/proofs', (req, res) => {
  const proof = req.body || {}
  log('Received proof event', JSON.stringify(proof, null, 2))
  const id = proof.id
  const state = String(proof.state || '').toLowerCase()
  if (!id) return res.status(400).json({ error: 'missing id' })
  if (state === 'done') {
    server.close(() => {
      log('Server closed')
    })
    return res.status(202).end()
  }
  if (state === 'request-received') {
    const child = spawn('npx', ['tsx', ACCEPT_PROOF_SCRIPT_PATH, '--proof-id', String(id)], {
      stdio: 'inherit',
      env: { ...process.env, PROOF_RECORD_ID: String(id) },
    })
    child.on('exit', (code) => {
      if (code !== 0) {
        error(`Child process exited with code ${code}`)
      }
    })
    return res.status(202).end()
  }
  return res.status(204).end()
})

const server = app.listen(PORT, '0.0.0.0', () => {
  log(`HTTP webhook listening on http://0.0.0.0:${PORT}`)
})
