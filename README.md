# veritable-cloudagent
Thanks to the -> https://github.com/hyperledger/aries-framework-javascript-ext/tree/main. This is a forket version that is primary focused on https://github.com/hyperledger/aries-framework-javascript-ext/tree/main/packages/rest `package`

## Info
> Currently using `yarn` package manager due to the need of workspaces so this monolith repo can function. Did attempt `npm` and `package.json -> workspaces` with the syntax for npm but could not get it working and also sounds like a follow up story

## Development
This might need a little tweaking and also requires a `yarn` packagemanager and `workdspaces`. More details on local development can be found [here](https://github.com/hyperledger/aries-framework-javascript/blob/main/DEVREADME.md)

In order to create a local docker instance of indy-pool call indy-pool-setup. It will kick of a docker container along with other dependencies. Please note this requires a `--network host` driver or would need some changes.

```sh
# install dependencies
yarn install

# setup indy pool
./scripts/indy-pool-setup.sh

### TODO docker-compose
```

## Tests


> Environment variables that must be present and same values as per below:
```yml
env:
  TEST_AGENT_PUBLIC_DID_SEED: 000000000000000000000000Trustee9
  GENESIS_TXN_PATH: network/genesis/local-genesis.txn

# or can be passed as arg -> TEST_AGENT_PUBLIC_DID_SEED=<did> GENESIS_TXN_PATH=<path> yarn test rest --coverage
```


## https://digicatapult.atlassian.net/browse/VER-51
- [x] Adopt our prettier linting convention
- [x] add open-source materials
- [x] do not upgrade dependencies and don’t implement renovate yet
- [x] workflows for running tests in CI and releasing
- [x] ensure attribution is acknowledged
