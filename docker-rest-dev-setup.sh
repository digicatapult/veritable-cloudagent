# Create network
docker network create test --subnet 172.19.0.0/24

# Build the indy image
docker build -f ./network/indy-pool-arm.dockerfile -t indy-pool --platform linux/arm64 .

# Start indy pool
docker run -d --rm --name indy-pool --network test --ip 172.19.0.2 -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed. Set 'ENDORSER' role in order to be able to register public DIDs
docker exec indy-pool add-did-from-seed 00000000000000000000000Endorser9 ENDORSER

#  DID and Verkey from seed. Set 'Trustee'
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

# If you want to register using the DID/Verkey you can use # V4SGRU86Z58d6TV7PBUe6f
docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"

# Build rest image
cd ./packages/rest/ ; docker build --platform=linux/amd64 -f ./afj-arm.dockerfile -t afj . ; cd ../..

# Run aries
docker run -d -it --network test -v $PWD:/root/ --name aries -h aries --platform linux/amd64 --ip 172.19.0.3 -p 5000 -p 3000 --entrypoint /bin/bash afj

# Echo how to attach aries container
echo "docker exec -it aries bash"

# Echo hot to test
echo "GENESIS_TXN_PATH=/root/network/genesis/docker-genesis.txn TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 npm run test"

# KILL_ALL
# docker rm -f indy-pool ; docker rm -f aries ; docker network rm test
echo "# KILL: docker rm -f indy-pool ; docker rm -f aries ; docker network rm test"