"""train_align - make the three skytrain cars join up.

ChatGPT draws each car with a slightly different, not-quite-2:1 slope, so cars placed by their
image bounds step and overlap. This:
  1. shears every car (day, night and glow alike) so its long roof edge runs at exactly 2:1 (slope 0.5)
  2. finds where that roof edge starts (rear) and ends (front) in each sprite
  3. writes client/src/model/train_layout.json, which the game uses to put each car's rear
     on the previous car's front (and to know how long a train is)

  python tools/train_align.py          (run after tools/prep_asset.py made train_{head,mid,tail}_*.png)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "client" / "public" / "assets" / "props"
LAYOUT = ROOT / "client" / "src" / "model" / "train_layout.json"
CARS = ["head", "mid", "tail"]
LAYERS = ["day", "night", "glow"]


def roof_line(alpha):
    """slope and points of the long top edge (top silhouette in the middle of the car)"""
    W = alpha.shape[1]
    xs = np.arange(int(W * 0.2), int(W * 0.65))
    tops = np.array([np.argmax(alpha[:, x]) for x in xs])
    m, c = np.polyfit(xs, tops, 1)
    return m, c


def shear(img, m, pivot_x):
    """move each column vertically so a line of slope m becomes slope 0.5 (adds rows as needed)"""
    a = np.array(img)
    H, W = a.shape[:2]
    shift = np.round((0.5 - m) * (np.arange(W) - pivot_x)).astype(int)
    pad_top, pad_bot = max(0, -shift.min()), max(0, shift.max())
    out = np.zeros((H + pad_top + pad_bot, W, 4), np.uint8)
    for x in range(W):
        out[pad_top + shift[x]: pad_top + shift[x] + H, x] = a[:, x]
    return Image.fromarray(out), pad_top


def main():
    layout = {}
    for car in CARS:
        imgs = {l: Image.open(DIR / f"train_{car}_{l}.png").convert("RGBA") for l in LAYERS}
        alpha = np.array(imgs["day"])[..., 3] > 0
        m, _ = roof_line(alpha)
        W = alpha.shape[1]
        sheared = {}
        for l, im in imgs.items():
            sheared[l], _ = shear(im, m, W / 2)
            sheared[l].save(DIR / f"train_{car}_{l}.png")
        a2 = np.array(sheared["day"])[..., 3] > 0
        m2, c2 = roof_line(a2)
        # the roof edge = columns whose top silhouette sits on the fitted line
        tops = np.array([np.argmax(a2[:, x]) if a2[:, x].any() else -1 for x in range(W)])
        on = [x for x in range(W) if tops[x] >= 0 and abs(tops[x] - (m2 * x + c2)) <= 2.5]
        rear, front = min(on), max(on)
        layout[car] = {
            "w": W, "h": a2.shape[0],
            "rear": [rear, round(m2 * rear + c2, 1)],
            "front": [front, round(m2 * front + c2, 1)],
        }
        print(f"{car}: slope {m:.3f} -> {m2:.3f}, roof edge x {rear}..{front}, size {W}x{a2.shape[0]}")
    LAYOUT.write_text(json.dumps(layout, indent=2))
    for car, v in layout.items():
        print(f"{car}: {(v['front'][0] - v['rear'][0]) / 32:.2f} tiles along the track")


if __name__ == "__main__":
    main()
