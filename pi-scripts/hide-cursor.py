#!/usr/bin/env python3
"""Hide the mouse cursor on a Wayland (labwc) kiosk Pi.

Chromium only applies the page's `cursor:none` after the mouse moves, and on a kiosk it
never moves — so the compositor's arrow stays in the corner. This installs a fully
transparent cursor theme (~/.icons/blank-cursor) and points labwc at it via
XCURSOR_THEME in ~/.config/labwc/environment. Takes effect after a reboot.
Usage: python3 hide-cursor.py HOME_DIR      (safe to run repeatedly)
"""
import os, struct, sys

home = sys.argv[1]
theme = os.path.join(home, '.icons', 'blank-cursor')
cursors = os.path.join(theme, 'cursors')
os.makedirs(cursors, exist_ok=True)

# Xcursor file: one 24x24 fully transparent image (little-endian, see Xcursor(3))
W = H = 24
IMG_TYPE = 0xfffd0002
data = b'Xcur' + struct.pack('<III', 16, 0x10000, 1)          # file header, 1 TOC entry
data += struct.pack('<III', IMG_TYPE, 24, 16 + 12)             # TOC: type, nominal size, offset
data += struct.pack('<IIIIIIIII', 36, IMG_TYPE, 24, 1, W, H, 0, 0, 0)  # image chunk header
data += b'\0' * (W * H * 4)                                    # ARGB pixels, all transparent
with open(os.path.join(cursors, 'left_ptr'), 'wb') as f:
    f.write(data)

NAMES = """default arrow top_left_arrow text xterm ibeam pointer hand hand1 hand2 grab grabbing
openhand closedhand wait watch progress left_ptr_watch crosshair cross tcross move fleur
all-scroll not-allowed no-drop help question_arrow context-menu cell copy alias
col-resize row-resize n-resize s-resize e-resize w-resize ne-resize nw-resize se-resize
sw-resize ew-resize ns-resize nesw-resize nwse-resize sb_h_double_arrow sb_v_double_arrow
size_hor size_ver size_bdiag size_fdiag top_side bottom_side left_side right_side
top_left_corner top_right_corner bottom_left_corner bottom_right_corner X_cursor
pirate zoom-in zoom-out vertical-text""".split()
for n in NAMES:
    p = os.path.join(cursors, n)
    if os.path.lexists(p):
        os.remove(p)
    os.symlink('left_ptr', p)

with open(os.path.join(theme, 'index.theme'), 'w') as f:
    f.write('[Icon Theme]\nName=blank-cursor\nComment=Transparent cursor for kiosk TVs\n')

# Point labwc (and everything it starts, incl. Chromium) at the blank theme
env_dir = os.path.join(home, '.config', 'labwc')
os.makedirs(env_dir, exist_ok=True)
env = os.path.join(env_dir, 'environment')
lines = open(env).read().splitlines() if os.path.exists(env) else []
lines = [l for l in lines if not l.startswith('XCURSOR_THEME=')] + ['XCURSOR_THEME=blank-cursor']
with open(env, 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f"cursor hidden: {theme} + XCURSOR_THEME in {env}")
