#!/bin/bash
# Condo Notice Board — Remote Reboot Watcher
# Polls Firestore every 30 seconds for a reboot command.
# Install as a systemd service on the Raspberry Pi.

PROJECT_ID="condo-notice-board"
DOC_URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/main"
POLL_INTERVAL=30

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

log "Reboot watcher started. Polling every ${POLL_INTERVAL}s..."

while true; do
    # Fetch the reboot_requested field from Firestore
    RESPONSE=$(curl -s --max-time 10 \
        "${DOC_URL}?mask.fieldPaths=reboot_requested" 2>/dev/null)

    # Check if reboot_requested is true
    if echo "$RESPONSE" | grep -q '"booleanValue": *true'; then
        log "REBOOT REQUESTED! Clearing flag..."

        # Clear the flag via PATCH
        curl -s --max-time 10 -X PATCH \
            "${DOC_URL}?updateMask.fieldPaths=reboot_requested&updateMask.fieldPaths=last_reboot_at" \
            -H "Content-Type: application/json" \
            -d "{
                \"fields\": {
                    \"reboot_requested\": { \"booleanValue\": false },
                    \"last_reboot_at\": { \"stringValue\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }
                }
            }" > /dev/null 2>&1

        log "Flag cleared. Rebooting in 3 seconds..."
        sleep 3
        sudo reboot
    fi

    sleep $POLL_INTERVAL
done
