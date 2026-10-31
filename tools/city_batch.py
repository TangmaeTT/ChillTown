"""city_batch - have Codex draw the Siam city assets, one flat multi-view sheet per asset.

  python tools/city_batch.py --list                 # show the assets and what exists
  python tools/city_batch.py --only G1,C1,A1        # draw these (day, then night if lit)
  python tools/city_batch.py                        # draw everything that is missing

Every asset is drawn by Codex (torad's ChatGPT plan, not the API) so the whole city shares
one style: flat orthographic views side by side on magenta (front, side, top, ...), the same
pixel size (about 32 px per metre), palette and flat daylight as the style references
(art-in/city/ref_*.png). Lit assets get a second pass that edits the day image into night,
so tools/texture_from_ai.py can pull the lights out as emission. Ground pieces are a single
seamless top view. Output: art-in/city/<ID>_<name>_day.png / _night.png.
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'art-in' / 'city'
REFS = ['ref_building.png', 'ref_vending.png']

# id, name, description, views (left to right), real size, lights (None = unlit)
ASSETS = [
    # --- ground: one seamless top view each ---
    ('G1', 'asphalt', 'old Bangkok road asphalt, dark blue-grey, a few patched squares, hairline cracks, oil stains',
     'TOP', '2 m x 2 m square tile', None),
    ('G2', 'crosswalk', 'zebra crossing on the same old asphalt: two thick worn white stripes running top to bottom, paint chipped',
     'TOP', '2 m x 2 m square tile', None),
    ('G3', 'pavers', 'Bangkok sidewalk of square grey-beige concrete tiles 40 cm each, some cracked or sunken, plain (no yellow tactile strip, no edge border)',
     'TOP', '2 m x 2 m square tile', None),
    ('G4', 'soi_concrete', 'alley (soi) of poured concrete slabs with expansion joints, stains, a narrow drain channel with a metal grate along one edge',
     'TOP', '2 m x 2 m square tile', None),
    ('G5', 'plaza', 'station plaza floor of large light granite-look tiles 60 cm each with a darker border band',
     'TOP', '2 m x 2 m square tile', None),
    ('G6', 'curb', 'Bangkok road curb painted in alternating black and white blocks 50 cm long',
     'SIDE face of the curb, TOP of the curb', '2 m long, 0.15 m high, 0.25 m deep', None),
    ('G7', 'road_marks', 'road paint decals on transparent background: a dashed white lane line, a double yellow centre line, a white stop line, a white straight-ahead arrow, a white turn arrow',
     'each decal seen from the TOP, side by side', 'lane dash 3 m x 0.15 m, arrow 2 m long', None),
    ('G8', 'street_decals', 'street details seen from above: round cast-iron manhole cover, square drain grate, rectangular utility cover, a puddle-darkened patch, a small crack decal',
     'each piece seen from the TOP, side by side', 'manhole 0.7 m wide', None),
    # --- utilities ---
    ('U1', 'utility_pole', 'Bangkok concrete electricity pole with two crossarms, insulators, a grey transformer box and a tangle of black cables wrapped around it',
     'FRONT, SIDE, TOP', '0.35 m wide, 9 m tall', None),
    ('U2', 'wire_bundle', 'a long horizontal bundle of sagging tangled black electric and telecom cables, a few cable ties and a coiled loop',
     'SIDE view only, very wide and thin', '4 m long, 0.4 m thick', None),
    ('U3', 'pipes', 'set of building pipes: a grey PVC drainpipe straight piece, a drainpipe elbow, a thin metal conduit with clamps, a small rooftop water tank, a wall-mounted electric meter cluster',
     'each piece FRONT and SIDE, side by side', 'drainpipe 0.1 m wide 3 m long', None),
    ('U4', 'street_lamp', 'Bangkok street lamp: grey metal pole, single curved arm, flat lamp head',
     'FRONT, SIDE, TOP', '0.3 m wide pole, 7 m tall, arm reaches 1.5 m', 'the lamp head'),
    # --- skytrain ---
    ('B1', 'viaduct', 'elevated skytrain viaduct: concrete box girder with a parapet, rails and sleepers on top, drainage stains, a cable tray along the side',
     'SIDE (a 10 m segment), UNDERSIDE, TOP', '10 m long, 9 m wide, 2.2 m deep', None),
    ('B2', 'pier', 'skytrain support pier: thick concrete column with a T-shaped cap that holds the viaduct',
     'FRONT, SIDE, TOP', '2 m wide column, 9 m wide cap, 11 m tall', None),
    ('B3', 'station', 'elevated skytrain station box over the street: concrete and grey metal walls, long band of windows, curved metal roof, no signs',
     'FRONT (long side), SIDE (end), ROOF', '40 m long, 20 m wide, 9 m tall', 'the window band'),
    ('B4', 'station_stairs', 'covered staircase up to the skytrain station: concrete steps, metal handrails, translucent roof',
     'FRONT, SIDE, TOP', '2.5 m wide, 12 m long, 11 m tall', 'small lamps under the roof'),
    ('B5', 'skywalk', 'pedestrian skywalk segment: elevated walkway with glass-and-metal side panels and a light roof on slim columns',
     'SIDE (a 10 m segment), UNDERSIDE, TOP', '10 m long, 4 m wide, 3.5 m tall', 'the strip lights under the roof'),
    ('B6', 'train_head', 'skytrain head car: silver body with a muted teal stripe, sloped front cab with windscreen and headlights, sliding doors, windows',
     'SIDE, FRONT (cab end), ROOF', '20 m long, 3.1 m wide, 3.8 m tall', 'the windows, headlights'),
    ('B7', 'train_mid', 'same skytrain, middle car: no cab, gangway at both ends',
     'SIDE, END, ROOF', '20 m long, 3.1 m wide, 3.8 m tall', 'the windows'),
    # --- buildings: clean walls, shopfront opening as a magenta hole ---
    ('A1', 'shophouse_a', '3-storey Bangkok shophouse, dusty concrete, ground floor shopfront opening (leave it as a magenta hole), upper floors with windows and iron grilles, small balcony, NO air-con units, pipes or plants on the walls',
     'FRONT, SIDE, ROOF', '4.2 m wide, 14 m deep, 10.5 m tall', 'the upper windows'),
    ('A2', 'shophouse_b', '4-storey Bangkok shophouse, pale green paint peeling, ground floor shopfront opening (magenta hole), wrought-iron balconies on each upper floor, NO air-con units, pipes or plants',
     'FRONT, SIDE, ROOF', '4.2 m wide, 14 m deep, 13.5 m tall', 'the upper windows'),
    ('A3', 'shophouse_old', 'old 2-storey wood-and-plaster Bangkok shophouse, wooden folding doors on the ground floor (closed), wooden shutters upstairs, tiled roof',
     'FRONT, SIDE, ROOF', '4 m wide, 12 m deep, 7 m tall', 'a little light between the shutters'),
    ('A9', 'noodle_shop', 'Bangkok shophouse noodle shop, 3 storeys, ground floor fully open as a shopfront (magenta hole) under a faded canvas awning, NO air-con units, pipes or plants',
     'FRONT, SIDE, ROOF', '4.2 m wide, 14 m deep, 10.5 m tall', 'the upper windows'),
    ('A9i', 'noodle_interior', 'noodle shop interior kit: back wall with menu boards (no text) and shelves, a stainless noodle cooking station with pots, a stainless table, a stack of red plastic stools',
     'back wall FRONT; then each piece FRONT, SIDE, TOP', 'back wall 4 m wide 3 m tall; table 1.2 m', 'the menu boards, a hanging bulb'),
    # --- street props ---
    ('C1', 'spirit_house', 'Thai spirit house (san phra phum) on a pedestal: small gilded temple house, red-orange roof tiers, marigold garlands, tiny figurines and offerings',
     'FRONT, SIDE, TOP', '0.7 m wide, 2 m tall', 'a small offering lamp inside'),
    ('C2', 'noodle_cart', 'Bangkok street noodle cart: glass display case, steaming pots, gas tank below, umbrella',
     'FRONT, SIDE, TOP', '1.6 m long, 0.7 m wide, 2.2 m tall with umbrella', 'a hanging bulb'),
    ('C3', 'fruit_cart', 'Thai fruit cart with a glass ice case full of cut fruit (pineapple, watermelon, papaya), small canopy',
     'FRONT, SIDE, TOP', '1.4 m long, 0.6 m wide, 1.9 m tall', None),
    ('C4', 'grill_cart', 'moo ping grilled pork skewer cart: charcoal grill, skewers, small shelf, umbrella',
     'FRONT, SIDE, TOP', '1.2 m long, 0.6 m wide, 2 m tall', 'the glowing charcoal'),
    ('C5', 'lottery_stand', 'Thai lottery ticket seller stand: folding wooden board with rows of ticket sheets (blank, no numbers), stool',
     'FRONT, SIDE, TOP', '1 m wide, 1.2 m tall', None),
    ('C6', 'table_stools', 'stainless steel street-food table with four red plastic stools around it, condiment caddy on top',
     'FRONT, SIDE, TOP', '0.9 m x 0.6 m table, 0.75 m tall', None),
    ('C7', 'kiosk_drinks', 'small street kiosk selling drinks and snacks, counter opening on the front, striped awning, shelves of bottles, no brand',
     'FRONT, SIDE, ROOF', '2.5 m wide, 1.8 m deep, 2.6 m tall', 'a fluorescent tube inside'),
    ('C8', 'kiosk_flowers', 'flower and jasmine garland stall: buckets of flowers in front, hanging malai garlands, green awning',
     'FRONT, SIDE, ROOF', '2.5 m wide, 1.5 m deep, 2.5 m tall', 'a hanging bulb'),
    ('C9', 'police_box', 'Bangkok police booth: small white-and-blue box with tinted windows, flat roof with a little light',
     'FRONT, SIDE, ROOF', '1.8 m wide, 1.8 m deep, 2.6 m tall', 'the windows, the roof light'),
    ('C10', 'bus_stop', 'Bangkok bus stop shelter: metal roof, bench, blank advertising light box at one end, no text',
     'FRONT, SIDE, ROOF', '4 m wide, 1.5 m deep, 2.6 m tall', 'the light box'),
    ('C11', 'moto_stand', 'motorbike taxi stand: small roofed sign post (blank), a wooden bench, three orange vests hanging on a hook',
     'FRONT, SIDE, TOP', '2 m wide, 0.6 m deep, 2.3 m tall', None),
    ('C12', 'clock_post', 'old-fashioned street clock on a dark green ornate post, clock faces on all four sides (no numbers, just tick marks)',
     'FRONT, SIDE, TOP', '0.6 m wide, 4 m tall', 'the clock faces'),
    ('C13', 'bench', 'public bench: wooden slats, dark green cast-iron legs and armrests',
     'FRONT, SIDE, TOP', '1.8 m long, 0.6 m deep, 0.8 m tall', None),
    ('C14', 'trash_bins', 'pair of Bangkok public trash bins side by side, one orange and one green, with lids',
     'FRONT, SIDE, TOP', '1.1 m wide, 0.5 m deep, 1 m tall', None),
    ('C15', 'phone_booth', 'old Thai public phone booth: small yellow-blue shell on a post with a payphone, no text',
     'FRONT, SIDE, TOP', '0.7 m wide, 2.2 m tall', 'a small light in the hood'),
    ('C17', 'planter_tree', 'square concrete street planter with a small trimmed tree',
     'FRONT, SIDE, TOP', '1 m x 1 m planter, 3 m tall with tree', None),
    ('C18', 'rain_tree', 'big rain tree (chamchuri), wide umbrella canopy, short thick trunk',
     'FRONT only', '8 m wide canopy, 7 m tall', None),
    ('C19', 'shop_signs', 'three Thai shop signs: a standing A-frame light box, a vertical wall-mounted light box, a horizontal painted signboard; signs show only abstract shapes and colours, no text',
     'each sign FRONT and SIDE, side by side', 'vertical box 0.5 m x 1.6 m', 'the light boxes'),
    ('C20', 'barriers', 'traffic barrier set: orange-white plastic water-filled barrier, two orange cones, a striped metal crowd barrier',
     'each piece FRONT, SIDE, TOP, side by side', 'barrier 1.5 m long, 0.8 m tall', None),
    # --- vehicles: side, front, rear, roof ---
    ('D1', 'taxi_pink', 'Bangkok taxi, muted pink sedan, small roof sign (blank)',
     'SIDE, FRONT, REAR, ROOF', '4.6 m long, 1.75 m wide, 1.5 m tall', 'the headlights, tail lights, roof sign'),
    ('D2', 'taxi_green', 'Bangkok taxi, green lower body and yellow upper body and roof, small roof sign (blank)',
     'SIDE, FRONT, REAR, ROOF', '4.6 m long, 1.75 m wide, 1.5 m tall', 'the headlights, tail lights, roof sign'),
    ('D3', 'tuktuk', 'Thai tuk-tuk: three wheels, blue body, dark canopy roof, chrome trim',
     'SIDE, FRONT, REAR, ROOF', '3 m long, 1.4 m wide, 1.8 m tall', 'the headlight, tail lights'),
]

DAY = """Generate ONE image (use your built-in image generation tool) and save it in this folder as {file}. Do not write any code.

Attached are style references from our game: ref_building.png and ref_vending.png. Match their pixel size, palette, 1-pixel dark outline and flat daylight exactly, so this asset belongs to the same game.

Subject: {desc}.
Draw it as FLAT ORTHOGRAPHIC VIEWS (no perspective, not isometric): {views}. Put the views side by side from left to right on one canvas, all at the same scale, bottoms aligned, with wide plain magenta gaps between them.
Real size: {size}. Chunky pixel art at about 32 pixels per metre, scaled up with big hard square pixels.
The views are carved together into ONE 3D object, so they must agree exactly: the same length, width and height in every view that shows them, and every feature (roof units, doors, cab, awning) at the same place along the object in every view. The TOP/ROOF view looks straight down: no side walls visible in it.
Colour every surface right up to its outline with its own colour: NO pale rim, highlight band, bevel or shading strip along the edges of any view, only the 1-pixel dark outline.
Bangkok, Siam district, quiet and a little worn. Muted palette (dusty brick, moss green, blue-grey, warm greys), flat soft daylight from the top-left, no cast shadows, no ground, no sky.
Plain solid magenta #FF00FF background everywhere else. Flat colours, no gradients, no anti-aliasing, no blur. No text, no letters, no numbers, no logos, no real brands."""

GROUND = """Generate ONE image (use your built-in image generation tool) and save it in this folder as {file}. Do not write any code.

Attached are style references from our game: ref_building.png and ref_vending.png. Match their pixel size, palette and flat daylight exactly.

Subject: {desc}.
A SEAMLESS TILEABLE texture seen straight from above (top-down, no perspective), filling the whole square canvas edge to edge: its left edge must continue its right edge and its top edge its bottom edge.
Real size: {size}. Chunky pixel art at about 32 pixels per metre, scaled up with big hard square pixels.
Muted palette, flat soft daylight, flat colours, no gradients, no anti-aliasing, no blur. No text, no letters, no numbers, no logos."""

NIGHT = """Generate ONE image (use your built-in image generation tool) and save it in this folder as {file}. Do not write any code.

Edit the attached {day}: keep EXACTLY the same canvas size, layout, shapes, outlines and pixel positions. Change only the lighting to a quiet Bangkok night: dark blue ambient, overall brightness about 25-30%. {lights} glow warm orange and light only the surfaces right next to them. No new objects, no glow outside the object. Keep the plain solid magenta #FF00FF background."""


_CODEX = None


def codex():
    """The Store app's CLI. WindowsApps can't be listed, so ask PowerShell where the package is."""
    global _CODEX
    if _CODEX is None:
        loc = subprocess.run(['powershell', '-NoProfile', '-Command',
                              '(Get-AppxPackage -Name "OpenAI.Codex*").InstallLocation'],
                             capture_output=True, text=True).stdout.strip()
        exe = Path(loc) / 'app' / 'resources' / 'codex.exe'
        if not loc or not exe.exists():
            sys.exit('Codex app not found')
        _CODEX = str(exe)
    return _CODEX


def run(prompt, images, out):
    cmd = [codex(), 'exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', str(OUT)]
    for im in images:
        cmd += ['-i', im]
    t = time.time()
    r = subprocess.run(cmd + ['-'], input=prompt, text=True, encoding='utf-8', capture_output=True)
    ok = (OUT / out).exists()
    print(f'  {out}: {"ok" if ok else "MISSING"} ({time.time() - t:.0f}s)', flush=True)
    if not ok:
        print(r.stdout[-800:], r.stderr[-800:], flush=True)
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated ids')
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    want = set(a.only.split(',')) if a.only else None
    for aid, name, desc, views, size, lights in ASSETS:
        day, night = f'{aid}_{name}_day.png', f'{aid}_{name}_night.png'
        if a.list:
            have = 'day' if (OUT / day).exists() else '-'
            have += ' night' if lights and (OUT / night).exists() else ''
            print(f'{aid:4} {name:18} {views:40} {"lit" if lights else "   "} {have}')
            continue
        if want and aid not in want:
            continue
        print(aid, name, flush=True)
        if not (OUT / day).exists():
            tpl = GROUND if views == 'TOP' else DAY
            if not run(tpl.format(file=day, desc=desc, views=views, size=size), REFS, day):
                continue
        if lights and not (OUT / night).exists():
            run(NIGHT.format(file=night, day=day, lights=lights[0].upper() + lights[1:]), [day], night)


if __name__ == '__main__':
    main()
