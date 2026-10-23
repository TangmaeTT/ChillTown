"""prep_asset - turn a ChatGPT day/night pair into the three textures the game uses.

  python tools/prep_asset.py art-in/train/P01__.png art-in/train/P01__night.png client/public/assets/props/train_head --width 224

writes <out>_day.png, <out>_night.png, <out>_glow.png (same size, pixel-aligned):
  _day    the day image, resampled to --width
  _night  the night image divided by the game's night ambient, so that after the game's darkening
          overlay multiplies it back it looks like the original night image
  _glow   what the overlay can't give back (bright lights: windows, lamps, headlights), drawn additively

Both images are cropped with the DAY image's bounding box so they stay aligned.
Needs Pillow + NumPy; reuses pixelfix.py.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402

# must match the night keyframe in client/src/view/lighting.ts ({ h: 0, ambient: [62, 80, 122] }, softened at h 19.6)
NIGHT_AMBIENT = np.array([66, 84, 125], np.float32) / 255


def load(path):
    return pf.key_background(np.array(Image.open(path).convert("RGBA")), [255, 0, 255], 90)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("day")
    ap.add_argument("night")
    ap.add_argument("out", help="output path prefix, e.g. client/public/assets/props/train_head")
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--colors", type=int, default=64)
    a = ap.parse_args()

    day, night = load(a.day), load(a.night)
    if day.shape != night.shape:
        sys.exit(f"day {day.shape} and night {night.shape} differ in size")
    ys, xs = np.nonzero(day[..., 3])
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    day, night = day[box], night[box].copy()
    night[..., 3] = day[..., 3]                       # one silhouette for both

    d = pf.resample(day, a.width)
    n = pf.resample(night, a.width)
    n[..., 3] = d[..., 3]

    # night = what the player should see; the game shows comp * ambient + glow
    want = n[..., :3].astype(np.float32)
    comp = np.clip(want / NIGHT_AMBIENT, 0, 255)
    glow = np.clip(want - comp * NIGHT_AMBIENT, 0, 255)
    # only keep glow where it's clearly a light, not dithering noise
    lit = glow.max(-1) > 24
    glow[~lit] = 0

    d = pf.reduce_colours(d, a.colors)
    nc = n.copy(); nc[..., :3] = comp.round().astype(np.uint8)
    nc = pf.reduce_colours(nc, a.colors)
    g = np.zeros_like(n)
    g[..., :3] = glow.round().astype(np.uint8)
    g[..., 3] = np.where(lit & (d[..., 3] > 0), 255, 0)

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    for suffix, img in (("day", d), ("night", nc), ("glow", g)):
        Image.fromarray(img).save(f"{out}_{suffix}.png")
    pf.report(d, f"{out.name}_day  ")
    print(f"glow pixels: {int(lit.sum())}")


if __name__ == "__main__":
    main()
