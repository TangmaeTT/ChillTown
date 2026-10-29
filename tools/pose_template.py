"""pose_template - turn an Autosprite animation sheet into a 9-frame pose reference for ChatGPT.

  python tools/pose_template.py art-in/char/test-iso_walk_up-trimmed.png art-in/char/pose_n.png [--frames 8]
         [--scale 2.3] [--cell 256] [--cols 5]

ChatGPT then redraws the poses as our character (see design/avatar-system.md). Frame 1 is the frame with the feet
closest together (standing); then --frames frames picked evenly through the whole cycle. Every figure is scaled
by --scale with its feet on one line, one figure per cell, on magenta. ChatGPT draws our character at about the
size of the figures here, so use the same --scale for every direction and the sizes match.
"""
import argparse

import numpy as np
from PIL import Image

CELL_W, HEIGHT, FEET = 300, 900, 700      # output: 9 cells of 300 x 900 (3:1, the shape ChatGPT returns)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('out')
    ap.add_argument('--frames', type=int, default=8)
    ap.add_argument('--scale', type=float, default=2.3)
    ap.add_argument('--cell', type=int, default=256, help='Autosprite frame size')
    ap.add_argument('--cols', type=int, default=5)
    a = ap.parse_args()

    img = np.array(Image.open(a.sheet).convert('RGBA'))
    rows = img.shape[0] // a.cell
    cycle = []
    for k in range(rows * a.cols):
        r, c = divmod(k, a.cols)
        cell = img[r * a.cell:(r + 1) * a.cell, c * a.cell:(c + 1) * a.cell]
        ys, xs = np.nonzero(cell[..., 3] > 0)
        if len(ys):
            cycle.append(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1])

    def spread(f):
        feet = f[int(f.shape[0] * 0.85):, :, 3] > 0
        xs = np.nonzero(feet.any(0))[0]
        return xs.max() - xs.min() if len(xs) else 999
    n = len(cycle)
    seq = [min(cycle, key=spread)] + [cycle[round(k * n / a.frames)] for k in range(a.frames)]
    out = Image.new('RGB', (CELL_W * len(seq), HEIGHT), (255, 0, 255))
    for i, f in enumerate(seq):
        im = Image.fromarray(f).resize((round(f.shape[1] * a.scale), round(f.shape[0] * a.scale)), Image.NEAREST)
        out.paste(im, (i * CELL_W + (CELL_W - im.width) // 2, FEET - im.height), im)
    out.save(a.out)
    print(f'{n} frames in the cycle -> standing + {a.frames}; saved {a.out} {out.size}')


if __name__ == '__main__':
    main()
