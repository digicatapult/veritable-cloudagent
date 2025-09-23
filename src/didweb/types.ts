import { Knex } from 'knex'
import { z } from 'zod'

export const tablesList = ['did_web'] as const

const defaultFields = z.object({
  created_at: z.date(),
  updated_at: z.date(),
})

const insertDidWeb = z.object({
  did: z.string(),
  document: z.unknown(),
})

const Zod = {
  did_web: {
    insert: insertDidWeb,
    get: insertDidWeb.extend(defaultFields.shape),
  },
}

export type TABLES_TUPLE = typeof tablesList
export type TABLE = TABLES_TUPLE[number]
export type Models = {
  [key in TABLE]: {
    get: z.infer<(typeof Zod)[key]['get']>
    insert: z.infer<(typeof Zod)[key]['insert']>
  }
}

export type ColumnsByType<M extends TABLE, T> = {
  [K in keyof Models[M]['get']]-?: Models[M]['get'][K] extends T ? K : never
}[keyof Models[M]['get']]

type WhereComparison<M extends TABLE> = {
  [key in keyof Models[M]['get']]: [
    Extract<key, string>,
    '=' | '>' | '>=' | '<' | '<=' | '<>' | 'LIKE' | 'ILIKE',
    Extract<Models[M]['get'][key], Knex.Value>,
  ]
}
export type WhereMatch<M extends TABLE> = {
  [key in keyof Models[M]['get']]?: Models[M]['get'][key]
}

export type Where<M extends TABLE> = WhereMatch<M> | (WhereMatch<M> | WhereComparison<M>[keyof Models[M]['get']])[]
export type Order<M extends TABLE> = [keyof Models[M]['get'], 'asc' | 'desc'][]
export type Update<M extends TABLE> = Partial<Models[M]['get']>

export type IDatabase = {
  [key in TABLE]: () => Knex.QueryBuilder
}

export default Zod
