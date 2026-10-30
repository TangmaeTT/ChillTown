"""hair_layer - cut a hairstyle out of an AI redraw and fit it onto every frame of the walk sheet.

  python tools/hair_layer.py art-in/char/codex_v62/stand_5dir.png art-in/char/codex_v62/stand_5dir_hair.png \
      godot/assets/characters/walk_v62.png godot/assets/characters/hair_messy.png

Inputs: the bald 5-direction standing sheet (S, SW, W, NW, N on magenta), the same sheet redrawn
with the hair added (same size and positions), and the game's walk sheet (tools/walk_sheet.py).
Hair = pixels of the redraw that are new or changed compared with the bald sheet, in the head
area. Like Ragnarok's headgear, it is drawn once per direction and placed on each frame by the
head: scaled by the head's width and pinned to the head's top centre, which follows the walk bob.
Writes a sheet the size of the walk sheet with only the hair, to draw over the body.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402
from strip_frames import head  # noqa: E402
from texture_from_ai import mode_downscale, split_parts  # noqa: E402

CELL = 96
ORDER = ['s', 'sw', 'w', 'nw', 'n']
# walk sheet rows E SE S SW W NW N NE -> (drawn direction, mirrored); same as walk_sheet.py
ROWS = [('w', True), ('sw', True), ('s', False), ('sw', False), ('w', False), ('nw', False), ('n', False), ('nw', True)]


def load(path):
    return pf.key_background(np.array(Image.open(path).convert('RGBA')), [255, 0, 255], 90)


def head_anchor(fig):
    """(top row, centre x, width) of the head: the top 45% of the figure's opaque pixels"""
    al = fig[..., 3] > 0
    top = int(np.nonzero(al.any(1))[0][0])
    x0, x1, mid = head(fig[top:])
    return top, mid, x1 - x0 + 1


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    bald_p, hair_p, sheet_p, out_p = sys.argv[1:]
    bald, hair = load(bald_p), load(hair_p)
    h, w = min(bald.shape[0], hair.shape[0]), min(bald.shape[1], hair.shape[1])
    bald, hair = bald[:h, :w], hair[:h, :w]

    parts = split_parts(np.maximum(bald[..., 3], hair[..., 3]), 20)
    if len(parts) != 5:
        sys.exit(f'expected 5 figures, found {len(parts)}: {parts}')
    layers = {}
    for (x0, x1), d in zip(parts, ORDER):
        b, r = bald[:, x0:x1], hair[:, x0:x1]
        ys = np.nonzero(b[..., 3].max(1))[0]
        btop, bh = ys[0], ys[-1] - ys[0] + 1
        diff = np.linalg.norm(r[..., :3].astype(float) - b[..., :3].astype(float), axis=-1)
        mask = (r[..., 3] > 0) & ((b[..., 3] == 0) | (diff > 60))
        mask[btop + int(bh * 0.58):] = False                  # hair stays on the head, not the body
        layer = np.zeros_like(r)
        layer[mask] = r[mask]
        top, mid, width = head_anchor(b)
        layers[d] = (layer, top, mid, width)

    sheet = np.array(Image.open(sheet_p).convert('RGBA'))
    out = np.zeros_like(sheet)
    cols = sheet.shape[1] // CELL
    for row, (d, mirror) in enumerate(ROWS):
        layer, top, mid, width = layers[d]
        for col in range(cols):
            cell = sheet[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL]
            if not cell[..., 3].any():
                continue
            ctop, cmid, cwidth = head_anchor(cell)
            k = cwidth / width
            ys, xs = np.nonzero(layer[..., 3])
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            src = layer[y0:y1, x0:x1]
            small = mode_downscale(src, max(1, round(src.shape[1] * k)), max(1, round(src.shape[0] * k)))
            # offset of the layer's corner from the head's top centre, in game pixels
            ox, oy = (x0 - mid) * k, (y0 - top) * k
            if mirror:
                small = small[:, ::-1]
                ox = -ox - small.shape[1]
            px, py = int(round(cmid + ox)), int(round(ctop + oy))
            dst = out[row * CELL:(row + 1) * CELL, col * CELL:(col + 1) * CELL]
            for yy in range(small.shape[0]):
                for xx in range(small.shape[1]):
                    if small[yy, xx, 3] and 0 <= py + yy < CELL and 0 <= px + xx < CELL:
                        dst[py + yy, px + xx] = small[yy, xx]
    out = pf.reduce_colours(out, 12)
    Image.fromarray(out).save(out_p)
    print(f'saved {out_p}')


if __name__ == '__main__':
    main()
