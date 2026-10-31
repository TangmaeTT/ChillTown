"""seal_facades - close the see-through edges of the Codex building textures.

  python tools/seal_facades.py                 # every building (city_convert FSR rules)
  python tools/seal_facades.py condo cafe      # just these

A building is a box, so its front/side/roof must be solid up to the box edge. The converted
Codex art isn't: removing the pink rim leaves dotted holes in the outline, and walls are a few
pixels narrower than their cornices. In game those pixels showed the sky and the next building
through every seam. This fills, in albedo and emission alike:
  1. small enclosed holes (dots in the outline), from the nearest solid pixel;
  2. on every wall row (a row whose solid span is nearly the full width), a margin of up to
     MAX_MARGIN px out to the texture edge: the outline pixel moves out to the edge and the wall colour fills in behind;
  3. on the roof, the same for columns too (seen from above it is a full rectangle).
The shopfront hole (a large enclosed area) and the shape above the wall rows (gables, water
tanks) are left alone. Safe to run again.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / 'godot' / 'assets' / 'textures'
BUILDINGS = ['shophouse_a', 'shophouse_b', 'shophouse_old', 'noodle_shop', 'mini_mart',
             'cafe', 'pharmacy', 'condo', 'gold_shop']
DOT_MAX = 40          # enclosed holes up to this many pixels are dots, not openings
WALL_SPAN = 0.85      # a row is wall when its solid span covers this much of the width
MAX_MARGIN = 4        # wider margins are real shape (balcony profiles, awnings), not gaps


def small_holes(solid):
    """Transparent 4-connected components that don't touch the border and are small."""
    h, w = solid.shape
    seen = solid.copy()
    out = np.zeros_like(solid)
    for y0, x0 in zip(*np.nonzero(~solid)):
        if seen[y0, x0]:
            continue
        comp, edge, q = [], False, deque([(y0, x0)])
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            if y in (0, h - 1) or x in (0, w - 1):
                edge = True
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if not edge and len(comp) <= DOT_MAX:
            for y, x in comp:
                out[y, x] = True
    return out


def fill_from_nearest(src, solid, target):
    """For each target pixel, the (y, x) of a nearby solid pixel, grown outward ring by ring."""
    h, w = solid.shape
    sy, sx = np.indices((h, w))
    have = solid.copy()
    todo = target & ~have
    while todo.any():
        grew = False
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.zeros_like(have)
            ys = slice(max(dy, 0), h + min(dy, 0))
            yd = slice(max(-dy, 0), h + min(-dy, 0))
            xs = slice(max(dx, 0), w + min(dx, 0))
            xd = slice(max(-dx, 0), w + min(-dx, 0))
            nb[yd, xd] = have[ys, xs]
            take = todo & nb
            if take.any():
                sy2 = np.zeros_like(sy); sx2 = np.zeros_like(sx)
                sy2[yd, xd] = sy[ys, xs]; sx2[yd, xd] = sx[ys, xs]
                sy[take] = sy2[take]; sx[take] = sx2[take]
                have |= take
                todo &= ~take
                grew = True
        if not grew:
            break
    return sy, sx


def edge_map(solid, axis_rows=True):
    """(y, x) source for the margins of each wall row (or wall column)."""
    s = solid if axis_rows else solid.T
    n, w = s.shape
    src = {}
    for i in range(n):
        xs = np.nonzero(s[i])[0]
        if len(xs) == 0 or xs[-1] - xs[0] + 1 < WALL_SPAN * w:
            continue
        a, b = xs[0], xs[-1]
        inner_a = a + 1 if a + 1 < w and s[i, a + 1] else a
        inner_b = b - 1 if b - 1 >= 0 and s[i, b - 1] else b
        if a <= MAX_MARGIN:
            for x in range(0, a):
                src[(i, x)] = (i, a) if x == 0 else (i, inner_a)
        if w - 1 - b <= MAX_MARGIN:
            for x in range(b + 1, w):
                src[(i, x)] = (i, b) if x == w - 1 else (i, inner_b)
    if not axis_rows:
        src = {(x, i): (sx, si) for (i, x), (si, sx) in src.items()}
    return src


def seal(name, view):
    pa = TEX / f'city_{name}_{view}_albedo.png'
    pe = TEX / f'city_{name}_{view}_emission.png'
    if not pa.exists():
        return 0
    alb = np.array(Image.open(pa).convert('RGBA'))
    emi = np.array(Image.open(pe).convert('RGBA')) if pe.exists() else None
    total = 0
    passes = [True, False] if view == 'roof' else [True]
    for _ in range(2):                       # margins can enclose new dots, so twice
        solid = alb[..., 3] >= 128
        dots = small_holes(solid)
        if dots.any():
            sy, sx = fill_from_nearest(alb, solid, dots)
            for img in (alb, emi):
                if img is not None:
                    img[dots] = img[sy[dots], sx[dots]]
            alb[dots, 3] = 255
            total += int(dots.sum())
        for rows in passes:
            solid = alb[..., 3] >= 128
            m = edge_map(solid, rows)
            for (y, x), (y2, x2) in m.items():
                for img in (alb, emi):
                    if img is not None:
                        img[y, x] = img[y2, x2]
                alb[y, x, 3] = 255
            total += len(m)
    Image.fromarray(alb).save(pa)
    if emi is not None:
        Image.fromarray(emi).save(pe)
    return total


def main():
    for name in sys.argv[1:] or BUILDINGS:
        n = {v: seal(name, v) for v in ('front', 'side', 'roof')}
        print(f'{name}: sealed ' + ', '.join(f'{v} {k} px' for v, k in n.items()))


if __name__ == '__main__':
    main()
