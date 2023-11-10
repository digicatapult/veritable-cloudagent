# Build docker image
docker build -f ./Dockerfile -t afj .

# Create network
docker network create test --subnet 172.19.0.0/24

# Run aries
docker run -d -it --network test -v $PWD:/root/ --name aries -h aries --ip 172.19.0.3 -p 5002 -p 3000 --entrypoint /bin/bash afj

# Echo how to attach aries container
echo "docker exec -it aries bash"

# Echo how to test
echo "GENESIS_TXN_PATH=/root/network/genesis/docker-genesis.txn TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 npm run test"

# KILL_ALL
echo "# KILL: docker rm -f aries ; docker network rm test"