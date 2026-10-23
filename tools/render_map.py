"""Top-down plan of all rooms, drawn from shared/rooms.ts (the same data the game uses).

  python tools/render_map.py            -> design/siam-map.png

North (toward the mall) is up. Each panel is one room; gold strips are exits, arrows show where they lead.
Needs Node 22.6+ (to read the .ts file) and Pillow.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design" / "siam-map.png"
T = 16  # px per tile

GROUND = {"plaza": "#4a4d47", "sidewalk": "#5d5f57", "road": "#2a2e31", "crosswalk": "#a9ab9c", "soi": "#3a3e3f",
          "water": "#1f4a6b", "wood": "#6b5440", "grass": "#3b5849", "tile": "#b8b4aa", "rail": "#3e3a36"}
CODES = {"p": "plaza", "s": "sidewalk", "r": "road", "c": "crosswalk", "o": "soi", "w": "water", "d": "wood", "g": "grass", "t": "tile", "x": "rail"}
# where each room's panel sits on the sheet (in tiles), roughly matching real geography
LAYOUT = {"mall": (4, 3), "canal": (36, 3), "plaza": (2, 27), "soi": (8, 51), "concourse": (40, 31), "platform": (38, 47)}

FONT = "C:/Windows/Fonts/LeelawUI.ttf"
FONT_B = "C:/Windows/Fonts/LeelaUIb.ttf"


def load_rooms():
    js = ("Promise.all([import('./shared/rooms.ts'), import('./shared/skytrain.ts')])"
          ".then(([r, s]) => console.log(JSON.stringify({ rooms: r.ROOMS, skytrain: s.SKYTRAIN })))")
    out = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "-e", js],
                         cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return json.loads(out)


def hexrgb(c):
    return "#%06x" % c if isinstance(c, int) else c


def main():
    data = load_rooms()
    rooms, sky = data["rooms"], data["skytrain"]
    W = max(x + rooms[k]["w"] for k, (x, y) in LAYOUT.items()) + 4
    H = max(y + rooms[k]["h"] for k, (x, y) in LAYOUT.items()) + 4
    img = Image.new("RGB", (W * T, H * T), "#0f1316")
    d = ImageDraw.Draw(img)
    f_small, f_mid, f_big = ImageFont.truetype(FONT, 11), ImageFont.truetype(FONT, 13), ImageFont.truetype(FONT_B, 20)
    centres = {}

    for rid, (ox, oy) in LAYOUT.items():
        r = rooms[rid]
        px = lambda i, j: ((ox + i) * T, (oy + j) * T)
        for i in range(r["w"]):
            for j in range(r["h"]):
                g = CODES[r["ground"][j][i]]
                x, y = px(i, j)
                d.rectangle([x, y, x + T - 1, y + T - 1], fill=GROUND[g])
        for b in r["boxes"]:
            x0, y0 = px(b["i0"], b["j0"])
            x1, y1 = px(b["i1"] + 1, b["j1"] + 1)
            if b.get("elevated"):
                d.rectangle([x0, y0, x1 - 1, y1 - 1], outline="#c9cdc4", width=2)
                for k in range(x0 - (y1 - y0), x1, 10):  # hatch = overhead structure
                    d.line([max(k, x0), y0 + max(0, x0 - k), min(k + (y1 - y0), x1 - 1), y0 + min(y1 - y0, x1 - 1 - k)], fill="#6f736d")
            else:
                col = "#d9a35b" if b.get("image") else hexrgb(b["color"])
                d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=col, outline="#0e1014")
            label = b.get("label") or ("ร้านก๋วยเตี๋ยว (ภาพจริง)" if b.get("image") else None)
            if label:
                tw = d.textlength(label, font=f_small)
                d.text(((x0 + x1 - tw) / 2, (y0 + y1) / 2 - 7), label, font=f_small, fill="#f2f2e6",
                       stroke_width=2, stroke_fill="#0e1014")
        if r.get("scenery") == "skytrain":   # drawn in code from shared/skytrain.ts, not boxes
            ex = lambda i, j: ((ox + i + 0.5) * T, (oy + j + 0.5) * T)   # tile-edge coords -> px
            def over(i0, j0, i1, j1, label=None):
                (x0, y0), (x1, y1) = ex(i0, j0), ex(i1, j1)
                d.rectangle([x0, y0, x1, y1], outline="#c9cdc4", width=2)
                for k in range(int(x0 - (y1 - y0)), int(x1), 10):
                    d.line([max(k, x0), y0 + max(0, x0 - k), min(k + (y1 - y0), x1), y0 + min(y1 - y0, x1 - k)], fill="#6f736d")
                if label:
                    tw = d.textlength(label, font=f_small)
                    d.text(((x0 + x1 - tw) / 2, (y0 + y1) / 2 - 7), label, font=f_small, fill="#f2f2e6", stroke_width=2, stroke_fill="#0e1014")
            dk, st = sky["deck"], sky["station"]
            over(-0.5, dk["j0"], r["w"] - 0.5, dk["j1"], "รางรถไฟฟ้าลอยฟ้า")
            c = st["concourse"]; over(c["i0"], c["j0"], c["i1"], c["j1"], "สถานี (ชั้นขายตั๋ว + ชานชาลา)")
            for i in sky["pillars"]:
                (x0, y0), (x1, y1) = ex(i - 0.3, sky["pillarJ"] - 0.3), ex(i + 0.3, sky["pillarJ"] + 0.3)
                d.rectangle([x0, y0, x1, y1], fill="#9a9d96", outline="#0e1014")
            for stp in sky["stairs"]:
                (x0, y0), (x1, y1) = ex(stp["i0"], stp["j0"]), ex(stp["i1"], stp["j1"])
                d.rectangle([x0, y0, x1, y1], fill="#b0b2aa", outline="#0e1014")
                for k in range(1, 10):
                    yy = y0 + (y1 - y0) * k / 10
                    d.line([x0, yy, x1, yy], fill="#80827a")
                tw = d.textlength("บันได", font=f_small)
                d.text(((x0 + x1 - tw) / 2, (y0 + y1) / 2 - 7), "บันได", font=f_small, fill="#f2f2e6", stroke_width=2, stroke_fill="#0e1014")
        for l in r["lamps"]:
            x, y = px(l["i"], l["j"])
            d.ellipse([x + 4, y + 4, x + T - 5, y + T - 5], fill="#d3ca90")
        for e in r["exits"]:
            x0, y0 = px(e["i0"], e["j0"])
            x1, y1 = px(e["i1"] + 1, e["j1"] + 1)
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill="#d3ca90" if e["to"] else "#8f7068")
            centres.setdefault(rid, {})[e["to"] or "x"] = ((x0 + x1) / 2, (y0 + y1) / 2)
        sx, sy = px(r["spawn"]["i"], r["spawn"]["j"])
        x0, y0 = px(0, 0)
        d.rectangle([x0 - 1, y0 - 1, *px(r["w"], r["h"])], outline="#d3ca90", width=1)
        d.text((x0, y0 - 28), f"{r['name']}  ({r['w']}×{r['h']} ช่อง)", font=f_big, fill="#e9eed8")

    # connections
    done = set()
    for a, exits in centres.items():
        for b, pa in exits.items():
            if b in centres and (b, a) not in done and a in centres[b]:
                pb = centres[b][a]
                d.line([pa, pb], fill="#d3ca90", width=3)
                done.add((a, b))

    lx, ly = (W - 18) * T, (H - 15) * T
    d.text((lx, ly), "สัญลักษณ์", font=f_mid, fill="#e9eed8")
    items = [("#5d5f57", "ทางเท้า/ลาน"), ("#2a2e31", "ถนน (เดินไม่ได้)"), ("#a9ab9c", "ทางม้าลาย"), ("#1f4a6b", "น้ำ"),
             ("#7d7468", "ตึก/ร้าน (กล่องเทา)"), ("#d9a35b", "มีภาพจริงแล้ว"), ("#d3ca90", "ทางออก/ไฟถนน"),
             ("#8f7068", "ทางเข้าที่ยังไม่เปิด")]
    for k, (c, t) in enumerate(items):
        d.rectangle([lx, ly + 24 + k * 20, lx + 14, ly + 38 + k * 20], fill=c, outline="#0e1014")
        d.text((lx + 22, ly + 22 + k * 20), t, font=f_small, fill="#e9eed8")
    d.rectangle([lx, ly + 24 + 8 * 20, lx + 14, ly + 38 + 8 * 20], outline="#c9cdc4", width=2)
    d.text((lx + 22, ly + 22 + 8 * 20), "ของลอยเหนือหัว (รางรถไฟฟ้า หลังคา)", font=f_small, fill="#e9eed8")
    d.text((T, (H - 2) * T), "ทิศเหนืออยู่ด้านบน · 1 ช่อง = 1 tile (64×32 ในเกม) · เดินราว 2 ช่อง/วินาที", font=f_mid, fill="#9fb08f")

    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT)
    print("saved", OUT)


if __name__ == "__main__":
    main()
