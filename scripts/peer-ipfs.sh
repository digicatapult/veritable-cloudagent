#!/bin/sh
set -eu

MAX_ATTEMPTS=30
SLEEP_SECONDS=1

get_id() {
  docker exec "$1" ipfs id -f="<id>"
}

peer_count() {
  docker exec "$1" sh -c "ipfs swarm peers | wc -l"
}

connect_peer() {
  from="$1"
  to="$2"
  id="$3"
  docker exec "$from" ipfs swarm connect "/dns/${to}/tcp/4001/p2p/${id}" >/dev/null 2>&1 || true
}

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  ID0=$(get_id ipfs0 || true)
  ID1=$(get_id ipfs1 || true)
  ID2=$(get_id ipfs2 || true)

  if [ -n "$ID0" ] && [ -n "$ID1" ] && [ -n "$ID2" ]; then
    connect_peer ipfs0 ipfs1 "$ID1"
    connect_peer ipfs0 ipfs2 "$ID2"

    connect_peer ipfs1 ipfs0 "$ID0"
    connect_peer ipfs1 ipfs2 "$ID2"

    connect_peer ipfs2 ipfs0 "$ID0"
    connect_peer ipfs2 ipfs1 "$ID1"

    P0=$(peer_count ipfs0)
    P1=$(peer_count ipfs1)
    P2=$(peer_count ipfs2)

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
