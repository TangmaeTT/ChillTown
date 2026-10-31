"""city_pieces - name the loose pieces of multi-piece Codex sheets as front/side/top sets.

  python tools/city_pieces.py

tools/city_convert.py splits sheets like C19 shop signs and C20 barriers into numbered
pieces (city_barriers_0, _1, ...). This copies the pieces of each object to
city_<object>_{front,side,top}_{albedo,emission}.png so tools/voxel_from_views.py can carve
them, then carves them.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / 'godot' / 'assets' / 'textures'
# object -> (sheet, front piece, side piece, top piece or None)
SETS = {
    'city_sign_aframe': ('city_shop_signs', 0, 1, None),
    'city_sign_lightbox': ('city_shop_signs', 2, 3, None),
    'city_barrier_water': ('city_barriers', 0, 1, 2),
    'city_cone': ('city_barriers', 3, 4, 5),
    'city_crowd_barrier': ('city_barriers', 9, 10, 11),
}


def main():
    for name, (sheet, f, s, t) in SETS.items():
        for part, i in (('front', f), ('side', s), ('top', t)):
            for kind in ('albedo', 'emission'):
                dst = TEX / f'{name}_{part}_{kind}.png'
                if i is None:
                    dst.unlink(missing_ok=True)
                    continue
                shutil.copyfile(TEX / f'{sheet}_{i}_{kind}.png', dst)
    subprocess.run([sys.executable, str(ROOT / 'tools' / 'voxel_from_views.py'), *SETS], check=True)


if __name__ == '__main__':
    main()
