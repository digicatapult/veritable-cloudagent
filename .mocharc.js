'use strict'

const base = {
  require: ['ts-node/register'],
  ignore: ['/build/', '/node_modules/', './build/', './node_modules/'],
}

module.exports = {
  ...base,
  timeout: 120000,
  extension: ['test.ts'],
  bail: false,
  package: './package.json',
  fullTrace: false,
  ui: 'bdd',
  color: true,
  recursive: true,
  reporter: 'spec',
  slow: 100,
  watch: false,
  retries: 0,
  exit: true,
}
