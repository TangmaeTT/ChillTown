"""gen_ground - draw the tileable pixel-art ground textures (no AI needed).

  python tools/gen_ground.py godot/assets/textures

Writes, at the project standard of 32 px per metre, each 64x64 (2 m) and seamless:
  ground_pavers_albedo.png   square 0.5 m concrete pavers: grout lines, per-slab shade,
                             bevel, speckles and the odd crack
  ground_asphalt_albedo.png  dark asphalt: aggregate speckle and a few wrapping cracks
Colours are near-white multipliers around 1.0 so the material colour still sets the hue.
Deterministic (fixed seed). Needs NumPy + Pillow.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 64
SLAB = 16


def pavers(rng):
    img = np.zeros((SIZE, SIZE, 3), np.float32)
    shades = np.array([1.0, 0.94, 1.05, 0.9, 0.98])
    for ty in range(SIZE // SLAB):
        for tx in range(SIZE // SLAB):
            s = shades[rng.integers(len(shades))]
            tint = 1 + rng.normal(0, 0.015, 3)
            y0, x0 = ty * SLAB, tx * SLAB
            img[y0:y0 + SLAB, x0:x0 + SLAB] = s * tint
            img[y0 + 1, x0 + 1:x0 + SLAB - 1] *= 1.08                 # bevel light, top
            img[y0 + 1:y0 + SLAB - 1, x0 + 1] *= 1.05                 # left
            img[y0 + SLAB - 2, x0 + 2:x0 + SLAB - 1] *= 0.9            # bevel shadow, bottom
            for _ in range(rng.integers(2, 6)):                        # speckles
                py, px = y0 + rng.integers(2, SLAB - 2), x0 + rng.integers(2, SLAB - 2)
                img[py, px] *= rng.choice([0.82, 1.1])
            if rng.random() < 0.22:                                    # crack
                py, px = y0 + rng.integers(3, SLAB - 3), x0 + 2
                for _ in range(rng.integers(5, 11)):
                    img[py, px] *= 0.7
                    px = min(x0 + SLAB - 3, px + 1)
                    py = int(np.clip(py + rng.integers(-1, 2), y0 + 2, y0 + SLAB - 3))
    grout = np.zeros((SIZE, SIZE), bool)
    grout[::SLAB, :] = True
    grout[:, ::SLAB] = True
    img[grout] = 0.62
    return img


def asphalt(rng):
    img = np.full((SIZE, SIZE, 3), 1.0, np.float32)
    noise = rng.random((SIZE, SIZE))
    img[noise < 0.10] *= 0.86
    img[noise > 0.94] *= 1.22
    img[(noise > 0.985)] *= 1.15
    for _ in range(3):                                                 # cracks wrap at the edges
        y, x = rng.integers(SIZE), rng.integers(SIZE)
        for _ in range(rng.integers(10, 22)):
            img[y % SIZE, x % SIZE] *= 0.72
            x += 1
            y += rng.integers(-1, 2)
    return img


def save(img, path):
    Image.fromarray((np.clip(img, 0, 2) / 2 * 255).round().astype(np.uint8)).save(path)


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "godot/assets/textures")
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    save(pavers(rng), out / "ground_pavers_albedo.png")
    save(asphalt(rng), out / "ground_asphalt_albedo.png")
    print("wrote", out / "ground_pavers_albedo.png", out / "ground_asphalt_albedo.png")


if __name__ == "__main__":
    main()
