#!/bin/bash
# Install (or update) the reboot watcher on a Raspberry Pi:
#   cd pi-scripts && sudo bash install.sh
# Safe to re-run; replaces an older reboot-watcher if one is installed.
set -e
cd "$(dirname "$0")"
mkdir -p /opt/condo-notice-board
install -m 755 reboot-watcher.sh /opt/condo-notice-board/reboot-watcher.sh
install -m 644 reboot-watcher.service /etc/systemd/system/reboot-watcher.service
systemctl daemon-reload
systemctl enable reboot-watcher
systemctl restart reboot-watcher
sleep 2
systemctl status reboot-watcher --no-pager | head -n 5
echo "Logs: journalctl -u reboot-watcher -f"
