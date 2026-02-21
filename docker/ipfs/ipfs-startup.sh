#!/bin/sh
set -ex

NODES="${IPFS_NODES:-ipfs0 ipfs1 ipfs2}"

if [ -z "$NODES" ]; then
  echo "IPFS_NODES is empty; expected a space-separated list like: ipfs0 ipfs1 ipfs2"
  exit 1
fi

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

# Allow announcing private IP addresses (otherwise server profile prevents it)
ipfs config --json Addresses.NoAnnounce '[]'

# Allow connection to private IP addresses (Docker network) by clearing filters set by server profile
ipfs config --json Swarm.AddrFilters null
ipfs config --json Discovery.MDNS.Enabled true

# Ensure IPFS data directory is initialized so we can read Identity.PeerID.
if [ ! -f /data/ipfs/config ]; then
   echo "Initializing IPFS data directory..."
   if ! ipfs init; then
     echo "Failed to initialize IPFS data directory" >&2
     exit 1
   fi
fi

if [ ! -f /data/ipfs/config ]; then
  echo "IPFS config file missing after initialization: /data/ipfs/config" >&2
  exit 1
fi

if [ -z "$IPFS_NODE_NAME" ]; then
  echo "IPFS_NODE_NAME is required (expected one of: $NODES)"
  exit 1
fi

node_in_list=false
for node in $NODES; do
  if [ "$node" = "$IPFS_NODE_NAME" ]; then
    node_in_list=true
    break
  fi
done

if [ "$node_in_list" != true ]; then
  echo "IPFS_NODE_NAME '$IPFS_NODE_NAME' is not present in IPFS_NODES '$NODES'" >&2
  exit 1
fi

if ! PEER_ID=$(ipfs config Identity.PeerID 2>/dev/null); then
  echo "Failed to read Identity.PeerID from IPFS config" >&2
  exit 1
fi

if [ -z "$PEER_ID" ]; then
  echo "Identity.PeerID is empty in IPFS config" >&2
  exit 1
fi

echo "Node $IPFS_NODE_NAME has PeerID $PEER_ID"
if ! echo "$PEER_ID" > "/ipfs-peerdata/$IPFS_NODE_NAME.peerid"; then
  echo "Failed to write peer metadata for node '$IPFS_NODE_NAME'" >&2
  exit 1
fi

echo "Waiting for peer metadata from all IPFS nodes..."
attempts=0
while true; do
  all_ready=true
  missing_nodes=""
  for node in $NODES; do
    if [ ! -f "/ipfs-peerdata/$node.peerid" ]; then
      all_ready=false
      missing_nodes="$missing_nodes $node"
    fi
  done

  if [ "$all_ready" = true ]; then
    break
  fi

  sleep 2
  attempts=$((attempts+1))
  if [ $attempts -ge 60 ]; then
    echo "Timeout waiting for peer metadata from all nodes. Missing:$missing_nodes" >&2
    exit 1
  fi
done

# Configure full-mesh static peering as the only discovery/connectivity mechanism.
peering_json='['
first_entry=true
for node in $NODES; do
  case "$node" in
    *[!a-zA-Z0-9-]*|'')
      echo "Invalid node name '$node' in IPFS_NODES; expected alphanumeric/hyphen values" >&2
      exit 1
      ;;
  esac

  if [ "$node" = "$IPFS_NODE_NAME" ]; then
    continue
  fi

  node_peer_id=$(cat "/ipfs-peerdata/$node.peerid")
  case "$node_peer_id" in
    *[!a-zA-Z0-9]*|'')
      echo "Invalid peer ID '$node_peer_id' read for node '$node'" >&2
      exit 1
      ;;
  esac

  node_transport_addr="/dns4/$node/tcp/4001"
  peer_entry=$(printf '{"ID":"%s","Addrs":["%s"]}' "$node_peer_id" "$node_transport_addr")

  if [ "$first_entry" = true ]; then
    first_entry=false
  else
    peering_json="$peering_json,"
  fi

  peering_json="$peering_json$peer_entry"
done

peering_json="$peering_json]"

if ! ipfs config --json Peering.Peers "$peering_json"; then
  echo "Failed to write Peering.Peers configuration" >&2
  exit 1
fi

configured_peers=$(ipfs config --json Peering.Peers)
if [ "$configured_peers" = "[]" ]; then
  echo "Peering.Peers verification failed: configuration is empty" >&2
  exit 1
fi

for node in $NODES; do
  if [ "$node" = "$IPFS_NODE_NAME" ]; then
    continue
  fi

  node_peer_id=$(cat "/ipfs-peerdata/$node.peerid")
  if ! printf '%s' "$configured_peers" | grep -q "$node_peer_id"; then
    echo "Peering.Peers verification failed: missing peer ID '$node_peer_id' for node '$node'. actual=$configured_peers" >&2
    exit 1
  fi
done

if ! printf '%s' "$configured_peers" | grep -q '/dns4/'; then
  echo "Peering.Peers verification failed: no expected transport addresses found. actual=$configured_peers" >&2
  exit 1
fi

echo "Configured static peers: $peering_json"

# Note: This script only configures IPFS.
# The container's default entrypoint will start the ipfs daemon after this script completes.
