# veritable-cloudagent

This is a forked version of -> https://github.com/hyperledger/aries-framework-javascript-ext/tree/main mainly focusing around OpenApi/Rest client.

## This project uses YARN not NPM
As you already noticed we are using yarn for managing dependencies. The reason behind this is the requirement of older version of NodeJS for `Indy` to run.

## Development
This might need a little tweaking and also requires a `yarn` package manager rather than `npm`. Workspaces in `package.json` are crucial for this project while we use indy.

More details on local development can be found [here](https://github.com/hyperledger/aries-framework-javascript/blob/main/DEVREADME.md)


```sh
# this is not a complete just yet
# install dependencies
yarn install

# setup indy pool this should create and mount a docker image a long with
# other items
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

### Attribution
Thanks for all the hard work to everybody who contributed to the [project](https://github.com/hyperledger/aries-framework-javascript-ext/tree/main)
