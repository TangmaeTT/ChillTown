"""pixelfix - turn an AI-generated "pixel art" image into true pixel art for Chill Town.

Steps: key out the magenta background -> find the fake-pixel grid offset -> shrink each
scale x scale block to one pixel (most common colour, not an average) -> optional pull
toward the project palette -> reduce colours -> hard 0/255 alpha -> trim.

Examples:
  python pixelfix.py shop_ai.png shop.png                     # building from ChatGPT/Gemini, scale 4, 48 colours
  python pixelfix.py shop_ai.png shop.png --scale 4 --colors 32
  python pixelfix.py player.png player_moody.png --scale 1 --pull 0.35 --sat 0.8 --keep-size
                                                              # already-pixel art (PixelLab): recolour only
  python pixelfix.py train_ai.png train.png --width 160       # no clean pixel grid (ChatGPT): resample to a target width
  python pixelfix.py any.png --check                          # just report size, colours, brightness

Needs Pillow + NumPy (Miniconda).
"""
import argparse
import sys

import numpy as np
from PIL import Image

# Project palette (PROJECT_NOTES.md section 3), plus the warm accent light
PALETTE = ["#152d47", "#17364f", "#285265", "#3b5849", "#4d6c55", "#648566", "#8ab074",
           "#343940", "#51444a", "#67565a", "#8f7068", "#0a0d0d", "#d3ca90"]


def hex_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_lab(rgb):
    """rgb: (..., 3) floats 0-255 -> CIE Lab, for perceptual colour distance."""
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def key_background(rgba, key, tol):
    """Make pixels near the key colour transparent; strip magenta spill from the fringe."""
    rgb = rgba[..., :3].astype(np.float32)
    dist = np.linalg.norm(rgb - np.array(key, np.float32), axis=-1)
    alpha = rgba[..., 3].copy()
    alpha[dist < tol] = 0
    out = rgba.copy()
    out[..., 3] = alpha
    if tuple(key) == (255, 0, 255):  # despill: magenta fringe = R and B both well above G
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        spill = np.clip(np.minimum(r, b) - g, 0, None)
        fringe = (spill > 40) & (alpha > 0)
        out[..., 0] = np.where(fringe, r - spill * 0.6, r).astype(np.uint8)
        out[..., 2] = np.where(fringe, b - spill * 0.6, b).astype(np.uint8)
    return out


def best_offset(rgba, s):
    """The fake pixels rarely start at (0,0): pick the grid offset with the least colour variance inside blocks."""
    if s == 1:
        return 0, 0
    rgb = rgba[..., :3].astype(np.float32)
    best = None
    for oy in range(s):
        for ox in range(s):
            h = (rgb.shape[0] - oy) // s * s
            w = (rgb.shape[1] - ox) // s * s
            blk = rgb[oy:oy + h, ox:ox + w].reshape(h // s, s, w // s, s, 3)
            v = blk.var(axis=(1, 3)).mean()
            if best is None or v < best[0]:
                best = (v, ox, oy)
    return best[1], best[2]


def downscale(rgba, s, ox, oy):
    """One output pixel per s x s block: the block's most common colour (keeps edges crisp)."""
    if s == 1:
        return rgba
    h = (rgba.shape[0] - oy) // s
    w = (rgba.shape[1] - ox) // s
    blk = rgba[oy:oy + h * s, ox:ox + w * s].reshape(h, s, w, s, 4).transpose(0, 2, 1, 3, 4).reshape(h, w, s * s, 4)
    out = np.zeros((h, w, 4), np.uint8)
    # quantise to 5 bits per channel to vote, then average the members of the winning bin
    q = (blk[..., :3] >> 3).astype(np.int32)
    code = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]
    opaque = blk[..., 3] >= 128
    code = np.where(opaque, code, -1)
    for y in range(h):
        for x in range(w):
            c = code[y, x]
            if (c >= 0).sum() * 2 < s * s:  # mostly transparent block
                continue
            vals, counts = np.unique(c[c >= 0], return_counts=True)
            win = vals[counts.argmax()]
            out[y, x, :3] = blk[y, x][c == win, :3].mean(0).round()
            out[y, x, 3] = 255
    return out


def resample(rgba, width):
    """For AI images without a regular fake-pixel grid: trim, then area-average down to `width`.
    Colour is averaged over opaque pixels only, so edges don't pick up the background."""
    rgba = trim(rgba)
    h = max(1, round(rgba.shape[0] * width / rgba.shape[1]))
    a = rgba[..., 3:4].astype(np.float32) / 255
    pre = np.concatenate([rgba[..., :3] * a, a], axis=-1)        # premultiplied
    small = np.array(Image.fromarray((pre[..., :3]).astype(np.uint8)).resize((width, h), Image.Resampling.BOX)).astype(np.float32)
    cov = np.array(Image.fromarray((a[..., 0] * 255).astype(np.uint8)).resize((width, h), Image.Resampling.BOX)).astype(np.float32) / 255
    rgb = np.clip(small / np.maximum(cov[..., None], 1e-3), 0, 255)
    out = np.zeros((h, width, 4), np.uint8)
    out[..., :3] = rgb.round().astype(np.uint8)
    out[..., 3] = np.where(cov >= 0.5, 255, 0)
    return out


def adjust(rgba, pull, sat, palette):
    rgb = rgba[..., :3].astype(np.float32)
    if sat != 1.0:
        grey = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
        rgb = np.clip(grey + (rgb - grey) * sat, 0, 255)
    if pull > 0:
        pal = np.array(palette, np.float32)
        d = np.linalg.norm(rgb_to_lab(rgb)[..., None, :] - rgb_to_lab(pal)[None, None], axis=-1)
        rgb = rgb + (pal[d.argmin(-1)] - rgb) * pull
    out = rgba.copy()
    out[..., :3] = np.clip(rgb, 0, 255).round().astype(np.uint8)
    return out


def snap_to_palette(rgba, palette):
    rgb = rgba[..., :3].astype(np.float32)
    pal = np.array(palette, np.float32)
    d = np.linalg.norm(rgb_to_lab(rgb)[..., None, :] - rgb_to_lab(pal)[None, None], axis=-1)
    out = rgba.copy()
    out[..., :3] = pal[d.argmin(-1)].astype(np.uint8)
    return out


def reduce_colours(rgba, n, iters=30):
    """k-means in Lab over opaque pixels only. Median cut lost small saturated areas
    (plants, red stools) in testing; k-means keeps them."""
    opaque = rgba[..., 3] > 0
    px = rgba[opaque][:, :3].astype(np.float32)
    uniq, inv, counts = np.unique(px, axis=0, return_inverse=True, return_counts=True)
    if len(uniq) <= n:
        return rgba
    lab = rgb_to_lab(uniq)
    w = counts.astype(np.float32)
    # deterministic farthest-point init so rare-but-distinct colours get a centre
    centres = [lab[w.argmax()]]
    dmin = np.linalg.norm(lab - centres[0], axis=1)
    for _ in range(n - 1):
        centres.append(lab[dmin.argmax()])
        dmin = np.minimum(dmin, np.linalg.norm(lab - centres[-1], axis=1))
    c = np.array(centres)
    for _ in range(iters):
        a = np.linalg.norm(lab[:, None] - c[None], axis=-1).argmin(1)
        for k in range(n):
            m = a == k
            if m.any():
                c[k] = (lab[m] * w[m, None]).sum(0) / w[m].sum()
    rgb_c = np.array([(uniq[a == k] * w[a == k, None]).sum(0) / w[a == k].sum() if (a == k).any() else (0, 0, 0)
                      for k in range(n)])
    out = rgba.copy()
    out[opaque, :3] = rgb_c[a[inv.ravel()]].round().astype(np.uint8)
    return out


def trim(rgba):
    ys, xs = np.nonzero(rgba[..., 3])
    if len(ys) == 0:
        return rgba
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def report(rgba, label):
    opaque = rgba[..., 3] > 0
    px = rgba[opaque][:, :3].astype(np.float32)
    n = len(np.unique(px, axis=0)) if len(px) else 0
    bright = (px @ np.array([0.299, 0.587, 0.114])).mean() / 255 * 100 if len(px) else 0
    sat = ((px.max(1) - px.min(1)) / np.maximum(px.max(1), 1)).mean() * 100 if len(px) else 0
    print(f"{label}: {rgba.shape[1]}x{rgba.shape[0]} px, {n} colours, brightness {bright:.0f}% (target ~30%), saturation {sat:.0f}%")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--scale", type=int, default=4, help="AI pixels per real pixel (project standard: 4; 1 = already true pixel art)")
    ap.add_argument("--width", type=int, help="resample to this width instead of --scale (images with no clean pixel grid)")
    ap.add_argument("--colors", type=int, default=48, help="max colours (0 = no reduction)")
    ap.add_argument("--bg", default="#ff00ff", help="background key colour, or 'none'")
    ap.add_argument("--tol", type=float, default=90, help="background key tolerance (RGB distance)")
    ap.add_argument("--pull", type=float, default=0.0, help="0-1: move each colour toward its nearest project-palette colour")
    ap.add_argument("--sat", type=float, default=1.0, help="saturation multiplier, e.g. 0.8 to mute")
    ap.add_argument("--snap", action="store_true", help="force every pixel onto the project palette exactly")
    ap.add_argument("--palette", help="comma-separated hex colours to use instead of the project palette")
    ap.add_argument("--keep-size", action="store_true", help="don't trim transparent borders (keep sprite-sheet frames aligned)")
    ap.add_argument("--check", action="store_true", help="only report stats")
    a = ap.parse_args()

    img = np.array(Image.open(a.src).convert("RGBA"))
    report(img, "input ")
    if a.check:
        return
    if not a.dst:
        sys.exit("need an output path (or --check)")
    palette = [hex_rgb(h) for h in (a.palette.split(",") if a.palette else PALETTE)]

    if a.bg.lower() != "none":
        img = key_background(img, hex_rgb(a.bg), a.tol)
    if a.width:
        img = resample(img, a.width)
    else:
        ox, oy = best_offset(img, a.scale)
        if a.scale > 1:
            print(f"grid offset: x={ox} y={oy}")
        img = downscale(img, a.scale, ox, oy)
    img = adjust(img, a.pull, a.sat, palette)
    img = snap_to_palette(img, palette) if a.snap else (reduce_colours(img, a.colors) if a.colors else img)
    img[..., 3] = np.where(img[..., 3] >= 128, 255, 0)
    if not a.keep_size:
        img = trim(img)
    Image.fromarray(img).save(a.dst)
    report(img, "output")


if __name__ == "__main__":
    main()
