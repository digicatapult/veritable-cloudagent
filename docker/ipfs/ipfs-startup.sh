#!/bin/sh
set -ex

# Ensure swarm key is in place in the data directory
if [ -f /usr/local/share/ipfs/swarm.key ]; then
    echo "Copying swarm.key to data directory..."
    cp /usr/local/share/ipfs/swarm.key /data/ipfs/swarm.key
fi

# Disable DHT routing (rely on Bitswap for small networks)
ipfs config Routing.Type none

# Disable AutoConf to prevent public network interference
ipfs config --json AutoConf.Enabled false

# Clear DNS resolvers to prevent "auto" conflict with AutoConf=false
ipfs config --json DNS.Resolvers '{}'

# Disable automated telemetry
ipfs config Plugins.Plugins.telemetry.Config.Mode off

# Configure API headers for access
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST"]'

# Disable public delegated routing
ipfs config --json Routing.DelegatedRouters '[]'
ipfs config --json Ipns.DelegatedPublishers '[]'

# Disable AutoTLS
ipfs config --json AutoTLS.Enabled false

# Simplify transports (disable websocket if not needed)
ipfs config --json Swarm.Transports.Network.Websocket false

# Remove all public bootstrap nodes
ipfs bootstrap rm --all

# Allow DHT on LAN addresses (important for Docker networks)
ipfs config --json Routing.LoopbackAddressesOnLanDHT true

# Allow connection to private IP addresses (Docker network) by clearing filters set by server profile
ipfs config --json Swarm.AddrFilters null
ipfs config --json Discovery.MDNS.Enabled true

# Bootstrap Logic
if [ "$IPFS_ROLE" = "bootstrap" ]; then
    echo "I am the bootstrap node (IPFS_ROLE=bootstrap)."
    
    # Ensure IPFS data directory is initialized so we can read the config.
    # The standard entrypoint handles init, but this script runs before daemon start,
    # so we must check and init manually if needed to access Identity.PeerID.
    if [ ! -f /data/ipfs/config ]; then
       echo "Initializing IPFS data directory..."
       ipfs init
    fi

    PEER_ID=$(ipfs config Identity.PeerID)
    echo "My PeerID is $PEER_ID"
    
    # Construct the multiaddr for other nodes to connect to.
    # We use 'ipfs0' as the hostname because it is the Docker service name reachable by all peers in the network.
    BOOTSTRAP_ADDR="/dns4/ipfs0/tcp/4001/p2p/$PEER_ID"
    
    echo "$BOOTSTRAP_ADDR" > /ipfs-bootstrap/ipfs0.addr
    echo "Wrote bootstrap address to /ipfs-bootstrap/ipfs0.addr: $BOOTSTRAP_ADDR"
else
    # I am a client node (ipfs1, ipfs2).
    if [ ! -f /data/ipfs/config ]; then
       echo "Initializing IPFS data directory..."
       ipfs init
    fi

    echo "Waiting for bootstrap file from ipfs0..."
    # Timeout after 60 seconds
    attempts=0
    while [ ! -f /ipfs-bootstrap/ipfs0.addr ]; do
      sleep 2
      attempts=$((attempts+1))
      if [ $attempts -ge 30 ]; then
        echo "Timeout waiting for bootstrap file!"
        exit 1
      fi
    done
    
    BOOTSTRAP_ADDR=$(cat /ipfs-bootstrap/ipfs0.addr)
    echo "Found bootstrap address: $BOOTSTRAP_ADDR"
    
    # Add bootstrap node
    ipfs bootstrap add "$BOOTSTRAP_ADDR"
fi

# Note: This script only configures IPFS.
# The container's default entrypoint will start the ipfs daemon after this script completes.
