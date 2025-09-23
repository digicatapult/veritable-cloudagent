import knex, { Knex } from 'knex'
import { z } from 'zod'
import Zod, { IDatabase, Models, Order, TABLE, Where, tablesList } from './types.js'

export const reduceWhere = <M extends TABLE>(
  query: knex.Knex.QueryBuilder,
  where?: Where<M>
): knex.Knex.QueryBuilder => {
  if (where) {
    if (!Array.isArray(where)) {
      where = [where]
    }
    query = where.reduce((acc, w) => {
      if (Array.isArray(w)) {
        return acc.where(w[0], w[1], w[2])
      }
      return acc.where(
        Object.entries(w).reduce(
          (acc, [k, v]) => {
            if (v !== undefined) acc[k] = v
            return acc
          },
          {} as Record<string, unknown>
        )
      )
    }, query)
  }
  return query
}

export interface DatabaseConnectionConfig {
  host: string
  database: string
  user: string
  password: string
  port: number
}

export default class Database {
  private db: IDatabase
  private client: Knex

  constructor(connection: DatabaseConnectionConfig, client?: Knex) {
    this.client =
      client ??
      knex({
        client: 'pg',
        connection: {
          host: connection.host,
          database: connection.database,
          user: connection.user,
          password: connection.password,
          port: connection.port,
        },
        pool: { min: 2, max: 10 },
        migrations: { tableName: 'migrations' },
      })
    const models: IDatabase = tablesList.reduce((acc, name) => {
      return {
        [name]: () => this.client(name),
        ...acc,
      }
    }, {}) as IDatabase
    this.db = models
  }

  upsert = async <M extends TABLE>(
    model: M,
    record: Models[typeof model]['insert'],
    conflictCol: string
  ): Promise<Models[typeof model]['get'][]> => {
    const result = await this.db[model]().insert(record).onConflict(conflictCol).merge().returning('*')
    return z.array(Zod[model].get).parse(result) as Models[typeof model]['get'][]
  }

  get = async <M extends TABLE>(
    model: M,
    where?: Where<M>,
    order?: Order<M>,
    limit?: number
  ): Promise<Models[typeof model]['get'][]> => {
    let query = this.db[model]()
    query = reduceWhere(query, where)
    if (order && order.length !== 0) {
      query = order.reduce((acc, [key, direction]) => acc.orderBy(key, direction), query)
    }
    if (limit !== undefined) query = query.limit(limit)
    const result = await query
    return z.array(Zod[model].get).parse(result) as Models[typeof model]['get'][]
  }
}
