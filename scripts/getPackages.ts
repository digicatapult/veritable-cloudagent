/* eslint-disable no-console */
const packages = [ 'rest' ]

console.log(`packages: ${JSON.stringify(packages)}`)
console.log(`::set-output name=packages::${JSON.stringify(packages)}`)
