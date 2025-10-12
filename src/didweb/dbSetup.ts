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
 * Validates database configuration to ensure all required fields are present and valid
 */
function validateDatabaseConfig(config: DatabaseSetupConfig): void {
  if (!config.host?.trim()) {
    throw new Error('Database host is required')
  }
  if (!config.user?.trim()) {
    throw new Error('Database user is required')
  }
  if (!config.password?.trim()) {
    throw new Error('Database password is required')
  }
  if (!config.targetDatabase?.trim()) {
    throw new Error('Target database name is required')
  }
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw new Error(`Invalid database port: ${config.port}. Must be a valid port number between 1 and 65535`)
  }
}

/**
 * Ensures that the target database exists by creating it if necessary.
 * This function connects to the 'postgres' database to create the target database.
 */
export async function ensureDatabaseExists(config: DatabaseSetupConfig, logger: Logger): Promise<void> {
  // Validate configuration before proceeding
  validateDatabaseConfig(config)

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
    logger.info(`Connected to PostgreSQL server at ${host}:${port}`)

    // Check if database exists
    const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase])

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      logger.info(`Creating database: ${targetDatabase}`)
      // Escape database name to prevent SQL injection
      const escapedDbName = targetDatabase.replace(/"/g, '""')
      await adminClient.query(`CREATE DATABASE "${escapedDbName}"`)
      logger.info(`Successfully created database: ${targetDatabase}`)
    } else {
      logger.info(`Database ${targetDatabase} already exists`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to ensure database ${targetDatabase} exists: ${errorMessage}`)

    // Provide more specific error messages for common issues
    if (errorMessage.includes('ECONNREFUSED')) {
      logger.error(`Cannot connect to PostgreSQL server at ${host}:${port}. Is the server running?`)
    } else if (errorMessage.includes('authentication failed')) {
      logger.error(`Authentication failed for user ${user}. Check username and password.`)
    } else if (errorMessage.includes('permission denied')) {
      logger.error(`User ${user} does not have permission to create databases.`)
    }

    throw error
  } finally {
    try {
      await adminClient.end()
    } catch (endError) {
      logger.warn(`Warning: Failed to close database connection: ${String(endError)}`)
    }
  }
}
