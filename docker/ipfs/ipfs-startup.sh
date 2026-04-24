#!/bin/sh
set -ex

NODES="${IPFS_NODES:-ipfs0 ipfs1 ipfs2}"

if [ -z "$IPFS_NODE_NAME" ]; then
  echo "IPFS_NODE_NAME is required"
  exit 1
fi

if [ ! -f /usr/local/share/ipfs/swarm.key ]; then
  echo "Missing required swarm key at /usr/local/share/ipfs/swarm.key" >&2
  exit 1
fi

# Remove stale lock file if it exists (fixes restart issues after ungraceful shutdown)
if [ -f /data/ipfs/repo.lock ]; then
	echo "Removing stale repo.lock file..."
	rm /data/ipfs/repo.lock
fi

cp /usr/local/share/ipfs/swarm.key /data/ipfs/swarm.key

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

# Allow announcing private IP addresses (otherwise server profile prevents it)
ipfs config --json Addresses.NoAnnounce '[]'

# Allow connection to private IP addresses (Docker network) by clearing filters set by server profile
ipfs config --json Swarm.AddrFilters null
ipfs config --json Discovery.MDNS.Enabled false

# Ensure IPFS data directory is initialized so we can read Identity.PeerID.
if [ ! -f /data/ipfs/config ]; then
  ipfs init
fi

PEER_ID=$(ipfs config Identity.PeerID)

echo "$PEER_ID" > "/ipfs-peerdata/$IPFS_NODE_NAME.peerid"

echo "Waiting for peer metadata from all IPFS nodes..."
for _ in $(seq 1 30); do
  all_ready=true
  missing_nodes=""
  missing_files=""
  for node in $NODES; do
    peer_file="/ipfs-peerdata/$node.peerid"
    if [ ! -f "$peer_file" ]; then
      all_ready=false
      missing_nodes="$missing_nodes $node"
      missing_files="$missing_files $peer_file"
    fi
  done

  if [ "$all_ready" = true ]; then
    break
  fi

  sleep 2
done

if [ "$all_ready" != true ]; then
  echo "Timeout waiting for peer metadata after 60s (30 attempts x 2s). Current node: $IPFS_NODE_NAME. Missing nodes:$missing_nodes. Missing files:$missing_files" >&2
  exit 1
fi

# Configure full-mesh static peering as the only discovery/connectivity mechanism.
peering_json='['
for node in $NODES; do
  if [ "$node" = "$IPFS_NODE_NAME" ]; then
    continue
  fi

  node_peer_id=$(cat "/ipfs-peerdata/$node.peerid")

  node_transport_addr="/dns4/$node/tcp/4001"
  peer_entry=$(printf '{"ID":"%s","Addrs":["%s"]}' "$node_peer_id" "$node_transport_addr")

  peering_json="$peering_json$peer_entry,"
done

peering_json="${peering_json%,}]"

ipfs config --json Peering.Peers "$peering_json"

# Note: This script only configures IPFS.
# The container's default entrypoint will start the ipfs daemon after this script completes.
