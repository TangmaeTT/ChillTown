"""char_sheet - turn a ChatGPT character sheet (magenta background) into the game's player sprite sheet.

  python tools/char_sheet.py art-in/char/man1.png client/public/assets/player.png --height 52
  python tools/char_sheet.py --iso-down down.png --iso-up up.png client/public/assets/player.png --height 52

  python tools/char_sheet.py --stand stand.png --walk-down walk_down.png [--walk-up walk_up.png]
         [--emotes emotes.png] client/public/assets/player.png      (ChatGPT sheets from the prompts in chat)

--stand: 4 standing views in one row: down-left, down-right, up-left, up-right.
--walk-down / --walk-up: walk cycles in a 4x2 grid (down-left / up-right); missing --walk-up = the back
  views bob in step. --emotes: any grid (default 4x2) of extra poses -> <out>_extra.png.
Every mode also writes client/src/model/player_sheet.json (walk frame count + fps) for the game.

--iso-down / --iso-up: two walk-cycle grids (e.g. from Autosprite, transparent background, frames in a
regular grid): one walking toward the camera-left (down-left), one walking away to the right (up-right).
They're mirrored for down-right and up-left; every frame of the cycle is used.

Expected input layout (what ChatGPT gave us for man1.png):
  row 1: front, front, left, back, right, front          (standing, 4 directions)
  row 2: 8 walking frames, facing front
  row 3: idle, wave, happy, sit (front), sit (back), lying down

Output: player.png in the game's format (68x68 frames, 8 rows E SE S SW W NW N NE, col 0 = standing,
cols 1-8 = walk) and <name>_extra.png (68x68: idle, wave, happy, sit, sit_back, lie).
Directions the art doesn't have reuse the nearest view (down-diagonals face front, up-diagonals face
back); views with no walk cycle bob up and down in step instead.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import pixelfix as pf  # noqa: E402

FRAME, FEET_Y = 68, 60
BOB = [0, -1, -1, 0, 0, -1, -1, 0]          # walk bob for views without a walk cycle


def runs(v, gap):
    idx = np.nonzero(v)[0]
    out, s, p = [], idx[0], idx[0]
    for x in idx[1:]:
        if x - p > gap:
            out.append((s, p + 1)); s = x
        p = x
    out.append((s, p + 1))
    return out


def split_wide(m, c0, c1, typical):
    """frames that touch: cut at the emptiest column(s)"""
    n = max(1, round((c1 - c0) / typical))
    if n == 1:
        return [(c0, c1)]
    cuts, col = [c0], m[:, c0:c1].sum(0)
    for k in range(1, n):
        mid = int((c1 - c0) * k / n)
        win = range(max(1, mid - typical // 4), min(c1 - c0 - 1, mid + typical // 4))
        cut = min(win, key=lambda x: col[x])
        # only a real seam between two figures is thin; a wide single pose (lying down) is solid there
        if col[cut] > 0.15 * col.max():
            return [(c0, c1)]
        cuts.append(c0 + cut)
    cuts.append(c1)
    return list(zip(cuts[:-1], cuts[1:]))


def frames(rgba):
    m = rgba[..., 3] > 0
    rows = runs(m.sum(1) > 2, 20)
    out = []
    for r0, r1 in rows:
        cols = runs(m[r0:r1].sum(0) > 0, 8)
        typical = int(np.median([c1 - c0 for c0, c1 in cols if c1 - c0 < 260]))
        row = []
        for c0, c1 in cols:
            for a, b in split_wide(m[r0:r1], c0, c1, typical):
                row.append(pf.trim(rgba[r0:r1, a:b]))
        out.append(row)
    return out


def place(sheet, img, col, row, dy=0, mirror=False):
    if mirror:
        img = img[:, ::-1]
    h, w = img.shape[:2]
    # centre on the feet (bottom fifth), so a bag or a raised arm doesn't shift the body
    feet = img[int(h * 0.8):, :, 3] > 0
    xs = np.nonzero(feet.any(0))[0]
    cx = (xs.min() + xs.max()) / 2 if len(xs) else w / 2
    x0 = int(round(col * FRAME + FRAME / 2 - cx))
    y0 = row * FRAME + FEET_Y - h + dy
    region = sheet[y0:y0 + h, x0:x0 + w]
    mask = img[..., 3] > 0
    region[mask] = img[mask]


SHEET_JSON = Path(__file__).resolve().parent.parent / "client" / "src" / "model" / "player_sheet.json"


def write_sheet_json(walk_frames, fps):
    import json
    SHEET_JSON.write_text(json.dumps({"walkFrames": walk_frames, "walkFps": fps}, indent=2) + "\n")
    print(f"wrote {SHEET_JSON.name}: {walk_frames} walk frames at {fps} fps")


def grid_frames(path, cols, rows, count):
    """frames laid out in a regular grid (Autosprite exports), trimmed"""
    a = np.array(Image.open(path).convert("RGBA"))
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)          # soft edges -> hard pixel edges
    cw, ch = a.shape[1] // cols, a.shape[0] // rows
    out = []
    for k in range(count):
        cell = a[(k // cols) * ch:(k // cols + 1) * ch, (k % cols) * cw:(k % cols + 1) * cw]
        if cell[..., 3].any():
            out.append(pf.trim(cell))
    return out


def iso_pair(a):
    down = grid_frames(a.iso_down, a.cols, a.rows, a.count)
    up = grid_frames(a.iso_up, a.cols, a.rows, a.count)
    print(f"walk frames: down {len(down)}, up {len(up)}")
    scale = np.median([f.shape[0] for f in down]) / a.height
    small = lambda im: pf.resample(im, max(1, round(im.shape[1] / scale)))
    down, up = [small(f) for f in down], [small(f) for f in up]
    n = min(len(down), len(up))

    def standing(frames):
        # the frame with the feet closest together
        def spread(im):
            feet = im[int(im.shape[0] * 0.85):, :, 3] > 0
            xs = np.nonzero(feet.any(0))[0]
            return xs.max() - xs.min() if len(xs) else 99
        return min(frames, key=spread)

    sheet = np.zeros((8 * FRAME, (n + 1) * FRAME, 4), np.uint8)
    # rows: E SE S SW W NW N NE -> (cycle, mirrored)
    views = [(down, True), (down, True), (down, False), (down, False), (down, False), (up, True), (up, False), (up, False)]
    for r, (cycle, mirror) in enumerate(views):
        place(sheet, standing(cycle), 0, r, mirror=mirror)
        for f in range(n):
            place(sheet, cycle[f], f + 1, r, mirror=mirror)
    sheet = pf.reduce_colours(sheet, a.colors)
    Image.fromarray(sheet).save(a.out)
    pf.report(sheet, "player")
    print(f"saved {a.out}: {n} walk frames per direction")
    write_sheet_json(n, 20)


def gpt_sheets(a):
    """ChatGPT: a row of 4 standing views + 4x2 walk grids (+ optional emotes grid)"""
    stand = grid_frames(a.stand, 4, 1, 4)
    walk_dn = grid_frames(a.walk_down, 4, 2, 8)
    walk_up = grid_frames(a.walk_up, 4, 2, 8) if a.walk_up else None
    scale = stand[0].shape[0] / a.height
    small = lambda im, sc: pf.resample(im, max(1, round(im.shape[1] / sc)))
    dl, dr, ul, ur = (small(f, scale) for f in stand)
    # walk frames are matched to the standing height (a stride is a touch shorter)
    wsc = lambda frames: np.median([f.shape[0] for f in frames]) / (a.height * 0.98)
    walk_dn = [small(f, wsc(walk_dn)) for f in walk_dn]
    walk_up = [small(f, wsc(walk_up)) for f in walk_up] if walk_up else None
    n = len(walk_dn)

    sheet = np.zeros((8 * FRAME, (n + 1) * FRAME, 4), np.uint8)
    # rows: E SE S SW W NW N NE -> (standing, walk cycle or None to bob, mirror the cycle)
    rows = [
        (dr, walk_dn, True), (dr, walk_dn, True), (dl, walk_dn, False), (dl, walk_dn, False), (dl, walk_dn, False),
        (ul, walk_up, True), (ur, walk_up, False), (ur, walk_up, False),
    ]
    for r, (still, cycle, mirror) in enumerate(rows):
        place(sheet, still, 0, r)
        for f in range(n):
            if cycle:
                place(sheet, cycle[f % len(cycle)], f + 1, r, mirror=mirror)
            else:
                place(sheet, still, f + 1, r, dy=BOB[f % len(BOB)])
    sheet = pf.reduce_colours(sheet, a.colors)
    Image.fromarray(sheet).save(a.out)
    pf.report(sheet, "player")
    write_sheet_json(n, 10)

    if a.emotes:
        ex = [small(e, scale) for e in grid_frames(a.emotes, a.cols, a.rows, a.count)]
        sheet = np.zeros((FRAME, len(ex) * FRAME, 4), np.uint8)
        for k, e in enumerate(ex):
            place(sheet, e if e.shape[1] <= FRAME else pf.resample(e, FRAME - 2), k, 0)
        sheet = pf.reduce_colours(sheet, a.colors)
        path = Path(a.out).with_name(Path(a.out).stem + "_extra.png")
        Image.fromarray(sheet).save(path)
        print("saved", path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", nargs="?", help="single ChatGPT sheet (layout above)")
    ap.add_argument("out")
    ap.add_argument("--iso-down"); ap.add_argument("--iso-up")
    ap.add_argument("--stand"); ap.add_argument("--walk-down"); ap.add_argument("--walk-up"); ap.add_argument("--emotes")
    ap.add_argument("--cols", type=int, default=None); ap.add_argument("--rows", type=int, default=None)
    ap.add_argument("--count", type=int, default=None, help="frames in each grid")
    ap.add_argument("--height", type=int, default=52, help="standing height in game pixels")
    ap.add_argument("--colors", type=int, default=32)
    a = ap.parse_args()
    if a.stand and a.walk_down:
        a.cols, a.rows, a.count = a.cols or 4, a.rows or 2, a.count or 8
        return gpt_sheets(a)
    if a.iso_down and a.iso_up:
        a.cols, a.rows, a.count = a.cols or 5, a.rows or 4, a.count or 18
        return iso_pair(a)

    rgba = pf.key_background(np.array(Image.open(a.src).convert("RGBA")), [255, 0, 255], 110)
    rows = frames(rgba)
    print("frames per row:", [len(r) for r in rows])
    stand, walk, extra = rows[0], rows[1], rows[2]
    # ChatGPT draws each row at its own size, so each row gets its own scale (walk frames are matched
    # to the standing height; extras use the standing scale since sitting/lying are meant to be lower)
    scale = stand[0].shape[0] / a.height
    walk_scale = np.median([w.shape[0] for w in walk[:8]]) / (a.height * 0.98)   # a stride is a touch shorter
    small = lambda im, sc: pf.resample(im, max(1, round(im.shape[1] / sc)))
    front, left, back, right = (small(stand[k], scale) for k in (0, 2, 3, 4))
    walk = [small(w, walk_scale) for w in walk[:8]]
    extra_scale = extra[0].shape[0] / a.height                                     # extras row: first frame stands
    extra = [small(e, extra_scale) for e in extra]
    print(f"scales: stand {scale:.2f}, walk {walk_scale:.2f}, extras {extra_scale:.2f}")

    sheet = np.zeros((8 * FRAME, 9 * FRAME, 4), np.uint8)
    # rows: E SE S SW W NW N NE  -> (standing view, has walk cycle)
    views = [(right, False), (front, True), (front, True), (front, True), (left, False), (back, False), (back, False), (back, False)]
    for r, (view, walks) in enumerate(views):
        place(sheet, view, 0, r)
        for f in range(8):
            if walks:
                place(sheet, walk[f], f + 1, r)
            else:
                place(sheet, view, f + 1, r, dy=BOB[f])
    sheet = pf.reduce_colours(sheet, a.colors)
    Image.fromarray(sheet).save(a.out)

    ex = np.zeros((FRAME, len(extra) * FRAME, 4), np.uint8)
    for k, e in enumerate(extra):
        if e.shape[1] > FRAME:
            e = pf.resample(e, FRAME - 2)
        place(ex, e, k, 0)
    ex = pf.reduce_colours(ex, a.colors)
    extra_path = Path(a.out).with_name(Path(a.out).stem + "_extra.png")
    Image.fromarray(ex).save(extra_path)
    pf.report(sheet, "player")
    print("saved", a.out, "and", extra_path)


if __name__ == "__main__":
    main()
