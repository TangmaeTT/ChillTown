"""face_part - lift the face Autosprite drew into a head part, with blink frames.

  python tools/face_part.py <sheet with face> <same sheet after blank_face.py> client/public/assets/head/<id>.png
         [--preview out.png]

Both sheets are in the game's player.png layout (tools/char_sheet.py). From the standing frame of each part view
(rows 1, 3, 5, 7 = SE, SW, NW, NE) it keeps the pixels blank_face.py painted over that aren't skin: brows,
eyes, their soft edges. Those are the part, so it sits exactly where the face was drawn.

Output: 4 columns (views) x 3 rows: open, half closed, closed. In the half and closed rows each eye (a blob of
part pixels with a near-black pupil in it) is taken out from the top and its top edge drawn as a dark lid line.
Register it in shared/parts.json with "blink": true.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME  # noqa: E402
from blank_face import skin_like  # noqa: E402

ROWS = [1, 3, 5, 7]
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def blobs(mask):
    """8-connected components: list of [(y, x), ...]"""
    seen, out = np.zeros_like(mask), []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, comp = [(y, x)], []
        seen[y, x] = True
        while stack:
            j, i = stack.pop()
            comp.append((j, i))
            for dy, dx in N8:
                v, u = j + dy, i + dx
                if 0 <= v < mask.shape[0] and 0 <= u < mask.shape[1] and mask[v, u] and not seen[v, u]:
                    seen[v, u] = True
                    stack.append((v, u))
        out.append(comp)
    return out


def face_of(orig, blank):
    """the painted-over pixels that aren't skin, at their original colours"""
    changed = (orig != blank).any(2) & (orig[..., 3] > 0)
    keep = changed & ~np.array([[skin_like(tuple(p[:3])) for p in row] for row in orig])
    part = np.zeros_like(orig)
    part[keep] = orig[keep]
    return part


def eyes(part):
    """blobs holding a near-black pixel (the pupil, luma ~22) and at least 3 px tall; brows are browner (~36) and flat"""
    out = []
    for comp in blobs(part[..., 3] > 0):
        ys = [y for y, _ in comp]
        darkest = min(luma(part[y, x]) for y, x in comp)
        if darkest < 28 and max(ys) - min(ys) >= 2:
            # the soft edge can join the brow to the eye: the eye starts 2 rows above the pupil
            top = min(y for y, x in comp if luma(part[y, x]) < 28) - 2
            out.append([(y, x) for y, x in comp if y >= top])
    return out


def shut(part, amount):
    """amount 0.5 = half closed, 1 = closed: drop the top of each eye and draw the lid along the new top"""
    res = part.copy()
    for comp in eyes(part):
        ys = sorted({y for y, _ in comp})
        top, bot = ys[0], ys[-1]
        lid_y = (top + bot + 1) // 2
        lid = min((part[y, x] for y, x in comp), key=luma).copy()   # the darkest eye colour
        # the eye proper: columns that reach the lid row (leaves out the soft edge pixels around it)
        xs = sorted({x for y, x in comp if y >= lid_y})
        for y, x in comp:
            if y < lid_y or amount >= 1:
                res[y, x] = 0
        if amount < 1:
            for x in xs:                        # half: the lid over what's left of the eye
                res[lid_y, x] = lid
        else:
            xs = xs[1:-1] if len(xs) > 4 else xs    # closed: a short curve, ends one px higher
            for n, x in enumerate(xs):
                res[lid_y + (0 if n in (0, len(xs) - 1) else 1), x] = lid
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('orig')
    ap.add_argument('blank')
    ap.add_argument('out')
    ap.add_argument('--preview', help='the part over the blank head, all frames, 6x')
    a = ap.parse_args()

    orig = np.array(Image.open(a.orig).convert('RGBA'))
    blank = np.array(Image.open(a.blank).convert('RGBA'))
    sheet = np.zeros((3 * FRAME, 4 * FRAME, 4), np.uint8)
    for v, r in enumerate(ROWS):
        sl = np.s_[r * FRAME:(r + 1) * FRAME, 0:FRAME]
        part = face_of(orig[sl], blank[sl])
        print(f'view {v}: {int((part[..., 3] > 0).sum())} px, {len(eyes(part))} eye(s)')
        for k, amount in enumerate([0, 0.5, 1]):
            sheet[k * FRAME:(k + 1) * FRAME, v * FRAME:(v + 1) * FRAME] = shut(part, amount) if amount else part
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)

    if a.preview:
        base = np.zeros_like(sheet)
        for v, r in enumerate(ROWS):
            for k in range(3):
                base[k * FRAME:(k + 1) * FRAME, v * FRAME:(v + 1) * FRAME] = blank[r * FRAME:(r + 1) * FRAME, 0:FRAME]
        img = Image.new('RGBA', base.shape[1::-1], (40, 44, 52, 255))
        img.alpha_composite(Image.fromarray(base))
        img.alpha_composite(Image.fromarray(sheet))
        img.resize((img.width * 6, img.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
