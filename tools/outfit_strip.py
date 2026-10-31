"""outfit_strip - put an AI-drawn "clothes only" walk strip onto the base walk strip.

  python tools/outfit_strip.py art-in/char/codex_v62/walk_s.png art-in/char/codex_v62/shirt_only_s.png \
      art-in/char/codex_v62/walk_s_shirt.png

The clothes-only strip (Codex, same canvas, clothes on magenta) is not always where the base
T-shirt is: Codex tends to draw tops a little high or off to the side. Each of the 9 figures
is fitted separately: the clothes' bounding box is moved and scaled onto the base figure's
T-shirt (its beige pixels), whose top is lifted a little for the collar. Then the clothes are
drawn over the base. The result is a clothed walk strip for tools/walk_sheet.py.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402
from texture_from_ai import split_parts  # noqa: E402

TEE = np.array([205, 196, 182], float)   # the base sheet's beige T-shirt


def load(path):
    return pf.key_background(np.array(Image.open(path).convert('RGBA')), [255, 0, 255], 90)


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return ys.min(), ys.max() + 1, xs.min(), xs.max() + 1


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    base, clothes = load(sys.argv[1]), load(sys.argv[2])
    h, w = min(base.shape[0], clothes.shape[0]), min(base.shape[1], clothes.shape[1])
    base, clothes = base[:h, :w], clothes[:h, :w]
    out = base.copy()

    parts = split_parts(base[..., 3], 12)
    edges = [0] + [(parts[i][1] + parts[i + 1][0]) // 2 for i in range(len(parts) - 1)] + [w]
    for i in range(len(parts)):
        x0, x1 = edges[i], edges[i + 1]
        b, c = base[:, x0:x1], clothes[:, x0:x1]
        # The tee: beige pixels in the torso band (skin is close in colour, so
        # the head and hands are excluded by height and a tight tolerance).
        ys = np.nonzero(b[..., 3].max(1))[0]
        top, hgt = ys[0], ys[-1] - ys[0] + 1
        near = np.linalg.norm(b[..., :3].astype(float) - TEE, axis=-1) < 28
        tee = near & (b[..., 3] > 0)
        tee[:top + int(hgt * 0.47)] = False
        tee[top + int(hgt * 0.8):] = False
        cm = c[..., 3] > 0
        if tee.sum() < 50 or cm.sum() < 50:
            continue
        ty0, ty1, tx0, tx1 = bbox(tee)
        cy0, cy1, cx0, cx1 = bbox(cm)
        ty0 -= int((ty1 - ty0) * 0.06)                        # collar sits a bit above the tee's neckline
        src = c[cy0:cy1, cx0:cx1]
        fit = np.array(Image.fromarray(src).resize((tx1 - tx0, ty1 - ty0), Image.NEAREST))
        dst = out[ty0:ty1, x0 + tx0:x0 + tx1]
        m = fit[..., 3] > 0
        dst[m] = fit[m]
        print(f'figure {i + 1}: clothes {cy0}-{cy1} x{cx0}-{cx1} -> tee {ty0}-{ty1} x{tx0}-{tx1}')
    Image.fromarray(out).save(sys.argv[3])


if __name__ == '__main__':
    main()
