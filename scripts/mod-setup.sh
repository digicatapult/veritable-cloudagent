#!/usr/bin/env bash
set -euo pipefail

# Load env if present
[ -f .mod.env ] && set -a && . ./.mod.env && set +a

: "${MOD_API:?MOD_API missing}"
: "${MAKER_DID:?MAKER_DID missing}"
: "${OEM_DID:?OEM_DID missing}"
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

ensure_connected(){
  # implicit invite to oem and maker 
  log "Trying to connect by did to maker."
  connect_by_did "$MAKER_DID" "$MOD_API"
  log "Trying to connect by did to oem."
  connect_by_did "$OEM_DID" "$MOD_API"

}

complete_connection(){
  local api="$1"
  conns="$(curl -fsS "$api/v1/connections")"
  log "Connections: $conns"
  # get the 1st connection as there should only be one
  conn_id="$(curl -fsS "$api/v1/connections" | jq -r '.[0].id')"
  log "First connection id: $conn_id"
  #complete the connection
  curl -fsS -X POST "$api/v1/connections/$conn_id/accept-request"

  wait_connection_completed "$conn_id" 

}

main() {
  # wait until all endpoints are available 
  command -v jq >/dev/null || { echo "jq is required"; exit 1; }
  wait_for_api "$MOD_API/health" || true  
  wait_for_api "$OEM_API/health" || true
  wait_for_api "$MAKER_API/health" || true

  ensure_connected

  log "Attempting to complete connection to oem"
  complete_connection "$OEM_API" "$OEM_DID"
  log "Attempting to complete connection to maker"
  complete_connection "$MAKER_API" "$MAKER_DID"


  log "Startup connectivity complete."
}

main "$@"