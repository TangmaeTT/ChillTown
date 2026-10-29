import { Scene } from 'phaser';
import { SKIN_TONES, CLOTH_COLORS, TOPS, BOTTOMS, type Look } from '@shared/avatar';
import { hex, luma, onRamp } from './recolor';
import body from '../../model/player_body.json';

// head parts and drawn tops are loaded under this key (head/<id>.png)
export const PART_KEY = (id: string) => `head_${id}`;
// part view (SE, SW, NW, NE) drawn for each player.png row (E, SE, S, SW, W, NW, N, NE)
export const VIEW_OF_ROW = [0, 0, 1, 1, 1, 2, 3, 3];

// Dress the base body: copy player.png and re-draw each pixel by its region (player_regions.png, from
// tools/body_regions.py): the top's colour, pattern and sleeves, the bottom's colour and length, the shoes,
// and the skin tone. Every pixel keeps its own shading (its brightness within its region -> place on the ramp).

export const REGIONS_KEY = 'player_regions';

// region colours in the map (keep in step with REGIONS in tools/body_regions.py)
const REGION: Record<string, string> = {
    '255,0,0': 'arm', '255,160,0': 'hand', '0,120,255': 'shirt', '0,200,0': 'pants',
    '160,255,0': 'shin', '160,0,255': 'shoe', '40,40,40': 'line',
};
const STRIPE_EVERY = 3;
const LIGHT = 1, NAVY = 4;   // CLOTH_COLORS: the stripe colour on dark tops / on light tops

/**
 * A texture of the base sheet dressed in `look` (cached by its clothes and skin). `skin` = the sheet's skin
 * colours (player_rig.json): head, neck and hands are recoloured to the skin tone, as before.
 */
export function dressed(scene: Scene, src: string, look: Look, frame: number, skin: string[]): string {
    const key = `${src}@${look.skin}.${look.top}-${look.topColor}.${look.bottom}-${look.bottomColor}.${look.shoes}`;
    if (scene.textures.exists(key)) return key;
    const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
    const map = scene.textures.get(REGIONS_KEY).getSourceImage() as HTMLImageElement;
    const w = img.width, h = img.height, n = w * h;
    const tex = scene.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    ctx.drawImage(map, 0, 0);
    const reg = ctx.getImageData(0, 0, w, h).data;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const orig = new Uint8ClampedArray(px);    // shading is read from here, so writes never feed later reads

    const skinSet = new Set(skin.map(s => s.toLowerCase()));
    const region: (string | undefined)[] = new Array(n);
    const isSkin = new Uint8Array(n);
    const bright = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
        if (!px[i + 3]) continue;
        if (reg[i + 3]) region[p] = REGION[`${reg[i]},${reg[i + 1]},${reg[i + 2]}`];
        isSkin[p] = skinSet.has('#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')) ? 1 : 0;
        bright[p] = luma(orig[i], orig[i + 1], orig[i + 2]);
    }
    // brightness range of each kind of source pixel: its darkest goes to the ramp's shadow, its lightest to the highlight
    const range = (want: (p: number) => boolean) => {
        let lo = 255, hi = 0;
        for (let p = 0, i = 0; p < n; p++, i += 4) if (px[i + 3] && want(p)) { lo = Math.min(lo, bright[p]); hi = Math.max(hi, bright[p]); }
        return (p: number) => hi > lo ? (bright[p] - lo) / (hi - lo) : 0.5;
    };
    const tSkin = range(p => isSkin[p] === 1);
    const tShirt = range(p => region[p] === 'shirt');
    const tPants = range(p => region[p] === 'pants' || region[p] === 'shin');
    const tShoe = range(p => region[p] === 'shoe');

    // the top row of the shirt in each frame, so stripes stay put on the body when it bobs
    const cols = Math.floor(w / frame);
    const frameOf = (p: number) => { const x = p % w, y = (p - x) / w; return Math.floor(y / frame) * cols + Math.floor(x / frame); };
    const shirtTop = new Map<number, number>();
    for (let p = 0; p < n; p++) if (region[p] === 'shirt') {
        const f = frameOf(p), y = Math.floor(p / w);
        shirtTop.set(f, Math.min(shirtTop.get(f) ?? 1e9, y));
    }

    const top = TOPS.find(t => t.id === look.top)!, bottom = BOTTOMS.find(b => b.id === look.bottom)!;
    const ramp = (k: number) => CLOTH_COLORS[k].map(hex);
    const skinRamp = SKIN_TONES[look.skin].map(hex), topRamp = ramp(look.topColor), bottomRamp = ramp(look.bottomColor);
    const stripeRamp = ramp(look.topColor <= LIGHT ? NAVY : LIGHT), shoeRamp = ramp(look.shoes);
    const sleeveRamp = top.sleeveColors?.map(hex);
    const topAt = (p: number) => {
        if (top.pattern !== 'stripes') return topRamp;
        const y = Math.floor(p / w);
        return (y - (shirtTop.get(frameOf(p)) ?? 0)) % STRIPE_EVERY === STRIPE_EVERY - 1 ? stripeRamp : topRamp;
    };

    for (let p = 0, i = 0; p < n; p++, i += 4) {
        if (!px[i + 3]) continue;
        const r = region[p];
        if (r === 'line') continue;
        if (r === 'shirt') onRamp(px, i, topAt(p), tShirt(p));
        // long sleeves: the arm takes the top's colour, shaded by how light the skin was there
        else if (r === 'arm' && top.sleeves === 'long') onRamp(px, i, sleeveRamp ?? topAt(p), tSkin(p) * 0.85 + 0.1);
        // shorts: bare shins, shaded from the trousers that were drawn there
        else if (r === 'shin' && bottom.length === 'short') onRamp(px, i, skinRamp, tPants(p) * 0.7 + 0.3);
        else if (r === 'pants' || r === 'shin') onRamp(px, i, bottomRamp, tPants(p));
        else if (r === 'shoe') onRamp(px, i, shoeRamp, tShoe(p));
        else if (isSkin[p]) onRamp(px, i, skinRamp, tSkin(p));
    }
    if (top.print) printTop(scene, top.print, px, region, w, frame);
    ctx.putImageData(data, 0, 0);
    tex.refresh();
    let k = 0;
    for (let y = 0; y + frame <= h; y += frame)
        for (let x = 0; x + frame <= w; x += frame) tex.add(k++, 0, x, y, frame, frame);
    return key;
}

/**
 * A drawn top (tools/top_from_ai.py: its standing torso in 4 views, as a head part image) cut onto the shirt of
 * every frame: each shirt pixel takes the drawn colour from where it sits in the standing frame (moved by
 * player_body.json `shirt`), plus a 1 px rim around the shirt for the garment's thickness. So it follows the
 * breathing and the walk pixel for pixel, and arms in front of the body stay on top (they aren't shirt).
 */
function printTop(scene: Scene, id: string, px: Uint8ClampedArray, region: (string | undefined)[], w: number, frame: number) {
    const img = scene.textures.get(PART_KEY(id)).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const art = g.getImageData(0, 0, img.width, img.height).data, aw = img.width;
    const rows = body.shirt.length;
    for (let r = 0; r < rows; r++) {
        const view = VIEW_OF_ROW[r];
        body.shirt[r].forEach(([dx, dy], col) => {
            const x0 = col * frame, y0 = r * frame;
            const at = (x: number, y: number) => (y0 + y) * w + x0 + x;
            const shirt = (x: number, y: number) => x >= 0 && y >= 0 && x < frame && y < frame && region[at(x, y)] === 'shirt';
            for (let y = 0; y < frame; y++) for (let x = 0; x < frame; x++) {
                const p = at(x, y), i = p * 4;
                const rim = !shirt(x, y) && (!px[i + 3] || region[p] === 'line')
                    && (shirt(x - 1, y) || shirt(x + 1, y) || shirt(x, y - 1) || shirt(x, y + 1));
                if (!shirt(x, y) && !rim) continue;
                const sx = x - dx, sy = y - dy;
                if (sx < 0 || sy < 0 || sx >= frame || sy >= frame) continue;
                const a = (sy * aw + view * frame + sx) * 4;
                if (!art[a + 3]) continue;
                px[i] = art[a]; px[i + 1] = art[a + 1]; px[i + 2] = art[a + 2]; px[i + 3] = 255;
            }
        });
    }
}
