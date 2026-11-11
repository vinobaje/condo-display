#!/bin/bash
# Install the reboot watcher on a Raspberry Pi
# Run: sudo bash install.sh

set -e

echo "=== Installing Condo Notice Board Reboot Watcher ==="

# Create install directory
mkdir -p /opt/condo-notice-board

# Copy script
cp reboot-watcher.sh /opt/condo-notice-board/
chmod +x /opt/condo-notice-board/reboot-watcher.sh

# Install systemd service
cp reboot-watcher.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable reboot-watcher
systemctl start reboot-watcher

echo ""
echo "=== Done! ==="
echo "Service status:"
systemctl status reboot-watcher --no-pager
echo ""
echo "View logs: journalctl -u reboot-watcher -f"
