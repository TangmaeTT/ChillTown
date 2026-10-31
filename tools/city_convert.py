"""city_convert - turn the Codex city sheets (tools/city_batch.py) into Godot textures.

  python tools/city_convert.py            # every sheet in art-in/city that has a rule below
  python tools/city_convert.py C1 A1      # just these

Each sheet's views were drawn at one scale, so every part is scaled by the same factor, set by
one known real size (tools/texture_from_ai.py --uniform-height / --uniform-width). Writes
godot/assets/textures/city_<name>[_<view>]_albedo.png + _emission.png (32 px per metre).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-in' / 'city'
DST = ROOT / 'godot' / 'assets' / 'textures'
PY = sys.executable

FSR = 'front,side,roof'   # buildings
FSP = 'front,side,top'    # roofed props: PropKit.textured_box looks for _top
FST = 'front,side,top'
# id: (name, mode, metres, view names or None for numbered pieces)
#   mode 'h' = first view is this tall, 'w' = first view is this wide, 'tile' = square ground tile
RULES = {
    'G1': ('asphalt', 'tile', 2, None),
    'G2': ('crosswalk', 'tile', 2, None),
    'G3': ('pavers', 'tile', 2, None),
    'G4': ('soi_concrete', 'tile', 2, None),
    'G5': ('plaza', 'tile', 2, None),
    'G6': ('curb', 'w', 2, 'side,top'),
    'G7': ('road_marks', 'h', 3, None),
    'G8': ('street_decals', 'w', 0.7, None),
    'U1': ('utility_pole', 'h', 9, FST),
    'U2': ('wire_bundle', 'w', 4, None),
    'U3': ('pipes', 'h', 3, None),
    'U4': ('street_lamp', 'h', 7, FST),
    'B1': ('viaduct', 'w', 10, 'side,under,top'),
    'B2': ('pier', 'h', 11, FST),
    'B3': ('station', 'h', 9, FSP),
    'B4': ('station_stairs', 'h', 11, FST),
    'B5': ('skywalk', 'w', 10, 'side,under,top'),
    'B6': ('train_head', 'w', 20, 'side,front,roof'),
    'B7': ('train_mid', 'w', 20, 'side,end,roof'),
    'A1': ('shophouse_a', 'h', 10.5, FSR),
    'A2': ('shophouse_b', 'h', 13.5, FSR),
    'A3': ('shophouse_old', 'h', 7, FSR),
    'A9': ('noodle_shop', 'h', 10.5, FSR),
    'A4': ('mini_mart', 'h', 7, FSR),
    'A5': ('cafe', 'h', 7.5, FSR),
    'A6': ('pharmacy', 'h', 10.5, FSR),
    'A7': ('condo', 'h', 19, FSR),
    'A8': ('gold_shop', 'h', 10.5, FSR),
    'A9i': ('noodle_interior', 'w', 4, None),
    'C1': ('spirit_house', 'h', 2, FST),
    'C2': ('noodle_cart', 'h', 2.2, FST),
    'C3': ('fruit_cart', 'h', 1.9, FST),
    'C4': ('grill_cart', 'h', 2, FST),
    'C5': ('lottery_stand', 'h', 1.2, FST),
    'C6': ('table_stools', 'w', 1.6, FST),
    'C7': ('kiosk_drinks', 'h', 2.6, FSP),
    'C8': ('kiosk_flowers', 'h', 2.5, FSP),
    'C9': ('police_box', 'h', 2.6, FSP),
    'C10': ('bus_stop', 'w', 4, FSP),
    'C11': ('moto_stand', 'h', 2.3, FST),
    'C12': ('clock_post', 'h', 4, FST),
    'C13': ('bench', 'w', 1.8, FST),
    'C14': ('trash_bins', 'w', 1.1, FST),
    'C15': ('phone_booth', 'h', 2.2, FST),
    'C17': ('planter_tree', 'h', 3, FST),
    'C18': ('rain_tree', 'w', 8, None),
    'C19': ('shop_signs', 'h', 1.1, None),
    'C20': ('barriers', 'w', 1.5, None),
    'C21': ('ac_unit', 'w', 0.8, FSP),
    'C22': ('meter_box', 'h', 0.7, FSP),
    'C23': ('bin_twin', 'h', 1.0, FSP),
    'C24': ('motorbike', 'w', 0.75, FSP),     # front view width (the first view sets the scale)
    'I1': ('mart_shelf', 'h', 1.5, FSP),
    'I2': ('mart_fridge', 'h', 2.1, FSP),
    'I3': ('mart_counter', 'h', 1.1, FSP),
    'I4': ('cafe_counter', 'h', 1.2, FSP),
    'I5': ('cafe_table', 'h', 0.9, FSP),
    'I6': ('pharmacy_shelf', 'h', 2.1, FSP),
    'I7': ('gold_counter', 'h', 1.0, FSP),
    'I8': ('gold_wall', 'h', 2.2, FSP),
    'I9': ('arcade_cabinet', 'w', 0.8, FSP),
    'I10': ('claw_machine', 'w', 1.0, FSP),
    'I11': ('barber_station', 'w', 1.4, FSP),
    'I12': ('clothes_rack', 'w', 1.6, FSP),
    'D1': ('taxi_pink', 'w', 4.6, 'side,front,rear,roof'),
    'D2': ('taxi_green', 'w', 4.6, 'side,front,rear,roof'),
    'D3': ('tuktuk', 'w', 3, 'side,front,rear,roof'),
    'D4': ('city_bus', 'w', 10.5, 'side,front,rear,roof'),
    'D5': ('sedan_white', 'w', 4.4, 'side,front,rear,roof'),
    'D6': ('pickup', 'w', 5.2, 'side,front,rear,roof'),
}


def one_row(day, night, tmp):
    """Codex sometimes stacks views in rows (a roof under the front). Lay every view out in
    one row, left to right, top band first, so texture_from_ai's column split finds them."""
    import numpy as np
    from PIL import Image
    sys.path.insert(0, str(ROOT / 'tools'))
    from texture_from_ai import load, split_parts
    d = load(day)
    rows = split_parts(d[..., 3].T, 12)                 # row bands = column parts of the transpose
    if len(rows) < 2:
        return day, night
    n = load(night) if night.exists() else None
    pieces = []
    for y0, y1 in rows:
        for x0, x1 in split_parts(d[y0:y1, :, 3], 12):
            pieces.append((y0, y1, x0, x1))
    gap = 40
    W = sum(x1 - x0 for _, _, x0, x1 in pieces) + gap * (len(pieces) + 1)
    H = max(y1 - y0 for y0, y1, _, _ in pieces) + 2 * gap
    outs = []
    for src in (d, n):
        if src is None:
            outs.append(None)
            continue
        canvas = np.zeros((H, W, 4), np.uint8)
        canvas[..., 0] = canvas[..., 2] = 255
        canvas[..., 3] = 255
        x = gap
        for y0, y1, x0, x1 in pieces:
            part = src[y0:y1, x0:x1]
            m = part[..., 3] > 0
            region = canvas[H - gap - (y1 - y0):H - gap, x:x + (x1 - x0)]
            region[m] = part[m]
            x += (x1 - x0) + gap
        outs.append(canvas)
    dp, np_ = tmp / f'{day.stem}.png', tmp / f'{night.stem}.png'
    Image.fromarray(outs[0]).save(dp)
    if outs[1] is not None:
        Image.fromarray(outs[1]).save(np_)
    return dp, (np_ if outs[1] is not None else night)


def convert(aid):
    name, mode, metres, views = RULES[aid]
    day = SRC / f'{aid}_{name}_day.png'
    night = SRC / f'{aid}_{name}_night.png'
    if not day.exists():
        print(f'{aid}: no sheet yet')
        return False
    tmp = SRC / 'tmp'
    tmp.mkdir(exist_ok=True)
    day, night = one_row(day, night, tmp)
    cmd = [PY, str(ROOT / 'tools' / 'texture_from_ai.py'), str(day), str(night) if night.exists() else '-',
           str(DST / f'city_{name}')]
    if mode == 'tile':
        cmd += ['--widths', str(metres), '--height', str(metres), '--min-gap', '9999']
    else:
        cmd += ['--uniform-height' if mode == 'h' else '--uniform-width', str(metres)]
        if views:
            cmd += ['--names', views]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(f'{aid}: ' + (r.stdout.strip().replace('\n', ' | ') or r.stderr.strip().splitlines()[-1]))
    if r.returncode == 0 and views == FSR:
        # Buildings are boxes: close the see-through outline dots and wall margins.
        r2 = subprocess.run([PY, str(ROOT / 'tools' / 'seal_facades.py'), name], capture_output=True, text=True)
        print('  ' + (r2.stdout.strip() or r2.stderr.strip()))
    return r.returncode == 0


def main():
    ids = sys.argv[1:] or list(RULES)
    bad = [a for a in ids if not convert(a)]
    if bad:
        print('not converted:', ', '.join(bad))


if __name__ == '__main__':
    main()
