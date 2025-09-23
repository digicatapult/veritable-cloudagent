const pgConfig = {
  client: 'pg',
  timezone: 'UTC',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.DID_WEB_DB_NAME || 'did-web-server',
    user: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: process.env.POSTGRES_PORT || '5432',
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: './src/didweb/migrations',
    tableName: 'migrations',
  },
}

const config = {
  test: pgConfig,
  development: pgConfig,
  production: {
    ...pgConfig,
    connection: {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.DID_WEB_DB_NAME,
    },
    migrations: {
      directory: './build/didweb/migrations',
    },
  },
}

export default config
