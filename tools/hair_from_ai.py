"""hair_from_ai - cut a hairstyle out of an AI-edited copy of the hair reference and make it a head part.

  python tools/hair_from_ai.py art-in/char/hair1.png client/public/assets/head/<id>.png [--preview out.png]

The reference (art-in/char/hair_ref.png) shows the base character's standing frames SW (left) and NE (right),
each game pixel as a REF_BLOCK block on magenta. ChatGPT adds hair and usually redraws everything at another
size, so: scale back by the image size, sample one colour per game pixel, line each figure up with the real
frame by its outline, and keep the brown blob that sits on the head (the hair). The rest of the picture is ignored.
The hair is turned to greys (the game recolours it to the hair colour) and mirrored for SE and NW.
Register it in shared/parts.json as slot hairFront, tint hair, then fit it in the avatar editor.
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

ROOT = Path(__file__).parent.parent
# how tools/hair_ref was built (see the chat on 29 Oct / design/avatar-system.md): crop, block size, padding
REF_SIZE, REF_BLOCK, REF_PAD = (1080, 680), 10, 40
CROP_X, CROP_Y, CROP_W = 10, 2, 48
ROWS = {'SW': 3, 'NE': 7}
SHIFT = 3            # game px searched each way when lining a figure up


def sample(img, scale, left, k):
    """the AI picture back at game size for figure k: one colour per game pixel (the middle of its block)"""
    out = np.zeros((FRAME, FRAME, 3), np.uint8)
    have = np.zeros((FRAME, FRAME), bool)
    for gy in range(FRAME):
        for gx in range(FRAME):
            X = (left + (gx - CROP_X) * REF_BLOCK + REF_BLOCK / 2) * scale
            Y = (REF_PAD + (gy - CROP_Y) * REF_BLOCK + REF_BLOCK / 2) * scale
            if 0 <= X < img.shape[1] - 1 and 0 <= Y < img.shape[0] - 1:
                block = img[int(Y) - 2:int(Y) + 3, int(X) - 2:int(X) + 3].reshape(-1, 3)
                out[gy, gx] = np.median(block, 0)
                have[gy, gx] = True
    magenta = (out[..., 0] > 190) & (out[..., 1] < 90) & (out[..., 2] > 190)
    return out, have & ~magenta


def line_up(mask, real):
    """the shift that best puts the sampled figure's body (below the head) on the real one"""
    best, at = None, (0, 0)
    for dy in range(-SHIFT, SHIFT + 1):
        for dx in range(-SHIFT, SHIFT + 1):
            moved = np.roll(np.roll(mask, dy, 0), dx, 1)
            err = (moved[34:] != real[34:]).sum()
            if best is None or err < best:
                best, at = err, (dx, dy)
    return at


def hair_mask(rgb, opaque, head_bottom):
    """brown, darker than skin: the biggest such blob above the neck"""
    def brown(p):
        h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in p])
        return (h < 45 / 360 or h > 340 / 360) and s > 0.3 and v < 0.72
    m = np.zeros(opaque.shape, bool)
    for y, x in zip(*np.nonzero(opaque)):
        if y <= head_bottom and brown(rgb[y, x]):
            m[y, x] = True
    # keep the biggest 8-connected blob (eyebrows and eyes are separate)
    seen, best = np.zeros_like(m), []
    for y, x in zip(*np.nonzero(m)):
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
                    if 0 <= v < FRAME and 0 <= u < FRAME and m[v, u] and not seen[v, u]:
                        seen[v, u] = True
                        stack.append((v, u))
        if len(blob) > len(best):
            best = blob
    out = np.zeros_like(m)
    for j, i in best:
        out[j, i] = True
    return out


def greys(rgb, mask):
    """keep the drawn shading as brightness only; the darkest pixels stay darkest (the outline)"""
    out = np.zeros(mask.shape + (4,), np.uint8)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    lo, hi = lum[mask].min(), lum[mask].max()
    g = (40 + (lum - lo) / max(hi - lo, 1) * 170).astype(np.uint8)
    out[mask] = np.stack([g, g, g, np.full_like(g, 255)], -1)[mask]
    return out


def mirrored(part, box_from, box_to):
    """flip a view for its mirror view, shifted so the head boxes line up"""
    flip = part[:, ::-1]
    dx = box_to[0] - (FRAME - box_from[0] - box_from[2])
    return np.roll(flip, dx, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ai')
    ap.add_argument('out')
    ap.add_argument('--sheet', default=str(ROOT / 'client/public/assets/player.png'))
    ap.add_argument('--preview', help='the hair on the body, 4 views, 6x, browned')
    a = ap.parse_args()

    img = np.array(Image.open(a.ai).convert('RGB')).astype(np.int32)
    scale = img.shape[1] / REF_SIZE[0]
    body = np.array(Image.open(a.sheet).convert('RGBA'))
    rig = json.loads((ROOT / 'client/src/model/player_rig.json').read_text())
    views = {}
    for k, (name, row) in enumerate(ROWS.items()):
        real = body[row * FRAME:(row + 1) * FRAME, 0:FRAME]
        left = REF_PAD + k * (CROP_W * REF_BLOCK + REF_PAD)
        rgb, opaque = sample(img, scale, left, k)
        dx, dy = line_up(opaque, real[..., 3] > 0)
        rgb, opaque = np.roll(np.roll(rgb, dy, 0), dx, 1), np.roll(np.roll(opaque, dy, 0), dx, 1)
        bx, by, bw, bh = rig['box'][row]
        views[name] = greys(rgb, hair_mask(rgb, opaque, by + bh))
        print(f'{name}: scale {scale:.3f}, lined up by ({dx}, {dy}), {int((views[name][..., 3] > 0).sum())} hair px')
    views['SE'] = mirrored(views['SW'], rig['box'][3], rig['box'][1])
    views['NW'] = mirrored(views['NE'], rig['box'][7], rig['box'][5])
    sheet = np.concatenate([views[v] for v in ('SE', 'SW', 'NW', 'NE')], 1)
    Image.fromarray(sheet).save(a.out)
    print('saved', a.out)

    if a.preview:
        brown = (sheet.astype(np.float32) * [0.8, 0.6, 0.45, 1]).astype(np.uint8)
        pv = Image.new('RGBA', (4 * FRAME, FRAME), (40, 44, 52, 255))
        for v, row in enumerate((1, 3, 5, 7)):
            pv.alpha_composite(Image.fromarray(body[row * FRAME:(row + 1) * FRAME, 0:FRAME]), (v * FRAME, 0))
        pv.alpha_composite(Image.fromarray(brown))
        pv.resize((pv.width * 6, pv.height * 6), Image.NEAREST).save(a.preview)


if __name__ == '__main__':
    main()
