"""texture_from_ai - turn a ChatGPT day/night pair of flat views into Godot face textures.

  python tools/texture_from_ai.py art-in/facade/shophouse_a_day.png art-in/facade/shophouse_a_night.png \
      godot/assets/textures/shophouse_a --widths 4.2
  python tools/texture_from_ai.py art-in/props/vending_day.png art-in/props/vending_night.png \
      godot/assets/textures/vending --widths 1.0,0.75 --names front,side --height 1.94
  python tools/texture_from_ai.py art-in/facade/corner_a_day.png art-in/facade/corner_a_night.png       godot/assets/textures/corner_a --widths 4.2,6,4.2 --names front,side,roof --heights 10.1,10.1,

The images are flat orthographic views on magenta (see the prompts in PROJECT_NOTES §6).
Parts side by side on one sheet are split at the magenta gaps, left to right, and each
is scaled to its real width in metres at --ppm game pixels per metre (project standard
32). Writes, for each part, <out>[_name]_albedo.png and <out>[_name]_emission.png, and
prints each part's size in pixels and metres.

Scaling picks the most common colour in each block (after reducing colours on the full
image), so AI "pixels" stay crisp instead of averaging to mush. Emission keeps only the
night image's lights (bright pixels that are much brighter than the darkened day).
Needs Pillow + NumPy; reuses pixelfix.py.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402

MAGENTA = [255, 0, 255]


def load(path):
    return pf.key_background(np.array(Image.open(path).convert("RGBA")), MAGENTA, 90)


def split_parts(alpha, min_gap):
    """Column ranges of the opaque parts, split where >= min_gap empty columns."""
    filled = alpha.max(0) > 0
    parts, start, gap = [], None, 0
    for x, f in enumerate(filled):
        if f:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                parts.append((start, x - gap + 1))
                start, gap = None, 0
    if start is not None:
        parts.append((start, len(filled) - gap))
    return parts


def mode_downscale(rgba, w, h):
    """Each output pixel = most common colour in its block; transparent if the block is mostly empty."""
    H, W = rgba.shape[:2]
    flat = rgba.reshape(-1, 4)
    keys, inv = np.unique(flat, axis=0, return_inverse=True)
    inv = inv.reshape(H, W)
    xs = np.linspace(0, W, w + 1).round().astype(int)
    ys = np.linspace(0, H, h + 1).round().astype(int)
    out = np.zeros((h, w, 4), np.uint8)
    for j in range(h):
        for i in range(w):
            block = inv[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].ravel()
            a = flat.reshape(H, W, 4)[ys[j]:ys[j + 1], xs[i]:xs[i + 1], 3].ravel()
            if (a > 0).mean() < 0.5:
                continue
            block = block[a > 0]
            out[j, i] = keys[np.bincount(block).argmax()]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("day")
    ap.add_argument("night")
    ap.add_argument("out", help="output path prefix, e.g. godot/assets/textures/vending")
    ap.add_argument("--widths", required=True, help="real width of each part in metres, left to right, comma-separated")
    ap.add_argument("--names", help="suffix for each part, comma-separated (default: none for one part, 0,1,.. otherwise)")
    ap.add_argument("--height", type=float, help="force every part to this height in metres (faces of one box must match)")
    ap.add_argument("--heights", help="height in metres per part, comma-separated; leave a slot empty to keep that part's "
                    "own proportions, e.g. 10.1,10.1, for front,side,roof")
    ap.add_argument("--ppm", type=int, default=32, help="game pixels per metre (project standard 32)")
    ap.add_argument("--colors", type=int, default=40)
    ap.add_argument("--min-gap", type=int, default=12, help="empty columns that separate parts")
    a = ap.parse_args()

    day, night = load(a.day), load(a.night)
    if day.shape != night.shape:
        # ChatGPT edits sometimes come back a pixel or two off; crop both to the overlap.
        if max(abs(p - q) for p, q in zip(day.shape, night.shape)) > 4:
            sys.exit(f"day {day.shape} and night {night.shape} differ in size")
        hh, ww = min(day.shape[0], night.shape[0]), min(day.shape[1], night.shape[1])
        day, night = day[:hh, :ww].copy(), night[:hh, :ww].copy()
    night[..., 3] = day[..., 3]                                      # one silhouette for both
    widths = [float(v) for v in a.widths.split(",")]
    parts = split_parts(day[..., 3], a.min_gap)
    if len(parts) != len(widths):
        sys.exit(f"found {len(parts)} parts {parts}, but --widths gives {len(widths)}")
    heights = [float(v) if v.strip() else None for v in a.heights.split(",")] if a.heights else [a.height] * len(parts)
    if len(heights) != len(parts):
        sys.exit(f"--heights gives {len(heights)} values for {len(parts)} parts")
    names = a.names.split(",") if a.names else ([""] if len(parts) == 1 else [str(i) for i in range(len(parts))])

    day_q = pf.reduce_colours(day, a.colors)
    night_q = pf.reduce_colours(night, a.colors)
    for (x0, x1), wm, hm, name in zip(parts, widths, heights, names):
        col = day[:, x0:x1, 3].max(1) > 0
        ys = np.nonzero(col)[0]
        box = (slice(ys.min(), ys.max() + 1), slice(x0, x1))
        w = round(wm * a.ppm)
        h = round(hm * a.ppm) if hm else round((box[0].stop - box[0].start) * w / (x1 - x0))
        d = mode_downscale(day_q[box], w, h)
        n = mode_downscale(night_q[box], w, h)

        lum_n = n[..., :3].astype(np.float32).max(-1)
        lum_d = d[..., :3].astype(np.float32).max(-1)
        lit = (lum_n > 140) & (lum_n > lum_d * 0.55) & (d[..., 3] > 0)
        em = np.zeros_like(n)
        em[lit, :3] = n[lit, :3]
        em[..., 3] = 255

        stem = f"{a.out}_{name}" if name else a.out
        Path(stem).parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(d).save(f"{stem}_albedo.png")
        Image.fromarray(em).save(f"{stem}_emission.png")
        print(f"{Path(stem).name}: {w}x{h} px = {w / a.ppm:.2f} x {h / a.ppm:.2f} m, lit pixels {int(lit.sum())}")


if __name__ == "__main__":
    main()
