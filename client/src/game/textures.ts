import { Scene } from 'phaser';

// Muted palette taken from the reference art (moss greens, blue-grey darks, warm light accents)
const PAL = {
    stoneA: '#3b4535', stoneB: '#434d3b', stoneC: '#353e31', grout: '#262c22',
    moss: '#4f6a3d', mossHi: '#6f8a4f', crack: '#1c211a', weed: '#5d7d45',
    outline: '#0e1014'
};

function rand(seed: number) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Cobblestone iso tiles with a few variants (moss, cracks, weeds). */
export function makeGroundTiles(scene: Scene, variants = 6) {
    for (let v = 0; v < variants; v++) {
        const tex = scene.textures.createCanvas(`ground${v}`, 64, 32)!;
        const ctx = tex.getContext();
        const r = rand(v * 977 + 13);
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 64; x++) {
                const inside = Math.abs(x + 0.5 - 32) / 32 + Math.abs(y + 0.5 - 16) / 16 <= 1;
                if (!inside) continue;
                // stone pattern on an iso grid of 16x8 cells
                const u = (x / 16 + y / 8), w = (y / 8 - x / 16);
                const gu = Math.abs(u - Math.round(u)) < 0.09, gw = Math.abs(w - Math.round(w)) < 0.09;
                let c = [PAL.stoneA, PAL.stoneB, PAL.stoneC][Math.floor(Math.abs(Math.sin(Math.floor(u) * 12.9 + Math.floor(w) * 78.2)) * 3)];
                if (gu || gw) c = PAL.grout;
                if (r() < 0.05) c = PAL.stoneC;
                ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
            }
        }
        // decorations
        if (v % 3 === 1) { // moss patch
            const cx = 20 + r() * 24, cy = 10 + r() * 12;
            for (let k = 0; k < 26; k++) {
                const x = Math.round(cx + (r() - 0.5) * 14), y = Math.round(cy + (r() - 0.5) * 6);
                ctx.fillStyle = r() < 0.3 ? PAL.mossHi : PAL.moss; ctx.fillRect(x, y, 1, 1);
            }
        }
        if (v % 3 === 2) { // crack
            let x = 18 + Math.floor(r() * 20), y = 12 + Math.floor(r() * 6);
            ctx.fillStyle = PAL.crack;
            for (let k = 0; k < 12; k++) { ctx.fillRect(x, y, 1, 1); x += 1; y += r() < 0.5 ? 0 : (r() < 0.5 ? 1 : -1); }
        }
        if (v === 4 || v === 5) { // weed tuft
            const x = 24 + Math.floor(r() * 16), y = 12 + Math.floor(r() * 8);
            ctx.fillStyle = PAL.weed; ctx.fillRect(x, y, 1, 2); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y, 1, 2);
            ctx.fillStyle = PAL.mossHi; ctx.fillRect(x, y - 1, 1, 1);
        }
        tex.refresh();
    }
}

/** Pixel-art player: front/back x 3 walk frames, 16x38 px, outlined. */
export function makePlayer(scene: Scene) {
    const C = { hair: '#1d1a24', hairHi: '#34303f', skin: '#e9b993', hood: '#a8323a', hoodDk: '#7a2430', hoodHi: '#c4474a',
        legs: '#23243a', shoe: '#d6d8e2', shoeDk: '#9a9cab', eye: '#15131a' };
    const W = 16, H = 38;
    for (const facing of ['front', 'back'] as const) {
        for (let f = 0; f < 3; f++) {
            const g: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
            const px = (x: number, y: number, c: string) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
            const rect = (x: number, y: number, w: number, h: number, c: string) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, c); };
            const o = 1; // 1px padding for outline
            // legs (walk cycle)
            const la = f === 1 ? -1 : 0, lb = f === 2 ? -1 : 0;
            rect(o + 4, 27 + la, 2, 7, C.legs); rect(o + 8, 27 + lb, 2, 7, C.legs);
            rect(o + 3, 34 + la, 3, 2, C.shoe); px(o + 3, 35 + la, C.shoeDk);
            rect(o + 8, 34 + lb, 3, 2, C.shoe); px(o + 10, 35 + lb, C.shoeDk);
            // hoodie body + arms
            rect(o + 2, 13, 10, 15, C.hood); rect(o + 11, 13, 1, 15, C.hoodDk); rect(o + 2, 13, 1, 15, C.hoodHi);
            const sw = f === 0 ? 0 : (f === 1 ? 1 : -1);
            rect(o + 0, 15 + sw, 2, 10, C.hood); rect(o + 12, 15 - sw, 2, 10, C.hoodDk);
            rect(o + 0, 25 + sw, 2, 2, C.skin); rect(o + 12, 25 - sw, 2, 2, C.skin);
            if (facing === 'front') { rect(o + 5, 14, 4, 1, C.hoodDk); px(o + 6, 15, C.shoe); px(o + 8, 15, C.shoe); rect(o + 4, 20, 6, 3, C.hoodDk); }
            else { rect(o + 3, 13, 8, 4, C.hoodDk); }
            // head
            rect(o + 3, 2, 8, 11, C.hair); rect(o + 4, 1, 6, 1, C.hair); rect(o + 4, 2, 3, 1, C.hairHi);
            if (facing === 'front') {
                rect(o + 4, 6, 6, 6, C.skin); rect(o + 4, 6, 6, 2, C.hair); // fringe
                px(o + 5, 9, C.eye); px(o + 8, 9, C.eye);
                rect(o + 2, 4, 1, 9, C.hair); rect(o + 11, 4, 1, 9, C.hair); // side hair
            }
            // outline pass
            const out = g.map(r => r.slice());
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                if (g[y][x]) continue;
                if ((g[y - 1]?.[x]) || (g[y + 1]?.[x]) || g[y][x - 1] || g[y][x + 1]) out[y][x] = PAL.outline;
            }
            const tex = scene.textures.createCanvas(`p_${facing}_${f}`, W, H)!;
            const ctx = tex.getContext();
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[y][x]) { ctx.fillStyle = out[y][x]!; ctx.fillRect(x, y, 1, 1); }
            tex.refresh();
        }
    }
}

/** Street lamp: pole + head, 14x84 px, origin at the base. */
export function makeLamp(scene: Scene) {
    const tex = scene.textures.createCanvas('lamp', 14, 84)!;
    const c = tex.getContext();
    const f = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    f(5, 10, 4, 70, '#0e1014'); f(6, 10, 2, 70, '#3a4048'); f(6, 10, 1, 70, '#56606a');
    f(3, 78, 8, 6, '#0e1014'); f(4, 78, 6, 5, '#3a4048');
    f(0, 4, 14, 7, '#0e1014'); f(1, 5, 12, 5, '#2c3138'); f(2, 9, 10, 2, '#fff1b8'); f(3, 10, 8, 1, '#ffd77a');
    f(6, 0, 2, 4, '#0e1014');
    tex.refresh();
}

/** Stepped (posterised) radial glow, used with ADD blend for lights. */
export function makeGlow(scene: Scene, key: string, size: number, rgb: [number, number, number]) {
    const tex = scene.textures.createCanvas(key, size, size)!;
    const c = tex.getContext();
    const steps = [[1.0, 0.10], [0.75, 0.16], [0.52, 0.24], [0.32, 0.34]];
    for (const [r, a] of steps) {
        c.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
        // pixel ellipse, flattened 2:1 so light pools sit on the iso ground
        const R = (size / 2) * r;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const dx = (x + 0.5 - size / 2) / R, dy = (y + 0.5 - size / 2) / (R * 0.5);
            if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
        }
    }
    tex.refresh();
}

/** Round soft glow (not flattened) for lamp heads and windows. */
export function makeHalo(scene: Scene, key: string, size: number, rgb: [number, number, number]) {
    const tex = scene.textures.createCanvas(key, size, size)!;
    const c = tex.getContext();
    for (const [r, a] of [[1.0, 0.08], [0.66, 0.14], [0.38, 0.25]]) {
        c.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
        const R = (size / 2) * r;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const dx = (x + 0.5 - size / 2) / R, dy = (y + 0.5 - size / 2) / R;
            if (dx * dx + dy * dy <= 1) c.fillRect(x, y, 1, 1);
        }
    }
    tex.refresh();
}

/** Puddle decal that picks up light. */
export function makePuddle(scene: Scene) {
    const tex = scene.textures.createCanvas('puddle', 40, 14)!;
    const c = tex.getContext();
    for (let y = 0; y < 14; y++) for (let x = 0; x < 40; x++) {
        const dx = (x + 0.5 - 20) / 19, dy = (y + 0.5 - 7) / 6.5;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        c.fillStyle = d > 0.75 ? '#22303a' : (y < 5 && x > 12 && x < 26 ? '#4d6b80' : '#2c4150');
        c.fillRect(x, y, 1, 1);
    }
    tex.refresh();
}
