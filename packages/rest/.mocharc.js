'use strict';

const base = {
  testTimeout: 120000,
  //   preset: 'ts-jest',
  //   testEnvironment: 'node',
  //   coveragePathIgnorePatterns: ['/build/', '/node_modules/', '/__tests__/', 'tests'],
  ignore: ['/build/', '/node_modules/', './build/', './node_modules/'],
  //   coverageDirectory: '<rootDir>/coverage/',
  //   verbose: true,
  //   testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  //   transform: {
  //     '^.+\\.tsx?$': [
  //       'ts-jest',
  //       {
  //         isolatedModules: true,
  //       },
  //     ],
}

module.exports = {
  ...base,
  timeout: '120000',
//   "extension": ["ts", "tsx"],
//   "spec": [
//     "test/**/*.spec.ts", "test/**/*.spec.tsx"
//   ],
  bail: false /* bail */,
  package: './package.json' /* details */,
  fullTrace: true /* verbosity */,
  ui: 'bdd' /* looks */,
  color: true /* looks */,
}