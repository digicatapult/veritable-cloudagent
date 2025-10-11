import { Client } from 'pg'
import { Logger } from 'pino'

export interface DatabaseSetupConfig {
  host: string
  user: string
  password: string
  port: number
  targetDatabase: string
}

/**
 * Ensures that the target database exists by creating it if necessary.
 * This function connects to the 'postgres' database to create the target database.
 */
export async function ensureDatabaseExists(config: DatabaseSetupConfig, logger: Logger): Promise<void> {
  const { host, user, password, port, targetDatabase } = config

  // Create a connection to the default 'postgres' database to create our target database
  const adminClient = new Client({
    host,
    user,
    password,
    port,
    database: 'postgres', // Connect to default postgres database
  })

  try {
    await adminClient.connect()

    // Check if database exists
    const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase])

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      logger.info(`Creating database: ${targetDatabase}`)
      await adminClient.query(`CREATE DATABASE "${targetDatabase}"`)
      logger.info(`Successfully created database: ${targetDatabase}`)
    } else {
      logger.info(`Database ${targetDatabase} already exists`)
    }
  } catch (error) {
    logger.error(`Failed to ensure database ${targetDatabase} exists: ${String(error)}`)
    throw error
  } finally {
    await adminClient.end()
  }
}
