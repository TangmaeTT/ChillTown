"""blank_face - paint the face off a player sheet, so face parts can be drawn on a blank head.

  python tools/blank_face.py client/public/assets/player.png out.png [--compare cmp.png]

Autosprite always draws a face, even from a faceless reference. In every frame this finds the head
(char_rig.head_box), then every pixel inside it that isn't skin and isn't on the outline (eyes, brows,
mouth) and fills it from the skin around it, snapped to the sheet's skin colours so shading stays.
--compare writes before/after side by side at 4x. Run tools/char_rig.py on the result afterwards.
"""
import argparse
import colorsys

import numpy as np
from PIL import Image

from char_rig import FRAME, head_box

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def skin_like(c):
    """skin and its shading: warm and saturated, or the pale highlight on top of the head.
    The greyish pinks (s < ~0.35) are the anti-aliasing around the eyes, so they get painted too."""
    h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in c])
    warm = h <= 40 / 360 or h >= 350 / 360
    return warm and v >= 0.55 and (0.36 <= s <= 0.75 or (v >= 0.9 and s >= 0.2))


def blank(f, skin_pal):
    a = f[..., 3] > 0
    if not a.any():
        return f, 0
    x, y, w, h = head_box(f)
    inner = a.copy()                                  # opaque with every neighbour opaque: not outline
    for dy, dx in N8:
        inner &= np.roll(np.roll(a, dy, 0), dx, 1)
    region = np.zeros_like(a)
    region[y:y + h, x:x + w] = True
    known = np.array([[skin_like(tuple(p[:3])) for p in row] for row in f])
    todo = inner & region & ~known
    # the brows leave darker skin strokes around the eyes: repaint everything within 2 px of the face too
    for _ in range(2):
        grown = todo.copy()
        for dy, dx in N8:
            grown |= np.roll(np.roll(todo, dy, 0), dx, 1)
        todo = grown & inner & region
    known &= ~todo
    out = f.astype(np.float32)
    count = int(todo.sum())
    while todo.any():
        filled = []
        for j, i in zip(*np.nonzero(todo)):
            nb = [out[j + dy, i + dx, :3] for dy, dx in N8 if known[j + dy, i + dx] and region[j + dy, i + dx]]
            if nb:
                filled.append((j, i, np.mean(nb, 0)))
        if not filled:
            break
        for j, i, c in filled:
            out[j, i, :3] = skin_pal[np.argmin(((skin_pal - c) ** 2).sum(1))]
            known[j, i], todo[j, i] = True, False
    return out.astype(np.uint8), count


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('out')
    ap.add_argument('--compare')
    a = ap.parse_args()

    img = np.array(Image.open(a.sheet).convert('RGBA'))
    cols = {tuple(p[:3]) for p in img.reshape(-1, 4) if p[3] > 0}
    skin_pal = np.array([c for c in cols if skin_like(c)], np.float32)
    print(f'{len(skin_pal)} skin colours of {len(cols)}')
    res = img.copy()
    for r in range(img.shape[0] // FRAME):
        counts = []
        for c in range(img.shape[1] // FRAME):
            sl = np.s_[r * FRAME:(r + 1) * FRAME, c * FRAME:(c + 1) * FRAME]
            res[sl], n = blank(img[sl], skin_pal)
            counts.append(n)
        print(f'row {r}: face px painted {counts}')
    Image.fromarray(res).save(a.out)
    print('saved', a.out)
    if a.compare:
        both = np.concatenate([img, res], 1)
        Image.fromarray(both).resize((both.shape[1] * 4, both.shape[0] * 4), Image.NEAREST).save(a.compare)


if __name__ == '__main__':
    main()
