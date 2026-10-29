"""walk_sheet - build the game's player sheet from ChatGPT walk strips (one per drawn direction).

  python tools/walk_sheet.py --s art-in/char/walk_s_pose.png --n art-in/char/walk_n_pose.png
         [--sw ...] [--w ...] [--nw ...] [--scale 5] [--out client/public/assets/player.png]

Each strip: 9 figures in a row on magenta (frame 1 standing, then the walk; see tools/pose_template.py), as
ChatGPT returned it. Steps: pixelfix at --scale (the AI's pixel grid) -> cut the figures -> one 96 px cell each,
feet on one line. The 5 drawn directions are mirrored for the other 3 (SE from SW, E from W, NE from NW).
A direction not given yet borrows the nearest one that is (S, SW, W, NW, N in a ring), so the game always has 8.
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
from strip_frames import split  # noqa: E402

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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for d in DRAWN:
        ap.add_argument('--' + d)
    ap.add_argument('--scale', type=int, default=5)
    ap.add_argument('--colors', type=int, default=40)
    ap.add_argument('--fps', type=float, default=10)
    ap.add_argument('--out', default=str(ROOT / 'client/public/assets/player.png'))
    a = ap.parse_args()

    got = {d: strip(getattr(a, d), a.scale, a.colors) for d in DRAWN if getattr(a, d)}
    if not got:
        sys.exit('give at least one direction')
    for d, fr in got.items():
        hs = [f.shape[0] for f in fr]
        print(f'{d:>2}: {len(fr)} figures, height {min(hs)}-{max(hs)} px')

    def nearest(d):
        i = DRAWN.index(d)
        for step in range(len(DRAWN)):
            for j in (i - step, i + step):
                if 0 <= j < len(DRAWN) and DRAWN[j] in got:
                    return DRAWN[j]
    walk_n = min(len(f) for f in got.values()) - 1
    sheet = np.zeros((8 * CELL, (walk_n + 1) * CELL, 4), np.uint8)
    for r, (d, mirror) in enumerate(ROWS):
        src = nearest(d)
        for k, f in enumerate(got[src][:walk_n + 1]):
            if mirror:
                f = f[:, ::-1]
            h, w = f.shape[:2]
            top, left = FEET - h + 1, (CELL - w) // 2
            cell = sheet[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL]
            m = f[..., 3] > 0
            cell[top:top + h, left:left + w][m] = f[m]
        if src != d:
            print(f'   row {r} ({d}{" mirrored" if mirror else ""}) borrows {src}')
    Image.fromarray(sheet).save(a.out)
    height = max(max(f.shape[0] for f in fr) for fr in got.values())
    meta = {'walkFrames': walk_n, 'walkFps': a.fps, 'frame': CELL, 'feet': FEET, 'height': height, 'speed': 70}
    (ROOT / 'client/src/model/player_sheet.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(f'saved {a.out}: {walk_n} walk frames per direction; player_sheet.json {meta}')


if __name__ == '__main__':
    main()
