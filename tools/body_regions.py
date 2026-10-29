"""body_regions - map every pixel of the base body to a region, so the game can dress it in mixable clothes.

  python tools/body_regions.py client/public/assets/player.png client/public/assets/player_regions.png [--debug out.png]

The base character wears a plain light-grey t-shirt, dark trousers and dark shoes (flat colours), so in each
frame, below the head (char_rig.head_box):
  arm    skin            -> a long-sleeved top covers it
  hand   skin, the bottom 2 rows of each arm
  shirt  grey above the waist (the first row where dark greys outnumber light ones)
  pants  grey from the waist down
  shin   pants below the knee (waist + KNEE rows) -> shorts show skin there
  shoe   grey within SHOE rows of the bottom of its column
  line   near-black: the outline, kept as drawn
Head and neck pixels are left out (region 0): the game recolours them by skin colour as before.
Output: same size as the sheet, one flat colour per region (REGIONS below; client/src/view/art/outfit.ts reads them),
plus client/src/model/player_body.json: the waist in each standing view and how it moves in every frame
(body parts like skirts follow it, as head parts follow the head), and how the shirt moves in every frame
(drawn tops are re-cut onto the shirt with it, so they fit each frame). Run it again whenever player.png changes.
"""
import argparse
import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME, head_box  # noqa: E402
from blank_face import skin_like  # noqa: E402

# region -> colour in the map (keep in step with client/src/view/art/outfit.ts)
REGIONS = {'arm': (255, 0, 0), 'hand': (255, 160, 0), 'shirt': (0, 120, 255), 'pants': (0, 200, 0),
           'shin': (160, 255, 0), 'shoe': (160, 0, 255), 'line': (40, 40, 40)}
KNEE = 5
BODY_JSON = Path(__file__).parent.parent / 'client/src/model/player_body.json'
SHOE = 4


def hsv(p):
    return colorsys.rgb_to_hsv(*[c / 255 for c in p[:3]])


def regions(f):
    out = np.zeros(f.shape[:2] + (4,), np.uint8)
    opaque = f[..., 3] > 0
    if not opaque.any():
        return out
    _, top, _, h = head_box(f)
    neck = top + h
    label = {}
    skin = np.zeros(opaque.shape, bool)
    for y, x in zip(*np.nonzero(opaque)):
        if y < neck:
            continue
        p = f[y, x]
        if skin_like(tuple(p[:3])):
            skin[y, x] = True
        elif hsv(p)[2] < 0.12:
            label[y, x] = 'line'
    # waist: first row below the neck where dark greys outnumber light ones
    greys = lambda y, dark: sum(1 for x in range(FRAME) if opaque[y, x] and not skin[y, x]
                                and (hsv(f[y, x])[2] < 0.35) == dark)
    waist = next((y for y in range(neck + 3, FRAME) if greys(y, True) > greys(y, False)), neck + 10)
    # the bottom of every column (shoes sit there, also on a lifted foot)
    bottom = {x: max(np.nonzero(opaque[:, x])[0]) for x in range(FRAME) if opaque[:, x].any()}
    for y, x in zip(*np.nonzero(opaque)):
        if y < neck or skin[y, x] or (y, x) in label:
            continue
        if y > waist + 2 and y > bottom[x] - SHOE:
            label[y, x] = 'shoe'
        elif y < waist:
            label[y, x] = 'shirt'
        else:
            label[y, x] = 'shin' if y >= waist + KNEE else 'pants'
    # skin below the neck = arms; the bottom 2 rows of each arm blob are the hand
    seen = np.zeros_like(skin)
    for y, x in zip(*np.nonzero(skin)):
        if seen[y, x]:
            continue
        blob, stack = [], [(y, x)]
        seen[y, x] = True
        while stack:
            j, i = stack.pop()
            blob.append((j, i))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    v, u = j + dy, i + dx
                    if 0 <= v < FRAME and 0 <= u < FRAME and skin[v, u] and not seen[v, u]:
                        seen[v, u] = True
                        stack.append((v, u))
        if min(j for j, _ in blob) <= neck + 1:
            continue                    # the neck: stays skin whatever the top
        low = max(j for j, _ in blob)
        for j, i in blob:
            label[j, i] = 'hand' if j >= low - 1 else 'arm'
    for (y, x), r in label.items():
        out[y, x] = REGIONS[r] + (255,)
    return out


def shift(reg, ref, names):
    """how far this frame's regions `names` have moved from the standing frame's: [dx, dy] with the least mismatch"""
    mask = lambda r: np.any([(r[..., :3] == REGIONS[k]).all(2) for k in names], 0) & (r[..., 3] > 0)
    m, base = mask(reg), mask(ref)
    best, at = None, [0, 0]
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            err = (np.roll(np.roll(base, dy, 0), dx, 1) != m).sum() * 10 + abs(dx) + abs(dy)
            if best is None or err < best:
                best, at = err, [dx, dy]
    return at


def waist_point(reg):
    """the middle of the top row of the trousers: [x, y] in frame px"""
    pants = (reg[..., :3] == REGIONS['pants']).all(2) & (reg[..., 3] > 0)
    ys, xs = np.nonzero(pants)
    if not len(ys):
        return [FRAME // 2, FRAME // 2]
    y = int(ys.min())
    return [int(round(xs[ys == y].mean())), y]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet')
    ap.add_argument('out')
    ap.add_argument('--debug', help='the sheet with the regions laid over it, 4x')
    a = ap.parse_args()

    img = np.array(Image.open(a.sheet).convert('RGBA'))
    res = np.zeros_like(img)
    rows, cols = img.shape[0] // FRAME, img.shape[1] // FRAME
    waist, offset, shirt = [], [], []
    for r in range(rows):
        points, shifts, hips = [], [], []
        for c in range(cols):
            sl = np.s_[r * FRAME:(r + 1) * FRAME, c * FRAME:(c + 1) * FRAME]
            res[sl] = regions(img[sl])
            points.append(waist_point(res[sl]))
            stand = res[r * FRAME:(r + 1) * FRAME, 0:FRAME]
            shifts.append(shift(res[sl], stand, ['shirt']))
            hips.append(shift(res[sl], stand, ['pants']))
        waist.append(points[0])
        offset.append(hips)     # matching the whole trousers shape: steadier than the waist point itself
        shirt.append(shifts)
    Image.fromarray(res).save(a.out)
    BODY_JSON.write_text(json.dumps({'frame': FRAME, 'waist': waist, 'offset': offset, 'shirt': shirt}, separators=(',', ':')) + '\n')
    print('wrote', BODY_JSON.name, 'waist per row', waist)
    counts = {k: int((res[..., :3] == v).all(2).sum()) for k, v in REGIONS.items()}
    print('saved', a.out, counts)
    if a.debug:
        base = Image.new('RGBA', img.shape[1::-1], (40, 44, 52, 255))
        base.alpha_composite(Image.fromarray(img))
        over = res.copy()
        over[..., 3] = np.where(res[..., 3] > 0, 150, 0)
        base.alpha_composite(Image.fromarray(over))
        base.resize((base.width * 4, base.height * 4), Image.NEAREST).save(a.debug)


if __name__ == '__main__':
    main()
