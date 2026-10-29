"""cloth_part - draw a test pleated skirt fitted to the base body's hips, with sway poses.

  python tools/cloth_part.py client/public/assets/player_regions.png client/public/assets/head/skirt.png [--preview out.png]

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
from char_rig import FRAME  # noqa: E402
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('regions')
    ap.add_argument('out')
    ap.add_argument('--preview', help='the skirt over the body, every pose, 6x')
    ap.add_argument('--sheet', default='client/public/assets/player.png', help='body for the preview')
    a = ap.parse_args()

    reg = np.array(Image.open(a.regions).convert('RGBA'))
    sheet = np.zeros((POSES * FRAME, 4 * FRAME, 4), np.uint8)
    for v, r in enumerate(ROWS):
        frame = reg[r * FRAME:(r + 1) * FRAME, 0:FRAME]
        for p in range(POSES):
            sheet[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME] = skirt(frame, p)
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)

    if a.preview:
        body = np.array(Image.open(a.sheet).convert('RGBA'))
        img = Image.new('RGBA', (4 * FRAME, POSES * FRAME), (40, 44, 52, 255))
        for p in range(POSES):
            for v, r in enumerate(ROWS):
                at = (v * FRAME, p * FRAME)
                img.alpha_composite(Image.fromarray(body[r * FRAME:(r + 1) * FRAME, 0:FRAME]), at)
                img.alpha_composite(Image.fromarray(sheet[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME]), at)
        img.resize((img.width * 6, img.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
