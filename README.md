# veritable-cloudagent

This is a forked version of -> https://github.com/hyperledger/aries-framework-javascript-ext/tree/main mainly focusing around OpenApi/Rest client.

## This project uses NPM
Despite the fact that the other package manager is requirement of older version of NodeJS for `Indy` to run, according to the documentation, npm seems to do the job.

## Development
More details on local development can be found [here](https://github.com/hyperledger/aries-framework-javascript/blob/main/DEVREADME.md)


```sh
# this is not a complete just yet
# install dependencies
npm install

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

# or can be passed as arg -> TEST_AGENT_PUBLIC_DID_SEED=<did> GENESIS_TXN_PATH=<path> npm run test
```

### Attribution
Thanks for all the hard work to everybody who contributed to the [project](https://github.com/hyperledger/aries-framework-javascript-ext/tree/main)
