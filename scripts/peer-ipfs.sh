#!/usr/bin/env bash
set -euo pipefail

MAX_ATTEMPTS=30
SLEEP_SECONDS=1

# NOTE: This script assumes fresh IPFS node startup. Persisted peers may let
# the check pass even if peering is currently broken.
IPFS0=${IPFS0:-ipfs0}
IPFS1=${IPFS1:-ipfs1}
IPFS2=${IPFS2:-ipfs2}

get_id() {
  docker exec "$1" ipfs id -f="<id>"
}

peer_count() {
  docker exec "$1" sh -c "ipfs swarm peers | wc -l | xargs"
}

connect_peer() {
  from="$1"
  to="$2"
  id="$3"
  if ! docker exec "$from" ipfs swarm connect "/dns/${to}/tcp/4001/p2p/${id}" >/dev/null 2>&1; then
    echo "Peer connect failed: ${from} -> ${to}" >&2
  fi
}

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  ID0=$(get_id "$IPFS0" || true)
  ID1=$(get_id "$IPFS1" || true)
  ID2=$(get_id "$IPFS2" || true)

  if [ -n "$ID0" ] && [ -n "$ID1" ] && [ -n "$ID2" ]; then
    connect_peer "$IPFS0" "$IPFS1" "$ID1"
    connect_peer "$IPFS0" "$IPFS2" "$ID2"

    connect_peer "$IPFS1" "$IPFS0" "$ID0"
    connect_peer "$IPFS1" "$IPFS2" "$ID2"

    connect_peer "$IPFS2" "$IPFS0" "$ID0"
    connect_peer "$IPFS2" "$IPFS1" "$ID1"

    P0=$(peer_count "$IPFS0")
    P1=$(peer_count "$IPFS1")
    P2=$(peer_count "$IPFS2")

    if [ "$P0" -ge 2 ] && [ "$P1" -ge 2 ] && [ "$P2" -ge 2 ]; then
      echo "IPFS peering complete"
      exit 0
    fi
  fi

  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

echo "IPFS peering failed"
exit 1
