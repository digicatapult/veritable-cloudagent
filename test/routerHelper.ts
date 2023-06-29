import request from 'supertest'
import express from 'express'

export async function getHealth(app: express.Express) {
  return request(app)
    .get('/health')
    .send()
    .then((response) => {
      return response
    })
    .catch((err) => {
      return err
    })
}
