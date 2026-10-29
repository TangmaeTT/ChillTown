"""top_from_ai - cut an upper-body garment out of an AI-edited copy of the reference and make it a top.

  python tools/top_from_ai.py art-in/char/shirt1.png client/public/assets/head/<id>.png [--preview out.png]

Same reference and lining-up as tools/hair_from_ai.py (ChatGPT dresses art-in/char/hair_ref.png). Two results:
- the torso: AI pixels over the base t-shirt (grown 1 px for a thicker garment), not skin, in its own colours.
  A part that follows the waist (slot "torso"); the torso hardly moves when walking.
- the sleeves: arms swing, so no picture is pasted there. The colours the AI drew on the arms become a
  4-colour ramp, printed here for the top's "sleeveColors" in shared/avatar.ts; the game paints every
  frame's arm region with it (tools/body_regions.py). Mostly skin on the arms = short sleeves.
SW and NE are cut; SE and NW are mirrored, lined up on the waist (player_body.json).
"""
import argparse
import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from char_rig import FRAME  # noqa: E402
from body_regions import REGIONS  # noqa: E402
from hair_from_ai import REF_SIZE, REF_BLOCK, REF_PAD, CROP_W, ROWS, sample, line_up  # noqa: E402

ROOT = Path(__file__).parent.parent


def skin(p):
    h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in p])
    return (h < 45 / 360 or h > 345 / 360) and 0.15 <= s <= 0.7 and v >= 0.55


def region(reg, name):
    return (reg[..., :3] == REGIONS[name]).all(2) & (reg[..., 3] > 0)


def grow(m):
    out = m.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ai')
    ap.add_argument('out')
    ap.add_argument('--preview', help='the top on the body (torso part + sleeve colour), 4 views, 6x')
    a = ap.parse_args()

    img = np.array(Image.open(a.ai).convert('RGB')).astype(np.int32)
    scale = img.shape[1] / REF_SIZE[0]
    body = np.array(Image.open(ROOT / 'client/public/assets/player.png').convert('RGBA'))
    regs = np.array(Image.open(ROOT / 'client/public/assets/player_regions.png').convert('RGBA'))
    rig = json.loads((ROOT / 'client/src/model/player_rig.json').read_text())
    waist = json.loads((ROOT / 'client/src/model/player_body.json').read_text())['waist']

    views, sleeve = {}, []
    arm_px = skin_px = 0
    for k, (name, row) in enumerate(ROWS.items()):
        sl = np.s_[row * FRAME:(row + 1) * FRAME, 0:FRAME]
        real, reg = body[sl], regs[sl]
        left = REF_PAD + k * (CROP_W * REF_BLOCK + REF_PAD)
        rgb, opaque = sample(img, scale, left, k)
        dx, dy = line_up(opaque, real[..., 3] > 0)
        rgb, opaque = np.roll(np.roll(rgb, dy, 0), dx, 1), np.roll(np.roll(opaque, dy, 0), dx, 1)
        neck = rig['box'][row][1] + rig['box'][row][3]
        not_skin = np.array([[not skin(p) for p in r] for r in rgb])
        pinkish = (rgb[..., 0] > 150) & (rgb[..., 2] > 150) & (rgb[..., 1] < 120)   # background bled into an edge
        opaque &= ~pinkish
        zone = grow(region(reg, 'shirt'))
        zone[:neck] = False
        keep = zone & opaque & not_skin
        part = np.zeros((FRAME, FRAME, 4), np.uint8)
        part[keep, :3] = rgb[keep]
        part[keep, 3] = 255
        views[name] = part
        arms = region(reg, 'arm')
        arm_px += int(arms.sum())
        skin_px += int((arms & ~not_skin).sum())
        sleeve += [tuple(rgb[y, x]) for y, x in zip(*np.nonzero(arms & not_skin & opaque))]
        print(f'{name}: lined up by ({dx}, {dy}), torso {int(keep.sum())} px')

    def mirrored(part, row_from, row_to):
        shift = waist[row_to][0] - (FRAME - 1 - waist[row_from][0])
        return np.roll(part[:, ::-1], shift, 1)
    views['SE'] = mirrored(views['SW'], 3, 1)
    views['NW'] = mirrored(views['NE'], 7, 5)
    sheet = np.concatenate([views[v] for v in ('SE', 'SW', 'NW', 'NE')], 1)
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)

    ramp = None
    if arm_px and skin_px / arm_px < 0.5 and len(sleeve) >= 4:
        y = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
        # leave out near-black (the outline, which stays as drawn on the body anyway)
        lum = sorted([c for c in sleeve if y(c) > 45] or sleeve, key=y)
        ramp = ['#%02x%02x%02x' % lum[int(q * (len(lum) - 1))] for q in (0.1, 0.4, 0.7, 0.95)]
        print('long sleeves, sleeveColors:', json.dumps(ramp))
    else:
        print(f'short sleeves (arms {skin_px}/{arm_px} skin)')

    if a.preview:
        pv = Image.new('RGBA', (4 * FRAME, FRAME), (40, 44, 52, 255))
        for v, row in enumerate((1, 3, 5, 7)):
            pv.alpha_composite(Image.fromarray(body[row * FRAME:(row + 1) * FRAME, 0:FRAME]), (v * FRAME, 0))
        pv.alpha_composite(Image.fromarray(sheet))
        pv.resize((pv.width * 6, pv.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
