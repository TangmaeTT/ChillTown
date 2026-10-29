"""walk_sheet - build the game's player sheet from ChatGPT walk strips (one per drawn direction).

  python tools/walk_sheet.py --s art-in/char/walk_s_pose.png --n art-in/char/walk_n_pose.png
         [--sw ...] [--w ...] [--nw ...] [--scale 5] [--out client/public/assets/player.png]

Each strip: 9 figures in a row on magenta (frame 1 standing, then the walk; see tools/pose_template.py), as
ChatGPT returned it. Steps: pixelfix at --scale (the AI's pixel grid) -> cut the figures -> one 96 px cell each,
feet on one line. The 5 drawn directions are mirrored for the other 3 (SE from SW, E from W, NE from NW).
A direction not given yet borrows the nearest one that is (diagonals prefer front/back), so the game always has 8.
Writes the sheet and client/src/model/player_sheet.json (frame, feet, height, walk frames).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from strip_frames import split, head  # noqa: E402

ROOT = Path(__file__).parent.parent
CELL, FEET = 96, 90
DRAWN = ['s', 'sw', 'w', 'nw', 'n']
# game rows E SE S SW W NW N NE -> (drawn direction, mirrored)
ROWS = [('w', True), ('sw', True), ('s', False), ('sw', False), ('w', False), ('nw', False), ('n', False), ('nw', True)]


def strip(path, scale, colors):
    """pixelfix the strip (as a separate run, same as by hand) and cut it into figures"""
    tmp = ROOT / 'art-in' / '.walk_tmp.png'
    subprocess.run([sys.executable, str(ROOT / 'tools/pixelfix.py'), path, str(tmp), '--scale', str(scale),
                    '--colors', str(colors)], check=True, capture_output=True)
    frames = split(np.array(Image.open(tmp).convert('RGBA')))
    tmp.unlink()
    return frames


def head_height(f):
    """rows from the top of the figure down to the neck (where it narrows under the widest part of the head)"""
    al = f[..., 3] > 0
    widths = al.sum(1)
    peak = int(np.argmax(widths[:40]))
    return next((y for y in range(peak, f.shape[0]) if widths[y] < 0.6 * widths[peak]), peak)


def stride_speed(side, walk_n, fps):
    """how fast to move so the planted foot doesn't slide: one step (feet apart minus a foot) per half cycle"""
    if not side:
        return 45
    spans = []
    for f in side[1:]:
        feet = f[-6:, :, 3] > 0
        xs = np.nonzero(feet.any(0))[0]
        spans.append(xs[-1] - xs[0] + 1)
    step = max(spans) * 0.65    # the widest stance minus a foot: about two thirds of it (measured on the base)
    return round(step / (walk_n / 2) * fps)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for d in DRAWN:
        ap.add_argument('--' + d)
    ap.add_argument('--scale', type=int, default=5)
    ap.add_argument('--colors', type=int, default=40)
    ap.add_argument('--fps', type=float, default=8)
    ap.add_argument('--height', type=int, help='make every direction this tall overall (default: match head size to the front view S)')
    ap.add_argument('--speed', type=float, help='walk speed in px/s (default: from the side view stride, so feet do not slide)')
    ap.add_argument('--out', default=str(ROOT / 'client/public/assets/player.png'))
    a = ap.parse_args()

    got = {d: strip(getattr(a, d), a.scale, a.colors) for d in DRAWN if getattr(a, d)}
    if not got:
        sys.exit('give at least one direction')
    # every direction the same size: an AI draws each sheet a little bigger or smaller. Matched on the HEAD's
    # height (a chibi is read by its big head; one sheet can have a longer body and a smaller head), or on the
    # whole height with --height. Scaled by whole pixels (nearest), not averaged, so it stays crisp.
    ref = got.get('s', next(iter(got.values())))[0]
    for d, fr in got.items():
        h0, hh0 = fr[0].shape[0], head_height(fr[0])
        k = a.height / h0 if a.height else head_height(ref) / hh0
        if abs(k - 1) > 0.02:
            got[d] = fr = [np.array(Image.fromarray(f).resize((max(1, round(f.shape[1] * k)), max(1, round(f.shape[0] * k))), Image.NEAREST)) for f in fr]
        hs = [f.shape[0] for f in fr]
        print(f'{d:>2}: {len(fr)} figures, head {hh0} -> {head_height(fr[0])} px, height {h0} -> {min(hs)}-{max(hs)} px')

    # a missing direction borrows the closest drawn one: diagonals prefer front/back over the side view
    BORROW = {'s': ['sw', 'w', 'nw', 'n'], 'sw': ['s', 'w', 'nw', 'n'], 'w': ['sw', 'nw', 's', 'n'],
              'nw': ['n', 'w', 'sw', 's'], 'n': ['nw', 'w', 'sw', 's']}

    def nearest(d):
        return d if d in got else next(x for x in BORROW[d] if x in got)
    walk_n = min(len(f) for f in got.values()) - 1
    sheet = np.zeros((8 * CELL, (walk_n + 1) * CELL, 4), np.uint8)
    for r, (d, mirror) in enumerate(ROWS):
        src = nearest(d)
        for k, f in enumerate(got[src][:walk_n + 1]):
            if mirror:
                f = f[:, ::-1]
            h, w = f.shape[:2]
            # centre on the head, not the whole figure: swinging arms change the width, the head stays put
            top, left = FEET - h + 1, int(round(CELL / 2 - head(f)[2]))
            cell = sheet[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL]
            m = f[..., 3] > 0
            cell[top:top + h, left:left + w][m] = f[m]
        if src != d:
            print(f'   row {r} ({d}{" mirrored" if mirror else ""}) borrows {src}')
    Image.fromarray(sheet).save(a.out)
    height = max(max(f.shape[0] for f in fr) for fr in got.values())
    speed = a.speed or stride_speed(got.get('w'), walk_n, a.fps)
    meta = {'walkFrames': walk_n, 'walkFps': a.fps, 'frame': CELL, 'feet': FEET, 'height': height, 'speed': speed}
    (ROOT / 'client/src/model/player_sheet.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(f'saved {a.out}: {walk_n} walk frames per direction; player_sheet.json {meta}')


if __name__ == '__main__':
    main()
