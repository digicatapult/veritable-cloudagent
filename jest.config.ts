import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  roots: ['<rootDir>'],
  displayName: 'veritable-cloudagent-test',
  testTimeout: 120000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
}

export default config