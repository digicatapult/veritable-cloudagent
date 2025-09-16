import { expect } from 'chai'
import fs from 'fs'
import { Agent, fetch } from 'undici'

const ca = fs.readFileSync(process.env.DID_WEB_HTTPS_CERT_PATH || '/localhost.pem')

const agents = ['https://alice:8443', 'https://bob:8443', 'https://charlie:8443']
const httpsAgent = new Agent({
  connect: {
    ca: ca,
    rejectUnauthorized: false,
  },
})

describe('DID:web health endpoints', function () {
  agents.forEach((baseUrl) => {
    it(`should return ok for ${baseUrl} DID:web health endpoint`, async function () {
      const res = await fetch(`${baseUrl}/health`, { dispatcher: httpsAgent })
      const body = await res.json()
      expect(body).to.have.property('status', 'ok')
    })
  })
})
