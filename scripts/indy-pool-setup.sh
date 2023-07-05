# Build indy pool
docker build -f network/indy-pool.dockerfile -t indy-pool . --platform linux/amd64

# NOTE: If you are on an ARM (M1) mac use the `network/indy-pool-arm.dockerfile` instead
# docker build -f network/indy-pool-arm.dockerfile -t indy-pool . --platform linux/arm64/v8

# Start indy pool
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed. Set 'ENDORSER' role in order to be able to register public DIDs
docker exec indy-pool add-did-from-seed 00000000000000000000000Endorser9 ENDORSER

#  DID and Verkey from seed. Set 'Trustee'
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

# If you want to register using the DID/Verkey you can use
# docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"