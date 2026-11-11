#!/usr/bin/env python3
"""Patch ~/kiosk.sh so the TV page gets a permanent ID from the Pi's serial number.

- removes --incognito (it wipes the media cache and the TV's ID on every restart)
- changes URL="https://condo-notice-board.web.app" to add ?tvid=<last 8 hex of the serial>
Safe to run repeatedly. Usage: python3 patch-kiosk.py FILE [FILE...]
"""
import re, sys

TVID = "?tvid=$(awk '/^Serial/{print substr($3, length($3)-7)}' /proc/cpuinfo)"

for path in sys.argv[1:]:
    try:
        s = open(path).read()
    except FileNotFoundError:
        continue
    orig = s
    s = re.sub(r'^[ \t]*--incognito \\\n', '', s, flags=re.M)
    if 'tvid=' not in s:
        s = re.sub(r'^URL="(https://condo-notice-board\.web\.app)/?"[ \t]*$',
                   lambda m: f'URL="{m.group(1)}/{TVID}"', s, flags=re.M)
    if s != orig:
        open(path + '.bak-tvid', 'w').write(orig)
        open(path, 'w').write(s)
        print(f"patched {path}")
    else:
        print(f"already ok {path}")
    if 'tvid=' not in s:
        print(f"WARNING: no URL= line found in {path} — TV ID not set")
