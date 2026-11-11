#!/bin/bash
# Install (or update) the Pi helpers:
#   - reboot-watcher: reboots when Admin → Settings → ⚡ Reboot Pi is pressed
#   - weekly-reboot.timer: clean reboot every Sunday at 2 AM
# Run on each Pi:  cd pi-scripts && sudo bash install.sh   (safe to re-run)
set -e
cd "$(dirname "$0")"
mkdir -p /opt/condo-notice-board
install -m 755 reboot-watcher.sh /opt/condo-notice-board/reboot-watcher.sh
install -m 644 reboot-watcher.service /etc/systemd/system/reboot-watcher.service
install -m 644 weekly-reboot.service /etc/systemd/system/weekly-reboot.service
install -m 644 weekly-reboot.timer /etc/systemd/system/weekly-reboot.timer
systemctl daemon-reload
systemctl enable reboot-watcher
systemctl restart reboot-watcher
systemctl enable --now weekly-reboot.timer
sleep 2

echo; echo "=== Reboot watcher ==="
systemctl is-active reboot-watcher
echo; echo "=== Weekly reboot (next run) ==="
systemctl list-timers weekly-reboot.timer --no-pager | head -n 2

# The notice media cache lives in Chromium's profile on the SD card and survives
# a reboot — unless Chromium runs incognito or keeps its profile in /tmp.
echo; echo "=== Media cache check ==="
ARGS=$(ps -eo args | grep -i '[c]hromium' | head -n 1)
if echo "$ARGS" | grep -qiE -- '--incognito|--user-data-dir=/(tmp|run|dev/shm)'; then
    echo "WARNING: Chromium is started incognito / with a temporary profile — the media cache is wiped on every reboot."
else
    echo "OK: Chromium uses a normal profile, so cached notice media survives reboots."
fi
U=${SUDO_USER:-pi}; H=$(getent passwd "$U" | cut -d: -f6)
C=$(ls -d "$H"/.config/chromium/Default/Service\ Worker/CacheStorage 2>/dev/null || true)
[ -n "$C" ] && echo "Cached media on this Pi: $(du -sh "$C" | cut -f1)"
echo; echo "Logs: journalctl -u reboot-watcher -f"
