#!/usr/bin/env python3
"""
Condo Notice Board — Pi reboot watcher
======================================
Optional helper that lets you REBOOT a Raspberry Pi from the admin portal
(the browser can only *reload* the page by itself; a full OS reboot needs
this small script running on the Pi).

How it works:
  - Polls the public Firestore doc `commands/reboot-all` every 30s.
  - When its `ts` (timestamp) increases — i.e. an admin pressed "Reboot all
    TVs" in the portal — the Pi runs `sudo reboot`.
  - The timestamp seen at startup is remembered and ignored, so the Pi never
    reboots in a loop on boot.

Only a logged-in admin can write that doc (enforced by Firestore rules), so
only you can trigger a reboot. Reads are public, so this script needs no
credentials — just the project's public API key below.

Install (on each Pi), see pi/README.md for the copy-paste version.
"""
import json
import os
import subprocess
import time
import urllib.request

PROJECT_ID = "condo-notice-board"
API_KEY = "AIzaSyBmamgeL3fugc7jhnQ_DY7zUNF0eXbUz6Q"  # public Firebase web key (safe to ship)
# Watch the shared "reboot-all" command, plus an optional per-Pi command doc if
# you set CONDO_TV_ID (e.g. export CONDO_TV_ID=lobby) so you can reboot one TV.
DOC_IDS = ["reboot-all"]
if os.environ.get("CONDO_TV_ID"):
    DOC_IDS.append(os.environ["CONDO_TV_ID"])
POLL_SECONDS = 30

BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/commands"


def read_ts(doc_id):
    """Return the command's ts (int) or None if the doc doesn't exist / errors."""
    try:
        url = f"{BASE}/{doc_id}?key={API_KEY}&mask.fieldPaths=ts&mask.fieldPaths=action"
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.load(r)
        fields = data.get("fields", {})
        ts = fields.get("ts", {})
        # Firestore numbers come back as integerValue or doubleValue (strings)
        raw = ts.get("integerValue") or ts.get("doubleValue")
        action = fields.get("action", {}).get("stringValue", "")
        return (int(float(raw)) if raw is not None else None), action
    except Exception:
        return None, ""


def main():
    # Record the current timestamps so we don't reboot on the command already
    # sitting there when we start up.
    seen = {}
    for d in DOC_IDS:
        ts, _ = read_ts(d)
        seen[d] = ts or 0
    print(f"[reboot-watcher] started — watching {DOC_IDS}, baseline {seen}", flush=True)

    while True:
        time.sleep(POLL_SECONDS)
        for d in DOC_IDS:
            ts, action = read_ts(d)
            if ts is None:
                continue
            if ts > seen[d] and action in ("reboot", "reload"):
                print(f"[reboot-watcher] '{action}' command on '{d}' (ts={ts}) — rebooting now", flush=True)
                seen[d] = ts
                subprocess.run(["sudo", "reboot"])
                return
            seen[d] = max(seen[d], ts)


if __name__ == "__main__":
    main()
