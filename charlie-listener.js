import express from 'express'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 3004
const SCRIPT_PATH = './scripts/oem-accept-connection.ts'
const TRIGGER_STATES = 'request-received'
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const { log } = console

const app = express()
app.use(express.json({ type: '*/*' }))

app.post('/connections', (req, res) => {
  const conn = req.body || {}
  const id = conn.connectionRecord.id
  const state = String(conn.connectionRecord.state || '').toLowerCase()
  if (!id) return res.status(400).json({ error: 'missing id' })
  if (!TRIGGER_STATES.includes(state)) return res.status(204).end()
  const child = spawn('npx', ['tsx', SCRIPT_PATH, '--connection-id', String(id)], {
    stdio: 'inherit',
    env: { ...process.env, CONNECTION_RECORD_ID: String(id) },
  })
  child.on('exit', (code, signal) => {
    log('child exited', { code, signal })
  })
  return res.status(202).end()
})

app.post('/proofs', (req, res) => {
  const proof = req.body || {}
  log('Received proof event', JSON.stringify(proof, null, 2))
  const id = proof.id || proof.proofId || proof.recordId
  const state = String(proof.state || '').toLowerCase()
  if (!id) return res.status(400).json({ error: 'missing id' })
  if (state === 'done') {
    server.close(() => {
      log('Server closed')
    })
  }
  return res.status(202).end()
})

const server = app.listen(PORT, '0.0.0.0', () => {
  log(`HTTP webhook listening on http://0.0.0.0:${PORT}`)
})
