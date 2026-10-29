"""sway_poses - give a still head part (one row of 4 views) sway poses, for the spring in the game.

  python tools/sway_poses.py client/public/assets/head/hair_messy.png [out.png] [--poses 5] [--amount 2]
         [--preview out.png]

Pixel art can't be rotated, so each pose shears the part sideways by whole pixels: rows near the top of the part
(the roots, on the scalp) stay put, rows further down move more, up to --amount px at the lowest row (the tips).
Row 0 swings screen-left, the last row screen-right, the middle row is the part as drawn.
Writes over the input when no out is given. Then add "sway" to the part in shared/parts.json.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME  # noqa: E402

CURVE = 1.6     # >1: the roots stay still longer and the tips do most of the moving


def pose(view, s, amount):
    """view: one 68x68 part frame; s: -1 (left) .. 1 (right)"""
    ys = np.nonzero(view[..., 3].any(1))[0]
    if not len(ys):
        return view
    top, bottom = ys.min(), ys.max()
    out = np.zeros_like(view)
    for y in range(FRAME):
        u = (y - top) / max(bottom - top, 1)
        dx = int(round(s * amount * max(0, u) ** CURVE))
        out[y] = np.roll(view[y], dx, 0)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('part')
    ap.add_argument('out', nargs='?')
    ap.add_argument('--poses', type=int, default=5)
    ap.add_argument('--amount', type=float, default=2)
    ap.add_argument('--preview', help='every pose of every view side by side, 6x')
    a = ap.parse_args()

    img = np.array(Image.open(a.part).convert('RGBA'))
    # the part as drawn: its only row, or the middle row of a sheet this already made (so re-running is safe)
    m = (img.shape[0] // FRAME) // 2
    still = img[m * FRAME:(m + 1) * FRAME]
    mid = (a.poses - 1) / 2
    rows = []
    for p in range(a.poses):
        s = (p - mid) / mid if mid else 0
        rows.append(np.concatenate([pose(still[:, v * FRAME:(v + 1) * FRAME], s, a.amount) for v in range(still.shape[1] // FRAME)], 1))
    sheet = np.concatenate(rows, 0)
    Image.fromarray(sheet).save(a.out or a.part)
    print(f'saved {a.out or a.part}: {a.poses} poses, tips move up to {a.amount} px')

    if a.preview:
        pv = Image.new('RGBA', sheet.shape[1::-1], (40, 44, 52, 255))
        pv.alpha_composite(Image.fromarray(sheet))
        pv.resize((pv.width * 6, pv.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
