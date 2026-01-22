#!/bin/sh
set -ex

# Ensure swarm key is in place in the data directory
if [ -f /usr/local/share/ipfs/swarm.key ]; then
    echo "Copying swarm.key to data directory..."
    cp /usr/local/share/ipfs/swarm.key /data/ipfs/swarm.key
fi

# Force DHT routing for private network
ipfs config Routing.Type dht

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

# Note: This script only configures IPFS.
# The container's default entrypoint will start the ipfs daemon after this script completes.
