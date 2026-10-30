"""face_from_ref - cut a chibi face (eyes, brows, blush, mouth) out of a reference
drawing into a transparent decal for the 3D head, plus a closed-eyes copy for blinking.

  python tools/face_from_ref.py art-in/char/designbase.png godot/assets/textures/face_base \
      --box 180,282,350,400 --width 22 --smile

--box    the face features' rectangle in the reference (x0,y0,x1,y1), inside the head
--width  decal width in game pixels. The decal spans the box's share of the head, so
         width = box width / head width x head size in metres x 32 px per metre.
Skin-coloured pixels (sampled from the box's top corners) become transparent; blush,
being redder, stays. Writes <out>_open.png and <out>_closed.png. Needs NumPy + Pillow.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from texture_from_ai import mode_downscale  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ref")
    ap.add_argument("out")
    ap.add_argument("--box", required=True)
    ap.add_argument("--width", type=int, required=True)
    ap.add_argument("--smile", action="store_true",
                    help="draw a 3-pixel smile at the bottom centre (thin mouths vanish when shrunk)")
    ap.add_argument("--tol", type=float, default=26, help="RGB distance from skin that still counts as skin")
    a = ap.parse_args()

    x0, y0, x1, y1 = (int(v) for v in a.box.split(","))
    rgb = np.array(Image.open(a.ref).convert("RGB"))[y0:y1, x0:x1].astype(np.float32)
    skin = np.median(np.concatenate([rgb[:6, :6].reshape(-1, 3), rgb[:6, -6:].reshape(-1, 3)]), axis=0)
    dist = np.linalg.norm(rgb - skin, axis=-1)
    rgba = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = rgb.astype(np.uint8)
    magenta = (rgb[..., 0] > 200) & (rgb[..., 2] > 200) & (rgb[..., 1] < 90)
    rgba[..., 3] = np.where((dist > a.tol) & ~magenta, 255, 0)

    h = round(rgba.shape[0] * a.width / rgba.shape[1])
    small = mode_downscale(rgba, a.width, h)
    # The head outline can poke into the bottom corners; drop near-black pixels there.
    low = small[int(h * 0.7):]
    low[(low[..., :3].astype(int).sum(-1) < 120)] = 0
    if a.smile:
        mouth = np.array([190, 105, 100, 255], np.uint8)
        cx = a.width // 2
        small[h - 2, cx - 2] = mouth
        small[h - 1, cx - 1:cx + 1] = mouth
        small[h - 2, cx + 1] = mouth
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(small).save(f"{a.out}_open.png")

    # Closed eyes: each eye (dark blob in the upper two thirds) becomes a short
    # curved lash line along its lower half.
    closed = small.copy()
    lum = small[..., :3].astype(np.float32).mean(-1)
    dark = (small[..., 3] > 0) & (lum < 110)
    dark[:int(h * 0.25)] = False                         # brows live in the top quarter
    dark[int(h * 0.8):] = False
    cols = np.nonzero(dark.any(0))[0]
    groups = np.split(cols, np.nonzero(np.diff(cols) > 1)[0] + 1) if len(cols) else []
    line = np.array([60, 40, 40, 255], np.uint8)
    for g in groups:
        if len(g) < 3:
            continue                                     # brow ends / specks
        ys = np.nonzero(dark[:, g].any(1))[0]
        if ys.max() - ys.min() < 2:
            continue                                     # a brow, not an eye
        top, bottom = ys.min(), ys.max()
        # Clear the eye (dark pixels plus the whites between them) ...
        box = closed[top:bottom + 1, g.min():g.max() + 1]
        box[..., 3] = 0
        # ... and draw the lash line two thirds down, ends one pixel higher.
        yl = top + (bottom - top) * 2 // 3
        for x in range(g.min(), g.max() + 1):
            edge = x in (g.min(), g.max())
            closed[yl - (1 if edge else 0), x] = line
    Image.fromarray(closed).save(f"{a.out}_closed.png")
    print(f"face {a.width}x{h} px, skin {skin.round()}, eyes {len([g for g in groups if len(g) >= 3])}")


if __name__ == "__main__":
    main()
