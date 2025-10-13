// http-webhook.js
import express from 'express'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 3003
const SCRIPT_PATH = process.env.SCRIPT_PATH || './scripts/maker-connect-to-oem.ts'
const TRIGGER_STATES = (process.env.TRIGGER_STATES || 'offer-received,credential-issued')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

const app = express()
app.use(express.json({ type: '*/*' }))

app.post('/credentials', (req, res) => {
  const cred = req.body || {}
  const id = cred.id || cred.credentialId || cred.recordId
  const state = String(cred.state || '').toLowerCase()
  if (!id) return res.status(400).json({ error: 'missing id' })
  if (!TRIGGER_STATES.includes(state)) return res.status(204).end()

  const child = spawn('npx', ['tsx', SCRIPT_PATH, '--credential-id', String(id)], {
    stdio: 'inherit',
    env: { ...process.env, CREDENTIAL_RECORD_ID: String(id) },
  })
  child.on('exit', (code, signal) => {
    console.log('child exited', { code, signal })
  })
  return res.status(202).end()
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP webhook listening on http://0.0.0.0:${PORT}`)
})
