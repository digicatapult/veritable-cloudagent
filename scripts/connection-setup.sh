#!/usr/bin/env bash
set -euo pipefail

# This script sets up connections between three agents (BOB -> Alice <- Charlie)
# using implicit invitations based on their DIDs.
# It waits for the agents' APIs to be available, then initiates and completes
# connections.

# Load env if present
[ -f .connection.env ] && set -a && . ./.connection.env && set +a

: "${ALICE_API:?ALICE_API missing}"
: "${BOB_DID:?BOB_DID missing}"
: "${CHARLIE_DID:?CHARLIE_DID missing}"
TIMEOUT_SECS="${TIMEOUT_SECS:-30}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" >&2; }

wait_for_api() {
  local url="$1" deadline=$(( $(date +%s) + TIMEOUT_SECS ))
    until curl -fsS "$url" >/dev/null 2>&1; do
    if [ "$(date +%s)" -gt "$deadline" ]; then
      log "ERROR: API not ready: $url"
      return 1
    fi
    sleep 1
  done
}

connect_by_did() {
  local their_did="$1"
  local api="$2"
  log "Connecting to $their_did via implicit invitation..."
  curl -fsS -X POST  "$api/v1/oob/receive-implicit-invitation" \
    -H 'content-type: application/json' \
    -d "{
      \"did\":\"$their_did\",
      \"autoAcceptConnection\":true,
      \"autoAcceptInvitation\":true,
      \"handshakeProtocols\":[\"https://didcomm.org/didexchange/1.x\"]
    }"
  log "Initialised connection to $their_did via implicit invitation..."
}

wait_connection_completed() {
  local conn_id="$1" deadline=$(( $(date +%s) + TIMEOUT_SECS ))
  local api="$2"
  while true; do
    state="$(curl -fsS "$api/v1/connections/$conn_id" | jq -r '.state')"
    if [ "$state" = "completed" ]; then return 0; fi
    if [ "$(date +%s)" -gt "$deadline" ]; then
      log "ERROR: $conn_id not 'completed' within ${TIMEOUT_SECS}s (last: ${state:-unknown})"
      return 1
    fi
    sleep "$POLL_INTERVAL_SECS"
  done
}



complete_connection(){
  local api="$1"
  # get the 1st connection as there should only be one
  conn_id="$(curl -fsS "$api/v1/connections" | jq -r '.[0].id')"
  log "First connection id: $conn_id"
  #complete the connection
  curl -fsS -X POST "$api/v1/connections/$conn_id/accept-request"

  wait_connection_completed "$conn_id" "$api"

}

main() {
  # wait until all endpoints are available 
  command -v jq >/dev/null || { echo "jq is required"; exit 1; }
  wait_for_api "$ALICE_API/health"
  wait_for_api "$BOB_API/health"
  wait_for_api "$CHARLIE_API/health"

  # implicit invite to Bob and Charlie
  log "Trying to connect by did to Bob."
  connect_by_did "$BOB_DID" "$ALICE_API"
  log "Trying to connect by did to Charlie."
  connect_by_did "$CHARLIE_DID" "$ALICE_API"

  # complete connections
  log "Attempting to complete connection to Charlie"
  complete_connection "$CHARLIE_API"
  log "Attempting to complete connection to Bob"
  complete_connection "$BOB_API"


  log "Startup connectivity complete."
}

main "$@"