"""cloth_layer - fit an AI-drawn "clothes only" picture onto every frame of the underwear walk sheet.

  python tools/cloth_layer.py art-in/char/codex_v62/stand_5dir.png art-in/char/codex_v62/cloth_only_puffdress.png \
      godot/assets/characters/walk_v62_under.png godot/assets/characters/walk_v62_puffdress.png

Inputs: the base standing sheet (5 directions on magenta: S, SW, W, NW, N), the clothes alone
drawn by Codex on the same canvas (prompt: art-in/char/codex_v62/prompt_puffdress_only.txt),
and the game's underwear walk sheet. Like the hair, the clothes are drawn once per direction:
  1. each direction's clothes are scaled by the head width (same as tools/hair_layer.py) and
     placed on that row's standing frame by the head;
  2. they are cut at the standing frame's waist into a top piece (bodice, collar, sleeves) and
     a skirt piece;
  3. on every walk frame the top piece follows the torso (tank top's top centre) and the
     skirt follows the waistband (down) and the torso (sideways), so the pattern never changes between frames;
  4. the base's hands and forearms beside the hips are pasted back over the skirt, and the
     head is drawn over the collar (the chin hides its top edge, as in the AI drawing).
Writes a whole-body sheet (base + clothes) for SpriteChibi.OUTFITS.
--colors N limits the clothes palette (default 16).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402
from dress_from_base import masks  # noqa: E402
from hair_layer import ORDER, ROWS, drop_specks, head_anchor  # noqa: E402
from texture_from_ai import mode_downscale, split_parts  # noqa: E402

CELL = 96
HEAD_GAP = 4   # rows above the tank top that still belong to the neck (clothes may cover them)


def load(path):
    return pf.key_background(np.array(Image.open(path).convert('RGBA')), [255, 0, 255], 90)


def anchors(cell):
    """(torso top y, torso centre x, waist y, hip centre x) of a frame of the underwear sheet"""
    tank, boxer, skin, _ = masks(cell)
    trows = np.nonzero(tank.sum(1) >= 3)[0]
    brows = np.nonzero(boxer.sum(1) >= 3)[0]
    if len(trows) == 0 or len(brows) == 0:
        return None
    t0 = trows[0]
    tx = np.nonzero(tank[min(t0 + 2, trows[-1])])[0]
    y0 = brows[0]
    bx = np.nonzero(boxer[y0])[0]
    return t0, (tx[0] + tx[-1]) / 2, y0, (bx[0] + bx[-1]) / 2


def place(layer, top, mid, width, cell, mirror):
    """The direction's clothes (AI pixels) -> game pixels on `cell`, pinned by the head."""
    ctop, cmid, cwidth = head_anchor(cell)
    k = cwidth / width
    ys, xs = np.nonzero(layer[..., 3])
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    src = layer[y0:y1, x0:x1]
    small = mode_downscale(src, max(1, round(src.shape[1] * k)), max(1, round(src.shape[0] * k)))
    ox, oy = (x0 - mid) * k, (y0 - top) * k
    if mirror:
        small = small[:, ::-1]
        ox = -ox - small.shape[1]
    out = np.zeros((CELL, CELL, 4), np.uint8)
    px, py = int(round(cmid + ox)), int(round(ctop + oy))
    for yy in range(small.shape[0]):
        for xx in range(small.shape[1]):
            if small[yy, xx, 3] and 0 <= py + yy < CELL and 0 <= px + xx < CELL:
                out[py + yy, px + xx] = small[yy, xx]
    return out


def shifted(piece, dy, dx):
    out = np.zeros_like(piece)
    ys, xs = np.nonzero(piece[..., 3])
    ty, tx = ys + dy, xs + dx
    ok = (ty >= 0) & (ty < CELL) & (tx >= 0) & (tx < CELL)
    out[ty[ok], tx[ok]] = piece[ys[ok], xs[ok]]
    return out


def over(dst, src):
    m = src[..., 3] > 0
    dst[m] = src[m]


def arms_mask(cell, a):
    """Hands/forearms beside the hips: skin outside the torso columns near the waist, plus their outline."""
    tank, boxer, skin, alpha = masks(cell)
    t0, tcx, y0, hcx = a
    hx = np.nonzero(boxer[y0])[0]
    hl, hr = hx[0], hx[-1]
    m = np.zeros(skin.shape, bool)
    for y in range(max(0, y0 - 3), min(CELL, y0 + 7)):
        for x in range(CELL):
            if skin[y, x] and (x < hl or x > hr):
                m[y, x] = True
    grow = m.copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        grow |= np.roll(np.roll(m, dy, 0), dx, 1)
    dark = alpha & (cell[..., :3].max(-1) < 60)
    return m | (grow & dark)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('base')
    ap.add_argument('cloth')
    ap.add_argument('sheet')
    ap.add_argument('out')
    ap.add_argument('--colors', type=int, default=16)
    a = ap.parse_args()

    base, cloth = load(a.base), load(a.cloth)
    h, w = min(base.shape[0], cloth.shape[0]), min(base.shape[1], cloth.shape[1])
    base, cloth = base[:h, :w], cloth[:h, :w]
    parts = split_parts(base[..., 3], 20)
    if len(parts) != 5:
        sys.exit(f'expected 5 figures, found {len(parts)}: {parts}')
    edges = [0] + [(parts[i][1] + parts[i + 1][0]) // 2 for i in range(4)] + [w]
    layers = {}
    for i, d in enumerate(ORDER):
        x0, x1 = edges[i], edges[i + 1]
        b, c = base[:, x0:x1], cloth[:, x0:x1]
        mask = drop_specks(c[..., 3] > 0)
        layer = np.zeros_like(c)
        layer[mask] = c[mask]
        layers[d] = (layer, *head_anchor(b))

    sheet = np.array(Image.open(a.sheet).convert('RGBA'))
    out = sheet.copy()
    clothes = np.zeros_like(sheet)
    cols = sheet.shape[1] // CELL
    for row, (d, mirror) in enumerate(ROWS):
        rs = slice(row * CELL, (row + 1) * CELL)
        stand = sheet[rs, 0:CELL]
        sa = anchors(stand)
        dressed = place(*layers[d], stand, mirror)
        top, skirt = dressed.copy(), dressed.copy()
        top[sa[2]:] = 0
        skirt[:sa[2]] = 0
        for col in range(cols):
            cs = slice(col * CELL, (col + 1) * CELL)
            cell = sheet[rs, cs]
            fa = anchors(cell)
            if fa is None:
                continue
            layer = np.zeros_like(cell)
            # skirt: down with the waistband, sideways with the torso (the waistband centre jumps
            # when a lifted leg widens the boxers)
            over(layer, shifted(skirt, fa[2] - sa[2], int(round(fa[1] - sa[1]))))
            over(layer, shifted(top, fa[0] - sa[0], int(round(fa[1] - sa[1]))))
            clothes[rs, cs] = layer
    clothes = pf.reduce_colours(clothes, a.colors)
    for row in range(len(ROWS)):
        rs = slice(row * CELL, (row + 1) * CELL)
        for col in range(cols):
            cs = slice(col * CELL, (col + 1) * CELL)
            cell = sheet[rs, cs]
            fa = anchors(cell)
            if fa is None:
                continue
            dst = out[rs, cs]
            over(dst, clothes[rs, cs])
            arm = arms_mask(cell, fa)
            dst[arm] = cell[arm]
            # the head (chin and face) is in front of the collar, as in the AI drawing
            head = np.zeros(arm.shape, bool)
            head[:fa[0] - HEAD_GAP] = True
            head &= cell[..., 3] > 0
            dst[head] = cell[head]
    Image.fromarray(out).save(a.out)
    print('saved', a.out)


if __name__ == '__main__':
    main()
