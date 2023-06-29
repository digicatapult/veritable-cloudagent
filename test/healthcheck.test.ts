import { describe, before, test } from 'mocha'
import { Express } from 'express'
import { expect } from 'chai'
import createHttpServer from '../src/server'
import { getHealth } from './routerHelper'

describe('health check', () => {
  let app: Express

  before(async function () {
    app = await createHttpServer()
  })

  test('should return 200', async () => {
    const response = await getHealth(app)

    expect(response.status).to.equal(200)
  })
})
