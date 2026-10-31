"""underwear_base - turn the base walk sheet's T-shirt + trousers into a cropped tank top + boxers.

  python tools/underwear_base.py godot/assets/characters/walk_v62.png out.png [--cut 6] [--crop 3] [--slim]

Works on the finished game sheet (pixel-clean, ~24 colours), so heads and poses stay exactly
where they were and the hair layers still fit. Per cell:
  - tee pixels (beige) become an off-white tank top; tee pixels in the upper rows that stick
    out past the waist width are sleeves and become skin (upper arm);
  - trouser pixels (charcoal) down to --cut px below the shirt hem stay as boxers; below it they become skin,
    shaded by the trousers' own light/dark so the leg keeps its form;
  - shoes, outlines, head and hands are untouched.
--slim shaves one trouser pixel off each side of every bare-leg run (pants are wider than legs).
"""
import argparse

import numpy as np
from PIL import Image

CELL = 96

# skin ramp, light -> shadow (taken from the sheet's own skin)
SKIN = [(253, 222, 195), (252, 217, 184), (251, 200, 168), (248, 185, 155), (234, 151, 126)]
OUTLINE = (24, 13, 12)
SHOE = 6
SHOULDER = 3   # rows at the top of the shirt where only the straps stay
PROFILE_ROWS = {0, 4}   # sheet rows drawn in profile: one strap, over the shoulder


def classify(px):
    """Masks for tee, pants and skin on an RGBA cell."""
    rgb = px[..., :3].astype(int)
    a = px[..., 3] > 0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    tee = a & (r > 140) & (r - b >= 15) & (r - b < 50) & (mx < 250) & (r - g < 25)
    pants = a & (mx >= 40) & (mx <= 100) & (mx - mn <= 16)
    skin = a & (r - b >= 50) & (r > 200)
    return tee, pants, skin


def skin_for(lum):
    for th, c in zip((78, 70, 60, 50), SKIN):
        if lum >= th:
            return c
    return SKIN[-1]


def tank(c):
    """Beige tee shade -> off-white tank shade (keeps the tee's light/dark)."""
    l = sum(c) / 3
    v = 255 - (238 - l) * 0.75
    return (int(min(255, v + 2)), int(min(255, v)), int(min(255, v - 6)))


def convert_cell(cell, cut, slim, crop, profile=False):
    px = cell.copy()
    tee, pants, skin = classify(px)
    ys = np.nonzero(tee.sum(1) >= 4)[0]           # rows of real shirt (skips stray beige in the face)
    if len(ys) == 0:
        return px
    # the shirt is the biggest unbroken block of such rows (beige in the soles must not extend it)
    blocks = np.split(ys, np.nonzero(np.diff(ys) > 2)[0] + 1)
    block = max(blocks, key=lambda b: tee[b].sum())
    t0, t1 = block[0], block[-1]
    tee[t1 + 3:] = False
    pants &= np.arange(CELL)[:, None] > t0          # eyes share the charcoal; stay below the tee top
    # shoes share the charcoal too: anything within SHOE px of its column's lowest pixel is shoe
    alpha = px[..., 3] > 0
    for x in range(CELL):
        col = np.nonzero(alpha[:, x])[0]
        if len(col):
            pants[col[-1] - SHOE + 1:, x] = False

    # sleeves: tee pixels near the row's outer edge, in the top 60% of the tee, with the arm's
    # skin just below them in the same column (that skin is the arm coming out of the sleeve)
    for y in range(t0, t0 + int((t1 - t0) * 0.6) + 1):
        xs = np.nonzero(tee[y])[0]
        if len(xs) == 0:
            continue
        for x in xs:
            if min(x - xs[0], xs[-1] - x) > 2:
                continue
            below = tee[y + 1:, x]
            run_end = y + 1 + (np.argmin(below) if not below.all() else len(below))
            if skin[run_end:run_end + 4, x].any():
                px[y, x, :3] = skin_for(80 if px[y, x, :3].mean() > 200 else 65)
                tee[y, x] = False

    # tank cut. Top rows: only the straps stay; shoulders, the scoop neck and the old collar
    # become skin (two straps facing front/back, one strap over the shoulder in profile).
    # Bottom rows: cropped hem, so the waist is skin and a crop top drawn over the base never
    # shows the tank underneath.
    ref = np.nonzero(tee[min(t0 + SHOULDER, t1)])[0]
    if len(ref):
        l, r = ref[0], ref[-1]
        w = r - l + 1
        for y in range(t0 - 1, t0 + SHOULDER):
            for x in range(l, r + 1):
                if not px[y, x, 3] or px[y, x, :3].max() < 100 or (skin[y, x] and not tee[y, x]):
                    continue
                d = min(x - l, r - x)
                strap = abs(d - w / 2) <= 1 if profile else w * 0.2 <= d <= w * 0.34
                if strap:
                    px[y, x, :3] = (200, 190, 175) if not tee[y, x] else px[y, x, :3]
                    tee[y, x] = True
                else:
                    px[y, x, :3] = skin_for(80 if px[y, x, :3].mean() > 215 else 72)
                    tee[y, x] = False
    for y in range(t1 - crop + 1, t1 + 3):
        for x in np.nonzero(tee[y])[0]:
            px[y, x, :3] = skin_for(80 if px[y, x, :3].mean() > 215 else 72 if px[y, x, :3].mean() > 195 else 65)
            tee[y, x] = False
    for y, x in zip(*np.nonzero(tee)):
        px[y, x, :3] = tank(tuple(int(v) for v in px[y, x, :3]))

    # boxers / bare legs
    pys = np.nonzero(pants.any(1))[0]
    if len(pys):
        p0, p1 = pys[0], pys[-1]
        ycut = max(p0, t1) + cut              # boxers reach a fixed length below the shirt hem
        for y in range(ycut + 1, p1 + 1):
            xs = np.nonzero(pants[y])[0]
            for x in xs:
                px[y, x, :3] = skin_for(px[y, x, :3].mean())
            if slim and len(xs):
                # each contiguous run: outermost pixels -> outline, old outline beside them -> clear
                runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
                for run in runs:
                    if len(run) < 4:
                        continue
                    for x, out in ((run[0], run[0] - 1), (run[-1], run[-1] + 1)):
                        if 0 <= out < CELL and px[y, out, 3] and px[y, out, :3].max() < 40:
                            px[y, out, 3] = 0
                            px[y, x, :3] = OUTLINE
        # boxer hem: one darker row at the cut
        for x in np.nonzero(pants[ycut])[0]:
            px[ycut, x, :3] = (px[ycut, x, :3] * 0.7).astype(np.uint8)
    return px


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--cut', type=int, default=6, help='boxer length in px below the shirt hem')
    ap.add_argument('--crop', type=int, default=3, help='rows of bare waist above the boxers (0 = full-length tank)')
    ap.add_argument('--slim', action='store_true')
    a = ap.parse_args()
    im = np.array(Image.open(a.src).convert('RGBA'))
    out = im.copy()
    for r in range(im.shape[0] // CELL):
        for c in range(im.shape[1] // CELL):
            sl = (slice(r * CELL, (r + 1) * CELL), slice(c * CELL, (c + 1) * CELL))
            out[sl] = convert_cell(im[sl], a.cut, a.slim, a.crop, r in PROFILE_ROWS)
    Image.fromarray(out).save(a.dst)
    print('wrote', a.dst)


if __name__ == '__main__':
    main()
