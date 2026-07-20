# Restarting the TVs from the admin portal

There are two levels of "restart", pick what you need:

## 1. Reload the display (no setup — already works)

In the admin dashboard, each TV in the **TV Displays** panel has a **↻ Reload**
button. Pressing it refreshes that TV's browser within a few seconds:

- unfreezes a stuck screen,
- reconnects to the server,
- pulls the latest code.

This is the browser refreshing itself — it needs nothing installed on the Pi and
covers almost every "please restart the TV" situation. (The display also
auto-reloads every 6 hours on its own.)

## 2. Full OS reboot (optional — needs this helper on each Pi)

A web page can't power-cycle the Pi's operating system by itself. If you want a
true `sudo reboot` (e.g. after a network outage or to clear a deeper hang),
install this small watcher on each Pi. Then a **Reboot all TVs** action in the
portal will reboot every Pi.

### Install (run once on each Pi)

```bash
# 1. Copy the script somewhere permanent
sudo mkdir -p /opt/condo-tv
sudo cp reboot-watcher.py /opt/condo-tv/
sudo chmod +x /opt/condo-tv/reboot-watcher.py

# 2. Allow the reboot without a password prompt (the 'pi' user)
echo 'pi ALL=(ALL) NOPASSWD: /sbin/reboot' | sudo tee /etc/sudoers.d/condo-tv-reboot

# 3. Run it as a background service that starts on boot
sudo tee /etc/systemd/system/condo-reboot-watcher.service >/dev/null <<'EOF'
[Unit]
Description=Condo TV reboot watcher
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/python3 /opt/condo-tv/reboot-watcher.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now condo-reboot-watcher
```

Check it's running: `systemctl status condo-reboot-watcher`

### Notes

- **Security:** only a logged-in admin can issue the reboot command (Firestore
  rules gate the write). The script only *reads* a public flag, so it needs no
  credentials.
- **No reboot loop:** the script remembers the command that's already there when
  it starts, and only acts on a *newer* one.
- **Per-TV reboot (optional):** set a stable id on a Pi with
  `export CONDO_TV_ID=lobby` (and add it to the service's environment) to also
  watch `commands/lobby`, so you can reboot that one TV.

Once the helper is installed on the Pis, tell me and I'll add the **Reboot all
TVs** button to the admin portal (it writes `commands/reboot-all`).
