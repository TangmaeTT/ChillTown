"""cloth_part - draw test clothing parts fitted to the base body: a pleated skirt (with sway poses) or a hood.

  python tools/cloth_part.py skirt client/public/assets/head/skirt.png [--preview out.png]
  python tools/cloth_part.py hood client/public/assets/head/hood.png [--preview out.png]

Hood: bunched at the back of the neck, one row (no poses); drawn behind the body when facing the camera and
over the upper back when facing away (slot "hood"). Greys; the game recolours it to the top's colour.

Skirt:
From the region map (tools/body_regions.py) of the standing frame of each part view (rows 1, 3, 5, 7), the skirt
starts one row above the trousers (covering the waist) and flares out to just below the knee. Rows are POSES
poses with the hem swung from screen-left to screen-right, chosen by a spring in the game ("sway" in parts.json),
and it follows the waist ("anchor": "waist"). Greys; the game recolours it to the bottom's colour.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME, head_box  # noqa: E402
from body_regions import REGIONS, KNEE  # noqa: E402
from hair_part import GREYS, POSES  # noqa: E402

ROWS = [1, 3, 5, 7]
FLARE = 2          # px wider each side at the hem
SWING = 2          # px the hem moves per pose step
BELOW_KNEE = 0


def skirt(reg, pose):
    pants = (reg[..., :3] == REGIONS['pants']).all(2) & (reg[..., 3] > 0)
    shin = (reg[..., :3] == REGIONS['shin']).all(2) & (reg[..., 3] > 0)
    ys, xs = np.nonzero(pants | shin)
    y0 = int(ys.min())
    hem = y0 + KNEE + BELOW_KNEE
    xl, xr = xs[ys == y0].min(), xs[ys == y0].max()
    s = pose - POSES // 2
    m = np.zeros(reg.shape[:2], bool)
    for y in range(y0 - 1, hem + 1):
        u = max(0, (y - y0) / (hem - y0))
        shift = round(s * SWING * u ** 1.5)
        a, b = round(xl - FLARE * u) + shift, round(xr + FLARE * u) + shift
        m[y, a:b + 1] = True
    out = np.zeros(reg.shape[:2] + (4,), np.uint8)
    for y, x in zip(*np.nonzero(m)):
        u = (x - xl) / max(xr - xl, 1)
        k = 3 if u < 0.35 else 2 if u < 0.75 else 1          # lit from the left
        if (x - xl) % 3 == 2 and y > y0:
            k = max(1, k - 1)                                 # pleats
        if y == y0 - 1:
            k = 1                                             # waistband
        edge = any(not (0 <= y + dy < FRAME and 0 <= x + dx < FRAME and m[y + dy, x + dx]) for dy, dx in ((0, -1), (0, 1), (1, 0)))
        g = GREYS[0] if edge else GREYS[k]
        out[y, x] = (g, g, g, 255)
    return out


def hood(f, view):
    """a hood bunched at the back of the neck: behind the head when facing us (the game draws it behind the
    body), lying on the upper back when facing away (drawn over the body, so it stays below the head)"""
    x, y, w, h = head_box(f)
    neck = y + h
    out = np.zeros(f.shape[:2] + (4,), np.uint8)
    away = view >= 2
    if away:
        cx, cy, rx, ry = x + w / 2, neck + 2, w * 0.4, 5.5
    else:
        back = -1 if view == 0 else 1                         # SE faces right, so its back is to the left
        cx, cy, rx, ry = x + w / 2 + back * 4, neck - 3, w * 0.5, 6.5
    jj, ii = np.mgrid[:FRAME, :FRAME]
    m = ((ii - cx) / rx) ** 2 + ((jj - cy) / ry) ** 2 <= 1
    if away:
        m &= jj >= neck - 1                                    # never over the head
        opening = ((ii - cx) / (rx * 0.6)) ** 2 + ((jj - (cy - 2.5)) / 2.2) ** 2 <= 1
    else:
        opening = np.zeros_like(m)
    for j, i in zip(*np.nonzero(m)):
        u = (i - (cx - rx)) / (2 * rx)
        k = 3 if u < 0.35 else 2 if u < 0.7 else 1             # lit from the left
        if opening[j, i]:
            k = 1                                              # the inside of the hood
        edge = any(not (0 <= j + dy < FRAME and 0 <= i + dx < FRAME and m[j + dy, i + dx])
                   for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)))
        g = GREYS[0] if edge else GREYS[k]
        out[j, i] = (g, g, g, 255)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('kind', choices=['skirt', 'hood'])
    ap.add_argument('out')
    ap.add_argument('--regions', default='client/public/assets/player_regions.png', help='region map (skirt)')
    ap.add_argument('--sheet', default='client/public/assets/player.png', help='the body')
    ap.add_argument('--preview', help='the part over the body, every pose, 6x')
    a = ap.parse_args()

    body = np.array(Image.open(a.sheet).convert('RGBA'))
    reg = np.array(Image.open(a.regions).convert('RGBA'))
    poses = POSES if a.kind == 'skirt' else 1
    sheet = np.zeros((poses * FRAME, 4 * FRAME, 4), np.uint8)
    for v, r in enumerate(ROWS):
        sl = np.s_[r * FRAME:(r + 1) * FRAME, 0:FRAME]
        for p in range(poses):
            at = np.s_[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME]
            sheet[at] = skirt(reg[sl], p) if a.kind == 'skirt' else hood(body[sl], v)
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)

    if a.preview:
        img = Image.new('RGBA', (4 * FRAME, poses * FRAME), (40, 44, 52, 255))
        for p in range(poses):
            for v, r in enumerate(ROWS):
                at = (v * FRAME, p * FRAME)
                part = Image.fromarray(sheet[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME])
                behind = a.kind == 'hood' and v < 2
                if behind:
                    img.alpha_composite(part, at)
                img.alpha_composite(Image.fromarray(body[r * FRAME:(r + 1) * FRAME, 0:FRAME]), at)
                if not behind:
                    img.alpha_composite(part, at)
        img.resize((img.width * 6, img.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
