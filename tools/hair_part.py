"""hair_part - draw a test hairstyle on the base character's head: a cap of hair and a ponytail with sway poses.

  python tools/hair_part.py client/public/assets/player.png client/public/assets/head [--preview out.png]

Reads the head shape from the standing frame of each part view (rows 1, 3, 5, 7 = SE, SW, NW, NE) and writes
  pony.png       4 views x 1 row: hair on the head (hairFront slot)
  pony_tail.png  4 views x POSES rows: the tail, swung from screen-left (row 0) to screen-right (last row)
Both in greys (dark = outline), recoloured to the hair colour in the game. The tail's rows are chosen by a
spring in the game ("sway" in shared/parts.json), so it swings without rotating any pixels.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME, head_box  # noqa: E402

ROWS = [1, 3, 5, 7]
FACES = ['right', 'left', 'away', 'away']     # where the face points in each view
POSES = 5
SWING = 3                                      # px the tail tip moves per pose step
GREYS = [40, 78, 118, 160, 200]                # outline, shadow, mid, light, highlight


def head_mask(f):
    """the head's own pixels: opaque, inside the head box"""
    x, y, w, h = head_box(f)
    m = np.zeros(f.shape[:2], bool)
    m[y:y + h, x:x + w] = f[y:y + h, x:x + w, 3] > 0
    return m, (x, y, w, h)


def shade(mask, skin=None, light_dir=(-0.6, -0.8)):
    """greys lit from the top-left in 3 tones + a small highlight; outline where the hair meets the air,
    shadow (not outline) where it meets the skin, and a few darker strands"""
    out = np.zeros(mask.shape + (4,), np.uint8)
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return out
    cy, cx = ys.mean(), xs.mean()
    span = max(np.ptp(ys), np.ptp(xs), 1) / 2
    inside = lambda y, x: 0 <= y < mask.shape[0] and 0 <= x < mask.shape[1]
    for y, x in zip(ys, xs):
        lit = -((x - cx) * light_dir[0] + (y - cy) * light_dir[1]) / span    # -1 dark .. 1 lit
        k = 4 if lit > 0.75 else 3 if lit > 0.3 else 2 if lit > -0.45 else 1
        if k in (2, 3) and x % 4 == 0 and y % 3:
            k -= 1                                         # strands
        out_n = [(y + dy, x + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                 if not (inside(y + dy, x + dx) and mask[y + dy, x + dx])]
        if out_n:
            on_skin = skin is not None and all(inside(j, i) and skin[j, i] for j, i in out_n)
            k = 1 if on_skin else 0
        g = GREYS[k]
        out[y, x] = (g, g, g, 255)
    return out


def cap(f, face):
    """hair covering the top and back of the head, fringe on the face side, 1 px of volume above the scalp"""
    m, (x, y, w, h) = head_mask(f)
    hair = np.zeros_like(m)
    for i in range(x - 1, x + w + 1):
        u = (i - x) / max(w - 1, 1)                      # 0 left .. 1 right
        if face == 'away':
            line = y + int(h * 0.78)
        else:
            front = u if face == 'right' else 1 - u      # 1 at the face side
            line = y + int(h * (0.72 - 0.34 * front))    # low at the back, high over the forehead
            if front > 0.55:
                line += [0, 1, 2, 1][i % 4]              # a ragged fringe
        for j in range(y - 1, line):
            if 0 <= i < FRAME and 0 <= j < FRAME:
                hair[j, i] = m[j, i]
    # volume: grow 1 px outward over the top and back
    grown = hair.copy()
    for dy, dx in ((-1, 0), (0, -1), (0, 1)):
        grown |= np.roll(np.roll(hair, dy, 0), dx, 1)
    cut = y + int(h * 0.55)
    grown[cut:] = hair[cut:]
    return shade(grown, m)


def tail(f, face, pose):
    """a tapered ponytail hanging from the back of the head; pose shifts the tip sideways"""
    _, (x, y, w, h) = head_mask(f)
    s = pose - POSES // 2
    # a low ponytail: tied at the nape, so it hangs out from under the cap in every view
    if face == 'away':
        ax, ay = x + w // 2, y + int(h * 0.62)
        pts = [(ax, ay), (ax + s * SWING * 0.4, ay + 9), (ax + s * SWING, ay + 19)]
    else:
        back = -1 if face == 'right' else 1              # the back of the head is opposite the face
        ax, ay = (x + 4 if back < 0 else x + w - 5), y + int(h * 0.58)
        pts = [(ax, ay), (ax + back * 3 + s * SWING * 0.4, ay + 9), (ax + back * 2 + s * SWING, ay + 18)]
    m = np.zeros(f.shape[:2], bool)
    for t in np.linspace(0, 1, 60):
        bx = (1 - t) ** 2 * pts[0][0] + 2 * (1 - t) * t * pts[1][0] + t * t * pts[2][0]
        by = (1 - t) ** 2 * pts[0][1] + 2 * (1 - t) * t * pts[1][1] + t * t * pts[2][1]
        r = 4.0 - 2.6 * t                                # thick at the tie, thin at the tip
        jj, ii = np.ogrid[:FRAME, :FRAME]
        m |= (ii - bx) ** 2 + (jj - by) ** 2 <= r * r
    out = shade(m)
    # hair tie: a dark band just under the knot
    for i in range(int(pts[0][0]) - 2, int(pts[0][0]) + 3):
        j = int(pts[0][1]) + 2
        if out[j, i, 3]:
            out[j, i] = (GREYS[0],) * 3 + (255,)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('outdir')
    ap.add_argument('--preview', help='hair over the standing views, tail in every pose, 6x, browned')
    a = ap.parse_args()

    img = np.array(Image.open(a.sheet).convert('RGBA'))
    frames = [img[r * FRAME:(r + 1) * FRAME, 0:FRAME] for r in ROWS]
    caps = np.zeros((FRAME, 4 * FRAME, 4), np.uint8)
    tails = np.zeros((POSES * FRAME, 4 * FRAME, 4), np.uint8)
    for v, (f, face) in enumerate(zip(frames, FACES)):
        caps[:, v * FRAME:(v + 1) * FRAME] = cap(f, face)
        for p in range(POSES):
            tails[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME] = tail(f, face, p)
    out = Path(a.outdir)
    Image.fromarray(caps).save(out / 'pony.png')
    Image.fromarray(tails).save(out / 'pony_tail.png')
    print('saved', out / 'pony.png', out / 'pony_tail.png')

    if a.preview:
        brown = lambda im: (im.astype(np.float32) * [0.85, 0.62, 0.45, 1]).astype(np.uint8)
        sheet = Image.new('RGBA', (4 * FRAME, POSES * FRAME), (40, 44, 52, 255))
        for p in range(POSES):
            for v, f in enumerate(frames):
                at = (v * FRAME, p * FRAME)
                t = brown(tails[p * FRAME:(p + 1) * FRAME, v * FRAME:(v + 1) * FRAME])
                if FACES[v] != 'away':
                    sheet.alpha_composite(Image.fromarray(t), at)        # behind the body when facing us
                sheet.alpha_composite(Image.fromarray(f), at)
                if FACES[v] == 'away':
                    sheet.alpha_composite(Image.fromarray(t), at)
                sheet.alpha_composite(Image.fromarray(brown(caps[:, v * FRAME:(v + 1) * FRAME])), at)
        sheet.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
