#!/bin/bash
# test-ipfs-connectivity.sh
# Tests IPFS container health, configuration, and connectivity

set -e

CONTAINERS=("ipfs0" "ipfs1" "ipfs2")
FAILED=0

echo "🔍 Starting IPFS Connectivity Probe..."
echo "========================================"

for container in "${CONTAINERS[@]}"; do
    echo "📦 Checking node: $container"
    
    # 1. Check Container Running Status
    if [ "$(docker inspect -f '{{.State.Running}}' $container 2>/dev/null)" != "true" ]; then
        echo "  ❌ STOPPED: Container is not running"
        FAILED=1
        continue
    fi

    # 2. Check Health Status
    health=$(docker inspect --format='{{json .State.Health.Status}}' $container)
    if [ "$health" == "\"healthy\"" ]; then
        echo "  ✅ HEALTHY"
    else
        echo "  ❌ UNHEALTHY: Status is $health"
        FAILED=1
    fi

    # 3. Check Peer Count (Should be > 0)
    # Count unique peer IDs (last segment of the multiaddr)
    peers=$(docker exec $container ipfs swarm peers | awk -F/ '{print $NF}' | sort -u | wc -l | xargs)
    if [ "$peers" -gt 0 ]; then
        echo "  ✅ PEERS: Connected to $peers unique peer(s)"
    else
        echo "  ❌ PEERS: No peers connected"
        FAILED=1
    fi

    # 4. Check Configurations (Validating recent fixes)
    
    # Check Swarm.AddrFilters (Should be null for private Docker network)
    filters=$(docker exec $container ipfs config Swarm.AddrFilters)
    if [ "$filters" == "null" ]; then
        echo "  ✅ CONFIG: Swarm.AddrFilters is null"
    else
        echo "  ❌ CONFIG: Swarm.AddrFilters is '$filters' (Expected: null)"
        FAILED=1
    fi

    # Check AutoConf (Should be false)
    autoconf=$(docker exec $container ipfs config AutoConf.Enabled)
    if [ "$autoconf" == "false" ]; then
        echo "  ✅ CONFIG: AutoConf.Enabled is false"
    else
        echo "  ❌ CONFIG: AutoConf.Enabled is '$autoconf' (Expected: false)"
        FAILED=1
    fi
    
    # Check DNS.Resolvers (Should be {})
    dns=$(docker exec $container ipfs config --json DNS.Resolvers 2>/dev/null)
    if [ "$dns" == "{}" ]; then
        echo "  ✅ CONFIG: DNS.Resolvers is {}"
    else
        echo "  ❌ CONFIG: DNS.Resolvers is '$dns' (Expected: {})"
        FAILED=1
    fi

    # Check mDNS (Should be false with deterministic peering)
    mdns=$(docker exec $container ipfs config Discovery.MDNS.Enabled)
    if [ "$mdns" == "false" ]; then
        echo "  ✅ CONFIG: Discovery.MDNS.Enabled is false"
    else
        echo "  ❌ CONFIG: Discovery.MDNS.Enabled is '$mdns' (Expected: false)"
        FAILED=1
    fi

    echo ""
done

echo "🌐 Testing Network Reachability (Ping)"
echo "----------------------------------------"

# Function to ping
check_ping() {
    local src=$1
    local dst=$2
    if docker exec $src ping -c 1 $dst > /dev/null 2>&1; then
        echo "  ✅ $src -> $dst"
    else
        echo "  ❌ $src -> $dst (Unreachable)"
        FAILED=1
    fi
}

check_ping ipfs0 ipfs1
check_ping ipfs0 ipfs2
check_ping ipfs1 ipfs2

echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo "🎉 SUCCESS: All IPFS connectivity checks passed!"
    exit 0
else
    echo "💥 FAILURE: Some checks failed. See output above."
    exit 1
fi
