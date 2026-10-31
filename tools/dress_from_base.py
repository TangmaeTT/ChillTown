"""dress_from_base - put a strap dress on the underwear base walk sheet, the same in every frame.

  python tools/dress_from_base.py godot/assets/characters/walk_v62_under.png out.png [--len 11]

Nothing is redrawn per frame, so nothing flickers:
  - bodice: the base's tank top pixels (and the bare waist under it) take the dress colours,
    keeping the tank's light/dark, so it follows the body exactly;
  - skirt: one shape (hip width, flaring by FLARE px per row, --len rows long) anchored on
    each frame's hips; it widens to cover the legs when they spread in a stride, has a darker
    hem, soft folds and the sheet's black outline; legs below the hem and the shoes stay;
  - hands and arms beside the hips are pasted back over the skirt.
"""
import argparse

import numpy as np
from PIL import Image

CELL = 96
SHOE = 6
OUTLINE = (24, 13, 12)
# dusty rose, light -> dark
ROSE = [(240, 190, 186), (222, 160, 160), (200, 134, 138), (170, 108, 116)]
FLARE = 0.5


def shade(lum):
    for th, c in zip((235, 215, 190), ROSE):
        if lum >= th:
            return c
    return ROSE[-1]


def masks(px):
    rgb = px[..., :3].astype(int)
    a = px[..., 3] > 0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    tank = a & (mn > 170) & (r - b < 20)
    boxer = a & (mx >= 40) & (mx <= 100) & (mx - mn <= 16)
    skin = a & (r - b >= 50) & (r > 200)
    # shoes and the eyes share these colours: keep tank/boxers to the body rows above the shoes
    for x in range(CELL):
        col = np.nonzero(a[:, x])[0]
        if len(col):
            tank[col[-1] - SHOE + 1:, x] = False
            boxer[col[-1] - SHOE + 1:, x] = False
    # the tank is the biggest unbroken block of light rows; boxers start below its upper part
    # (the eyes are charcoal too)
    rows = np.nonzero(tank.sum(1) >= 4)[0]
    if len(rows):
        blocks = np.split(rows, np.nonzero(np.diff(rows) > 2)[0] + 1)
        block = max(blocks, key=lambda b: tank[b].sum())
        tank[:block[0] - 1] = False
        tank[block[-1] + 2:] = False
        boxer[:block[0] + (block[-1] - block[0]) // 2] = False
    return tank, boxer, skin, a


def dress_cell(cell, length):
    src = cell.copy()
    px = cell.copy()
    tank, boxer, skin, alpha = masks(px)
    brows = np.nonzero(boxer.sum(1) >= 3)[0]
    trows = np.nonzero(tank.sum(1) >= 3)[0]
    if len(brows) == 0 or len(trows) == 0:
        return px
    y0 = brows[0]                                   # waistband row
    hx = np.nonzero(boxer[y0])[0]
    hl, hr = hx[0], hx[-1]
    cx = (hl + hr) / 2

    # bodice: tank -> rose; bare waist between tank hem and waistband -> rose (torso columns only)
    for y, x in zip(*np.nonzero(tank)):
        px[y, x, :3] = shade(px[y, x, :3].mean())
    t1 = trows[-1]
    tx = np.nonzero(tank[t1])[0]
    for y in range(t1 + 1, y0):
        for x in range(tx[0], tx[-1] + 1):
            if skin[y, x]:
                px[y, x, :3] = ROSE[1] if y < y0 - 1 else ROSE[2]

    # skirt rows: hips flaring out, at least as wide as the legs at that row
    body = boxer | skin
    span = {}
    for i, y in enumerate(range(y0, y0 + length)):
        hw = (hr - hl) / 2 + 1 + i * FLARE
        l, r = int(round(cx - hw)), int(round(cx + hw))
        legs = np.nonzero(body[y, hl - 4:hr + 5])[0] + hl - 4 if y < CELL else []
        if len(legs) and i > 2:
            l, r = min(l, legs[0]), max(r, legs[-1])
        span[y] = (max(l, 1), min(r, CELL - 2))
    last = y0 + length - 1
    for y, (l, r) in span.items():
        for x in range(l, r + 1):
            if x == l or x == r or y == last:
                c = OUTLINE
            elif y == last - 1:
                c = ROSE[3]
            elif (x - l) % 3 == 0 and y > y0 + 2:
                c = ROSE[2]                          # soft folds
            elif x - l <= 1:
                c = ROSE[0]                          # light from the left
            elif r - x <= 1:
                c = ROSE[2]
            else:
                c = ROSE[1]
            px[y, x, :3] = c
            px[y, x, 3] = 255
        if y == y0:
            for x in range(l + 1, r):
                px[y, x, :3] = ROSE[3]               # waist seam

    # the dress covers the boxers wherever they still show (a leg lifted out of the skirt shape)
    for y, x in zip(*np.nonzero(boxer)):
        if y < y0 or (y in span and not span[y][0] <= x <= span[y][1]):
            px[y, x, :3] = ROSE[2]

    # hands and arms beside the hips stay in front of the skirt
    for y in range(y0, min(y0 + 6, last)):
        l, r = span[y]
        for x in range(l - 1, r + 2):
            if x < hl - 1 or x > hr + 1:
                if alpha[y, x] and not boxer[y, x]:
                    px[y, x] = src[y, x]
    return px


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--len', type=int, default=11, help='skirt length in rows from the waist')
    a = ap.parse_args()
    im = np.array(Image.open(a.src).convert('RGBA'))
    out = im.copy()
    for r in range(im.shape[0] // CELL):
        for c in range(im.shape[1] // CELL):
            sl = (slice(r * CELL, (r + 1) * CELL), slice(c * CELL, (c + 1) * CELL))
            out[sl] = dress_cell(im[sl], a.len)
    Image.fromarray(out).save(a.dst)
    print('wrote', a.dst)


if __name__ == '__main__':
    main()
