"""head_parts - helpers for drawing avatar head parts (client/public/assets/head/<id>.png).

  python tools/head_parts.py template art-in/head/template.png     template to draw parts on
  python tools/head_parts.py preview out.png beanie round_glasses   parts worn on the player, every frame
  python tools/head_parts.py demo                                   redraw the two test parts

A part is 4 cells of 68x68 in one row: the standing frame facing SE, SW, NW, NE (player.png rows 1, 3, 5, 7).
Draw it in place over the template (one Aseprite layer per part, the template layer hidden on export);
the game moves it with the head every frame using client/src/model/player_rig.json.
A part with a tint in shared/avatar.ts is recoloured by brightness, so draw it in greys: darkest = outline.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
SHEET = ROOT / 'client/public/assets/player.png'
RIG = ROOT / 'client/src/model/player_rig.json'
HEAD = ROOT / 'client/public/assets/head'
F = 68
VIEW_ROWS = [1, 3, 5, 7]                 # SE, SW, NW, NE
VIEW_OF_ROW = [0, 0, 1, 1, 1, 2, 3, 3]


def frame(img, r, c):
    return img.crop((c * F, r * F, (c + 1) * F, (r + 1) * F))


def template(out):
    img = Image.open(SHEET).convert('RGBA')
    rig = json.loads(RIG.read_text())
    t = Image.new('RGBA', (4 * F, F))
    for v, r in enumerate(VIEW_ROWS):
        f = frame(img, r, 0)
        a = np.array(f)
        a[..., 3] = a[..., 3] // 2          # faded so new strokes stand out
        f = Image.fromarray(a)
        px = f.load()
        x, y, w, h = rig['box'][r]
        for i in range(x, x + w):           # head box guide (corners only)
            for j in (y, y + h - 1):
                if i - x < 3 or x + w - 1 - i < 3:
                    px[i, j] = (0, 255, 255, 255)
        t.alpha_composite(f, (v * F, 0))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    t.save(out)
    print('wrote', out)


def preview(out, ids):
    img = Image.open(SHEET).convert('RGBA')
    rig = json.loads(RIG.read_text())
    parts = [Image.open(HEAD / f'{i}.png').convert('RGBA') for i in ids]
    rows, cols = img.height // F, img.width // F
    sheet = Image.new('RGBA', img.size, (40, 44, 52, 255))
    for r in range(rows):
        for c in range(cols):
            cell = Image.new('RGBA', (F, F))
            cell.alpha_composite(frame(img, r, c))
            dx, dy = rig['offset'][r][c]
            for p in parts:
                cell.alpha_composite(frame(p, 0, VIEW_OF_ROW[r]), (dx, dy))
            sheet.alpha_composite(cell, (c * F, r * F))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(out)
    print('wrote', out)


# --- the two test parts, drawn from the player's own silhouette so they fit any sheet roughly

GREYS = {'outline': 30, 'dark': 85, 'mid': 140, 'light': 190, 'shine': 235}


def beanie(stand, back):
    """knitted beanie: dome over the top of the head, ribbed cuff, light from the top-left"""
    m = np.array(stand)[..., 3] > 0
    ys, xs = np.nonzero(m)
    top = ys.min()
    cuff = top + (17 if back else 14)                       # bottom row of the hat
    body = [np.nonzero(m[y])[0] for y in range(cuff - 6, cuff + 1)]
    x0 = min(r.min() for r in body if len(r)) - 1
    x1 = max(r.max() for r in body if len(r)) + 1
    cx, hw, H = (x0 + x1) / 2, (x1 - x0) / 2, cuff - top - 1
    a = np.zeros((F, F), np.uint8)
    for y in range(top + 1, cuff + 1):
        k = (cuff - 3 - y) / (H - 3)
        w = hw if k <= 0 else hw * np.sqrt(max(0.0, 1 - k * k))
        for x in range(int(round(cx - w)), int(round(cx + w)) + 1):
            # shade by distance from the top-left light
            d = ((x - (cx - hw * 0.4)) / hw) + ((y - top) / H) * 0.8
            tone = 'light' if d < 0.45 else 'mid' if d < 1.15 else 'dark'
            if y > cuff - 4:                                # cuff: ribs every other column
                tone = 'mid' if (x % 2 or tone == 'dark') else 'light'
                if y == cuff - 3:
                    tone = 'dark'
            a[y, x] = GREYS[tone]
    # 1 px outline round the shape
    inside = a > 0
    out = np.zeros_like(inside)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        out |= np.roll(np.roll(inside, dy, 0), dx, 1)
    a[out & ~inside] = GREYS['outline']
    rgba = np.zeros((F, F, 4), np.uint8)
    rgba[..., :3] = a[..., None]
    rgba[..., 3] = (a > 0) * 255
    return Image.fromarray(rgba)


def round_glasses(stand, back):
    """two round-ish lenses over the eyes; nothing from behind"""
    rgba = np.zeros((F, F, 4), np.uint8)
    if back:
        return Image.fromarray(rgba)
    o, s = GREYS['outline'], GREYS['shine']
    lens = ['.oooo.', 'o....o', 'o....o', 'o....o', '.oooo.']
    for lx in (24, 37):
        for j, row in enumerate(lens):
            for i, ch in enumerate(row):
                if ch == 'o':
                    rgba[29 + j, lx + i] = (o, o, o, 255)
        rgba[30, lx + 1] = (s, s, s, 255)                  # glint, top-left
        rgba[30, lx + 2] = (s, s, s, 160)
    for x in list(range(30, 37)) + [22, 23, 43, 44]:      # bridge and arms
        rgba[30, x] = (o, o, o, 255)
    return Image.fromarray(rgba)


def demo():
    img = Image.open(SHEET).convert('RGBA')
    HEAD.mkdir(parents=True, exist_ok=True)
    for name, draw in (('beanie', beanie), ('round_glasses', round_glasses)):
        out = Image.new('RGBA', (4 * F, F))
        for v, r in enumerate(VIEW_ROWS):
            out.alpha_composite(draw(frame(img, r, 0), v >= 2), (v * F, 0))
        out.save(HEAD / f'{name}.png')
        print('wrote', HEAD / f'{name}.png')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('template').add_argument('out')
    p = sub.add_parser('preview')
    p.add_argument('out')
    p.add_argument('ids', nargs='+')
    sub.add_parser('demo')
    args = ap.parse_args()
    if args.cmd == 'template':
        template(args.out)
    elif args.cmd == 'preview':
        preview(args.out, args.ids)
    else:
        demo()


if __name__ == '__main__':
    main()
