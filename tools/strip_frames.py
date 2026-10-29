"""strip_frames - cut a row of animation frames (ChatGPT, after pixelfix) into game frames and check them.

  python tools/strip_frames.py walk_s.png out.png [--cell 96] [--gif out.gif] [--fps 8] [--ref base.png]

Splits the row on empty columns, puts every frame in a cell (feet on one line, centred on the head), and reports
how much the head wanders between frames (an AI draws each frame a little differently: a steady walk keeps the
head within ~1 px). --ref: a standing frame of the same view (e.g. from the base sheet) to compare sizes with.
"""
import argparse

import numpy as np
from PIL import Image

FEET = 0.92        # feet line as a fraction of the cell height


def split(a):
    al = a[..., 3] > 0
    cols = np.nonzero(al.any(0))[0]
    gaps = np.nonzero(np.diff(cols) > 2)[0]
    starts = [cols[0]] + list(cols[gaps + 1])
    ends = list(cols[gaps]) + [cols[-1]]
    out = []
    for s, e in zip(starts, ends):
        f = a[:, s:e + 1]
        ys = np.nonzero((f[..., 3] > 0).any(1))[0]
        out.append(f[ys[0]:ys[-1] + 1])
    return out


def head(f):
    """the top 45% of the figure: its box [x0, x1, top] and the middle x"""
    al = f[..., 3] > 0
    h = int(al.shape[0] * 0.45)
    xs = np.nonzero(al[:h].any(0))[0]
    return xs[0], xs[-1], (xs[0] + xs[-1]) / 2


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('strip')
    ap.add_argument('out')
    ap.add_argument('--cell', type=int, default=96)
    ap.add_argument('--gif')
    ap.add_argument('--fps', type=float, default=8)
    ap.add_argument('--ref')
    a = ap.parse_args()

    frames = split(np.array(Image.open(a.strip).convert('RGBA')))
    c = a.cell
    sheet = np.zeros((c, c * len(frames), 4), np.uint8)
    heads = []
    for k, f in enumerate(frames):
        x0, x1, mid = head(f)
        heads.append((x1 - x0 + 1, f.shape[0], mid - f.shape[1] / 2))
        top = int(c * FEET) - f.shape[0]
        left = int(round(c / 2 - mid))
        h, w = f.shape[:2]
        sheet[top:top + h, k * c + left:k * c + left + w] = f
    widths = [h[0] for h in heads]
    heights = [h[1] for h in heads]
    print(f'{len(frames)} frames · height {min(heights)}-{max(heights)} px · head width {min(widths)}-{max(widths)} px')
    print('  height per frame:', heights, '(head bob: a steady walk changes this by 0-2)')
    print('  head width per frame:', widths, '(the same head should keep the same width)')
    if a.ref:
        r = np.array(Image.open(a.ref).convert('RGBA'))
        ys = np.nonzero((r[..., 3] > 0).any(1))[0]
        print(f'  reference standing height {ys[-1] - ys[0] + 1} px, head width {head(r[ys[0]:ys[-1] + 1])[1] - head(r[ys[0]:ys[-1] + 1])[0] + 1} px')
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)
    if a.gif:
        big = [Image.fromarray(sheet[:, k * c:(k + 1) * c]).resize((c * 4, c * 4), Image.NEAREST) for k in range(len(frames))]
        bgs = []
        for im in big:
            bg = Image.new('RGBA', im.size, (40, 44, 52, 255))
            bg.alpha_composite(im)
            bgs.append(bg.convert('P', palette=Image.ADAPTIVE))
        bgs[0].save(a.gif, save_all=True, append_images=bgs[1:], duration=int(1000 / a.fps), loop=0)
        print('saved', a.gif)


if __name__ == '__main__':
    main()
