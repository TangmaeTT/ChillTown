import { Scene, GameObjects } from 'phaser';
import type { IsoGrid } from '@shared/iso';

// Code-drawn isometric pixel art. A prism (box) is rasterised pixel by pixel: every pixel knows which face
// it is on and where on that face, and a Material decides its colour. Light comes from the top-left
// (left face lit, right face in shade). Anything a material marks as `glow` goes to a second texture
// that the game adds on top at night (windows, signs, headlights).

export type RGB = [number, number, number];
export type Face = 'top' | 'left' | 'right';
/** u/v are face-local texels: top: u along i, v along j (32 per tile); left: u along i, v = height;
 *  right: u along j, v = height. W/D/H = the face's full extents in the same units. */
export type Sample = { face: Face; u: number; v: number; W: number; D: number; H: number; x: number; y: number };
export type Shade = { c: RGB; a?: number; glow?: RGB; glowA?: number; noLight?: boolean } | null;
export type Material = (s: Sample) => Shade;

const LIGHT: Record<Face, number> = { top: 1.06, left: 0.9, right: 0.66 };

/** deterministic per-pixel noise in [0,1) */
export function hash(x: number, y: number, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hex = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
export const tint = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
export const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type PrismTex = { key: string; glowKey: string | null; w: number; h: number; ox: number };

/**
 * Rasterise a di x dj (tiles) x h (px) prism into texture `key` (and `key_glow` if anything glows).
 * ox = x of the far (N) corner inside the texture.
 */
export function prismTexture(scene: Scene, key: string, di: number, dj: number, h: number, mat: Material, outline = true): PrismTex {
    const W = Math.ceil((di + dj) * 32), Ht = Math.ceil((di + dj) * 16 + h);
    const ox = dj * 32;
    if (scene.textures.exists(key)) return { key, glowKey: scene.textures.exists(key + '_glow') ? key + '_glow' : null, w: W, h: Ht, ox };
    const col = new Float32Array(W * Ht * 4), glow = new Float32Array(W * Ht * 4);
    const face = new Uint8Array(W * Ht); // 0 none, 1 top, 2 left, 3 right
    let anyGlow = false;
    const Ex = ox + di * 32, Ey = di * 16, Wx = ox - dj * 32, Wy = dj * 16;

    for (let y = 0; y < Ht; y++) for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5;
        let s: Sample | null = null;
        // top face
        const dx = (px - ox) / 32, dy = py / 16;
        const ti = (dy + dx) / 2, tj = (dy - dx) / 2;
        if (ti >= 0 && ti <= di && tj >= 0 && tj <= dj) s = { face: 'top', u: ti * 32, v: tj * 32, W: di * 32, D: dj * 32, H: h, x, y };
        else {
            // left face (the j = dj side), extruded down by h
            const lu = (px - Wx) / 32, lz = py - Wy - 16 * lu;
            if (lu >= 0 && lu <= di && lz >= 0 && lz <= h) s = { face: 'left', u: lu * 32, v: h - lz, W: di * 32, D: dj * 32, H: h, x, y };
            else {
                const rv = (Ex - px) / 32, rz = py - Ey - 16 * rv;
                if (rv >= 0 && rv <= dj && rz >= 0 && rz <= h) s = { face: 'right', u: (dj - rv) * 32, v: h - rz, W: di * 32, D: dj * 32, H: h, x, y };
            }
        }
        if (!s) continue;
        const r = mat(s);
        if (!r) continue;
        const k = (y * W + x) * 4;
        const L = r.noLight ? 1 : LIGHT[s.face] * (s.face === 'top' ? 1 : 0.8 + 0.2 * Math.min(1, s.v / 10)); // ambient occlusion at the foot
        col[k] = r.c[0] * L; col[k + 1] = r.c[1] * L; col[k + 2] = r.c[2] * L; col[k + 3] = r.a ?? 1;
        face[y * W + x] = s.face === 'top' ? 1 : s.face === 'left' ? 2 : 3;
        if (r.glow) { anyGlow = true; glow[k] = r.glow[0]; glow[k + 1] = r.glow[1]; glow[k + 2] = r.glow[2]; glow[k + 3] = r.glowA ?? 1; }
    }

    // silhouette outline + lit top edges
    const out = scene.textures.createCanvas(key, W, Ht)!;
    const img = out.getContext().createImageData(W, Ht);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, k = i * 4;
        if (!col[k + 3]) continue;
        let c: RGB = [col[k], col[k + 1], col[k + 2]];
        const empty = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= W || yy >= Ht || !col[(yy * W + xx) * 4 + 3];
        if (outline && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) c = lerpRGB(c, [14, 16, 20], 0.65);
        else if (face[i] === 1 && y + 1 < Ht && face[i + W] > 1) c = lerpRGB(c, [255, 250, 230], 0.18); // top edge catches light
        else if (face[i] === 2 && x + 1 < W && face[i + 1] === 3) c = tint(c, 0.85);                    // front vertical corner
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = Math.round(col[k + 3] * 255);
    }
    out.getContext().putImageData(img, 0, 0); out.refresh();

    let glowKey: string | null = null;
    if (anyGlow) {
        glowKey = key + '_glow';
        const g = scene.textures.createCanvas(glowKey, W, Ht)!;
        const gi = g.getContext().createImageData(W, Ht);
        for (let k = 0; k < glow.length; k += 4) {
            gi.data[k] = glow[k]; gi.data[k + 1] = glow[k + 1]; gi.data[k + 2] = glow[k + 2]; gi.data[k + 3] = Math.round(glow[k + 3] * 255);
        }
        g.getContext().putImageData(gi, 0, 0); g.refresh();
    }
    return { key, glowKey, w: W, h: Ht, ox };
}

export type Placed = { img: GameObjects.Image; glow: GameObjects.Image | null; groundY: number; left: number; right: number; top: number };

/** Place a prism whose footprint starts at tile-edge coords (ei, ej) (tile k spans k-0.5..k+0.5), lifted by z. */
export function placePrism(scene: Scene, grid: IsoGrid, t: PrismTex, ei: number, ej: number, di: number, dj: number, z: number, depth: number): Placed {
    const n = grid.toWorld(ei, ej);
    const x = n.x - t.ox, y = n.y - z - (t.h - (di + dj) * 16);
    const img = scene.add.image(x, y, t.key).setOrigin(0, 0).setDepth(depth);
    const glow = t.glowKey ? scene.add.image(x, y, t.glowKey).setOrigin(0, 0).setDepth(50002).setBlendMode('ADD').setAlpha(0) : null;
    const s = grid.toWorld(ei + di, ej + dj);
    return { img, glow, groundY: s.y, left: x, right: x + t.w, top: y };
}

// ---------------------------------------------------------------- materials
const grain = (s: Sample, amt: number, seed = 1) => 1 + (hash(s.x, s.y, seed) - 0.5) * amt;

/** Weathered Bangkok concrete: panel joints, rain streaks running down the sides, darker grime at the foot. */
export function concrete(base: number, opts: { joint?: number; seed?: number } = {}): Material {
    const c0 = hex(base), J = opts.joint ?? 48, seed = opts.seed ?? 3;
    return s => {
        let c = tint(c0, grain(s, 0.09, seed));
        if (s.face === 'top') {
            if (hash(Math.floor(s.u / 6), Math.floor(s.v / 6), seed) < 0.08) c = tint(c, 0.93);
            return { c };
        }
        if (s.u % J < 1) c = tint(c, 0.82);                                   // panel joint
        const streak = hash(Math.floor(s.u / 2), seed, 9);
        if (streak < 0.25) c = tint(c, 1 - 0.12 * (1 - s.v / s.H));            // rain streaks, heavier lower down
        if (s.v < 4) c = tint(c, 0.85);                                        // grime at the foot
        return { c };
    };
}

/** Raised viaduct deck top: ballast, sleepers, two pairs of rails (along i). */
export function trackTop(edge: number): Material {
    const side = concrete(edge, { joint: 64 });
    return s => {
        if (s.face !== 'top') return side(s);
        const v = s.v, D = s.D;
        if (v < 3 || v > D - 3) return { c: tint(hex(edge), 1.08) };          // parapet tops
        let c: RGB = tint(hex(0x5f5a52), grain(s, 0.25, 4));                     // ballast
        const tracks = [D * 0.27, D * 0.73];
        for (const t of tracks) {
            const d = Math.abs(v - t);
            if (d < 9 && s.u % 6 < 2) c = tint(hex(0x6b5a48), grain(s, 0.15, 5)); // sleepers
            if (Math.abs(d - 5) < 0.8) c = [176, 180, 182];                       // rails
        }
        return { c };
    };
}

/** Station platform floor: pale tiles with yellow safety line, track bed in the middle. */
export function platformTop(trackFrom: number, trackTo: number): Material {
    const track = trackTop(0x8a8d86);
    const side = concrete(0x8f928b);
    return s => {
        if (s.face !== 'top') return side(s);
        if (s.v > trackFrom && s.v < trackTo) return track({ ...s, v: s.v - trackFrom, D: trackTo - trackFrom });
        const edge = Math.min(Math.abs(s.v - trackFrom), Math.abs(s.v - trackTo));
        if (edge < 2) return { c: [214, 186, 70] };                             // safety line
        const tile = (Math.floor(s.u / 8) + Math.floor(s.v / 8)) % 2;
        return { c: tint([176, 174, 164], (tile ? 1 : 0.95) * grain(s, 0.05)) };
    };
}

/** Glass curtain wall with mullions; panes glow warm at night. */
export function glassWall(frame: number, opts: { alpha?: number; glow?: RGB | null; pane?: number } = {}): Material {
    const P = opts.pane ?? 14, glowC = opts.glow === undefined ? [255, 214, 150] as RGB : opts.glow;
    return s => {
        if (s.face === 'top') return { c: hex(frame) };
        const mull = s.u % P < 1.5 || s.v < 2 || s.v > s.H - 2 || Math.abs(s.v - s.H * 0.55) < 0.8;
        if (mull) return { c: hex(frame) };
        // sky reflection: diagonal bright band
        const refl = ((s.u * 0.6 + s.v) % 40) < 6 ? 1.25 : 1;
        // not every pane is lit, and lit ones differ in strength, so the wall doesn't read as one flat panel
        const pane = hash(Math.floor(s.u / P), Math.floor(s.v / (s.H * 0.55)), 2);
        return { c: tint([58, 78, 92], refl), a: opts.alpha ?? 1, glow: pane < 0.6 && glowC ? glowC : undefined, glowA: 0.18 + pane * 0.35 };
    };
}

/** Corrugated metal roof (ribs along j); optional glowing sign band on the left face. */
export function metalRoof(base: number, sign?: RGB): Material {
    const c0 = hex(base);
    return s => {
        if (s.face === 'top') return { c: tint(c0, (s.v % 6 < 2 ? 0.88 : 1.04) * grain(s, 0.06)) };
        if (sign && s.face === 'left' && s.v > 2 && s.v < s.H - 2 && s.u > s.W * 0.3 && s.u < s.W * 0.7)
            return { c: [40, 60, 64], glow: sign, glowA: 0.9 };
        return { c: tint(c0, 0.8) };
    };
}

/** Painted flat colour with grain (benches, kiosks, car bodies). */
export function paint(base: number, amt = 0.06): Material {
    const c0 = hex(base);
    return s => ({ c: tint(c0, grain(s, amt)) });
}

/** Car body or cabin; cabin gets window band. `end` = what the visible (+i) end shows. */
export function carPart(base: number, part: 'body' | 'cabin', end: 'head' | 'tail'): Material {
    const c0 = hex(base);
    return s => {
        if (part === 'cabin' && s.face !== 'top' && s.v > 2) return { c: [44, 56, 64] };
        if (part === 'body' && s.face === 'right' && s.v > s.H * 0.45 && s.v < s.H * 0.8 && (s.u < 4 || s.u > s.D - 4))
            return end === 'head' ? { c: [235, 232, 210], glow: [255, 250, 225] } : { c: [140, 30, 30], glow: [255, 50, 40] };
        if (part === 'body' && s.face !== 'top' && s.v < 3) return { c: [24, 24, 26] };  // wheels/shadow line
        return { c: tint(c0, grain(s, 0.04)) };
    };
}

/** Top-left of a prism texture placed at tile-edge coords (ei, ej) lifted by z (for things that move). */
export function prismXY(grid: IsoGrid, t: PrismTex, ei: number, ej: number, di: number, dj: number, z: number) {
    const n = grid.toWorld(ei, ej);
    return { x: n.x - t.ox, y: n.y - z - (t.h - (di + dj) * 16) };
}

/** Station concourse: concrete with a long band of lit windows. */
export function concourse(base: number): Material {
    const wall = concrete(base, { joint: 64 });
    return s => {
        if (s.face === 'top') return wall(s);
        const band = s.v > s.H * 0.3 && s.v < s.H * 0.75;
        if (band) {
            if (s.u % 18 < 2) return { c: tint(hex(base), 0.7) };
            const win = hash(Math.floor(s.u / 18), 3, 5);
            return { c: [62, 82, 96], glow: win < 0.75 ? [255, 222, 168] : undefined, glowA: 0.25 + win * 0.3 };
        }
        if (Math.abs(s.v - s.H * 0.85) < 1) return { c: tint(hex(base), 0.8) };
        return wall(s);
    };
}

/** Stair step: concrete with a bright nosing on the tread edge. */
export function stairStep(base: number): Material {
    const c0 = hex(base);
    return s => {
        if (s.face === 'top') return { c: tint(c0, (s.v > s.D - 2 || s.v < 2 ? 1.12 : 1) * (1 + (hash(s.x, s.y, 8) - 0.5) * 0.06)) };
        return { c: tint(c0, 0.9) };
    };
}
