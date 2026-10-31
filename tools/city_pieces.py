"""city_pieces - name the loose pieces of multi-piece Codex sheets as front/side/top sets.

  python tools/city_pieces.py

tools/city_convert.py splits sheets like C19 shop signs, C20 barriers, U3 pipes and the A9i
noodle-shop kit into numbered
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
    'city_drainpipe': ('city_pipes', 0, 1, None),
    'city_pipe_elbow': ('city_pipes', 2, 3, None),
    'city_conduit': ('city_pipes', 4, 5, None),
    'city_water_tank': ('city_pipes', 6, 7, None),
    'city_meter_cluster': ('city_pipes', 8, 9, None),
    'city_noodle_station': ('city_noodle_interior', 1, 2, 3),
    'city_noodle_table': ('city_noodle_interior', 4, 5, 6),
    'city_stool_stack': ('city_noodle_interior', 7, 8, 9),
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
