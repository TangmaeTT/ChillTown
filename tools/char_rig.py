"""char_rig - measure a player sheet for the avatar system: where the head is in every frame, and the skin colours.

  python tools/char_rig.py client/public/assets/player.png [--debug out.png]

Writes client/src/model/player_rig.json:
  box:    per direction row, the head box in the standing frame (col 0): [x, y, w, h] in frame px
  offset: per row, per column, [dx, dy] of the head against the standing frame (walk bob and sway)
  skin:   the sheet's skin colours ('#rrggbb'), which the game recolours to the chosen skin tone
Head parts (face, hair, hats) are drawn on the standing frame of each view and moved by offset in the game.
Run it again whenever player.png changes (after tools/char_sheet.py).

The head is the top of the figure down to the neck (the first row under the widest part that is
much narrower). Offsets come from matching that head region of the standing frame against each frame.
"""
import argparse
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image

FRAME = 68
SEARCH = 4          # px each way
OUT = Path(__file__).parent.parent / 'client/src/model/player_rig.json'


def head_box(f):
    a = f[..., 3] > 0
    ys, xs = np.nonzero(a)
    top = ys.min()
    widths = a.sum(1)
    peak = top + int(np.argmax(widths[top:top + 40]))
    neck = next((y for y in range(peak, ys.max()) if widths[y] < 0.7 * widths[peak]), peak + 4)
    cols = np.nonzero(a[top:neck].any(0))[0]
    return [int(cols.min()), int(top), int(cols.max() - cols.min() + 1), int(neck - top)]


def skin_colours(img):
    """warm, mid-saturated, light colours: faces and hands (tested on the Autosprite sheet; check with --debug)"""
    out = []
    for c in {tuple(p[:3]) for p in img.reshape(-1, 4) if p[3] > 0}:
        h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in c])
        if 10 / 360 <= h <= 40 / 360 and 0.15 <= s <= 0.65 and v >= 0.6:
            out.append('#%02x%02x%02x' % c)
    return sorted(out)


def match(ref, f, box):
    x, y, w, h = box
    tpl = ref[y:y + h, x:x + w].astype(np.int32)
    pad = np.zeros((FRAME + 2 * SEARCH, FRAME + 2 * SEARCH, 4), np.int32)
    pad[SEARCH:SEARCH + FRAME, SEARCH:SEARCH + FRAME] = f
    best, at = None, (0, 0)
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            win = pad[SEARCH + y + dy:SEARCH + y + dy + h, SEARCH + x + dx:SEARCH + x + dx + w]
            # alpha mismatch counts most; colour inside the head second
            err = np.abs(win[..., 3] - tpl[..., 3]).sum() * 2 + np.abs(win[..., :3] - tpl[..., :3]).sum()
            # prefer no movement when two offsets tie
            err += (abs(dx) + abs(dy)) * 50
            if best is None or err < best:
                best, at = err, (dx, dy)
    return list(at)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--debug', help='write a sheet with the head box drawn on every frame and skin in magenta')
    args = ap.parse_args()

    img = np.array(Image.open(args.sheet).convert('RGBA'))
    rows, cols = img.shape[0] // FRAME, img.shape[1] // FRAME
    frame = lambda r, c: img[r * FRAME:(r + 1) * FRAME, c * FRAME:(c + 1) * FRAME]

    boxes, offsets = [], []
    for r in range(rows):
        ref = frame(r, 0)
        box = head_box(ref)
        boxes.append(box)
        offsets.append([match(ref, frame(r, c), box) for c in range(cols)])
        print(f'row {r}: head {box}  dy {[o[1] for o in offsets[-1]]}  dx {[o[0] for o in offsets[-1]]}')

    skin = skin_colours(img)
    print('skin', skin)
    OUT.write_text(json.dumps({'frame': FRAME, 'box': boxes, 'offset': offsets, 'skin': skin}, separators=(',', ':')) + '\n')
    print('wrote', OUT)

    if args.debug:
        hexes = np.array(['#%02x%02x%02x' % tuple(p) for p in img[..., :3].reshape(-1, 3)]).reshape(img.shape[:2])
        shown = img.copy()
        shown[np.isin(hexes, skin) & (img[..., 3] > 0)] = (255, 0, 255, 255)
        dbg = Image.fromarray(shown).copy()
        px = dbg.load()
        for r in range(rows):
            x, y, w, h = boxes[r]
            for c in range(cols):
                dx, dy = offsets[r][c]
                ox, oy = c * FRAME + x + dx, r * FRAME + y + dy
                for i in range(w):
                    px[ox + i, oy] = px[ox + i, oy + h - 1] = (0, 255, 255, 255)
                for j in range(h):
                    px[ox, oy + j] = px[ox + w - 1, oy + j] = (0, 255, 255, 255)
        dbg.resize((dbg.width * 2, dbg.height * 2), Image.NEAREST).save(args.debug)


if __name__ == '__main__':
    main()
