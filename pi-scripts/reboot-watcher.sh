#!/bin/bash
# Condo Notice Board — remote reboot watcher (runs on each Raspberry Pi as root).
#
# Admin → Settings → "⚡ Reboot Pi" writes a new timestamp to
# settings/main.pi_reboot_requested_at. This script polls that one field and
# reboots once for every NEW timestamp. It only READS Firestore (settings/main
# is public-read) and remembers the last timestamp it acted on in $STATE —
# nothing has to clear a flag, so a Pi can never get stuck in a reboot loop.

URL="https://firestore.googleapis.com/v1/projects/condo-notice-board/databases/(default)/documents/settings/main?mask.fieldPaths=pi_reboot_requested_at"
STATE_DIR=/var/lib/condo-notice-board
STATE="$STATE_DIR/last-reboot-request"
POLL=30
MAX_AGE=900   # ignore requests older than 15 min (e.g. Pi was off when it was sent)

log() { echo "[$(date '+%F %T')] $*"; }
mkdir -p "$STATE_DIR"
log "Reboot watcher started (polling every ${POLL}s)"

while true; do
    if RESP=$(curl -fsS --max-time 10 "$URL" 2>/dev/null); then
        REQ=$(printf '%s\n' "$RESP" | sed -n 's/.*"stringValue": *"\([^"]*\)".*/\1/p' | head -n1)
        if [ ! -f "$STATE" ]; then
            # First run: remember whatever is there now, don't reboot for it
            printf '%s' "$REQ" > "$STATE"
            log "First run — current request '${REQ:-none}' recorded"
        elif [ -n "$REQ" ] && [ "$REQ" != "$(cat "$STATE")" ]; then
            printf '%s' "$REQ" > "$STATE"; sync
            REQ_S=$(date -d "$REQ" +%s 2>/dev/null || date +%s)
            AGE=$(( $(date +%s) - REQ_S ))
            if [ "$AGE" -gt "$MAX_AGE" ]; then
                log "Request $REQ is ${AGE}s old — skipped"
            else
                log "Reboot requested at $REQ — rebooting in 3s"
                sleep 3
                systemctl reboot
                exit 0
            fi
        fi
    fi
    sleep "$POLL"
done
