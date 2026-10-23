import { Scene, GameObjects } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import type { Box } from '@shared/rooms';
import { prismTexture, placePrism, paint, concrete, hash, hex, tint, type Material } from './pixelart';
import { drawLabel, type Drawn } from './blockout';
import type { LightingView } from '../LightingView';

// Code-drawn street furniture for boxes tagged with `art`: trees, benches, the meeting-point clock, kiosks.

/** Rain tree canopy: dithered blob, lit from the top-left, on a short trunk. */
function treeTexture(scene: Scene) {
    const key = 'prop_tree';
    if (scene.textures.exists(key)) return key;
    const W = 56, H = 78, tex = scene.textures.createCanvas(key, W, H)!, c = tex.getContext();
    const px = (x: number, y: number, col: number[]) => { c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; c.fillRect(x, y, 1, 1); };
    for (let y = 50; y < 76; y++) for (let x = 25; x < 31; x++) px(x, y, x < 27 ? [104, 84, 66] : x > 29 ? [58, 46, 38] : [82, 66, 52]);
    const leaves = [[30, 68, 52], [46, 92, 66], [64, 118, 78], [96, 146, 94], [138, 176, 116]];
    for (let y = 0; y < 58; y++) for (let x = 0; x < W; x++) {
        // three overlapping lumps
        const d = Math.min(...[[28, 26, 26, 22], [17, 34, 15, 13], [40, 33, 15, 13]].map(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
        if (d > 1 - hash(x, y, 4) * 0.12) continue;
        const light = (1 - d) * 0.5 + (1 - (x + y) / (W + 58)) * 0.9 + (hash(x >> 1, y >> 1, 9) - 0.5) * 0.6;
        const k = Math.max(0, Math.min(4, Math.floor(light * 3.2)));
        px(x, y, d > 0.88 ? [22, 30, 26] : leaves[k]);
    }
    tex.refresh();
    return key;
}

/** Meeting-point clock head: dark frame, pale face that glows at night. */
const clockHead: Material = s => {
    if (s.face === 'top') return { c: [52, 56, 60] };
    const cu = s.u - (s.face === 'left' ? s.W : s.D) / 2, cv = s.v - s.H / 2;
    if (cu * cu / 36 + cv * cv / 36 < 1) {
        const hand = (Math.abs(cu) < 0.7 && cv > -1 && cv < 4.5) || (Math.abs(cv) < 0.7 && cu > -1 && cu < 3.5);
        return { c: hand ? [30, 30, 34] : [232, 228, 210], glow: hand ? undefined : [255, 244, 210], glowA: 0.9 };
    }
    return { c: [52, 56, 60] };
};

/** Kiosk: painted box with an open counter (lit inside at night) and roller shutter band. */
function kiosk(base: number): Material {
    const body = paint(base, 0.08);
    return s => {
        if (s.face === 'top') return { c: tint(hex(0x7d8287), 1 + (hash(s.x, s.y) - 0.5) * 0.05) };
        if (s.face === 'left' && s.v > s.H * 0.28 && s.v < s.H * 0.7 && s.u > 4 && s.u < s.W - 4) {
            const shelf = Math.floor(s.v) % 6 === 0;
            return { c: shelf ? [120, 96, 70] : [70, 58, 50], glow: [255, 210, 140], glowA: shelf ? 0.6 : 0.85 };
        }
        if (s.v > s.H * 0.72 && s.v < s.H * 0.8) return { c: tint(hex(base), 0.7) };
        return body(s);
    };
}

/** Striped awning (alternating colour along i). */
function awning(a: number, b: number): Material {
    return s => ({ c: tint(hex(Math.floor(s.u / 6) % 2 ? a : b), 1 + (hash(s.x, s.y) - 0.5) * 0.05) });
}

/** Draw a box's `art`. Returns what the occlusion system needs. */
export function drawArt(scene: Scene, grid: IsoGrid, b: Box, lighting: LightingView): Drawn {
    const di = b.i1 - b.i0 + 1, dj = b.j1 - b.j0 + 1, ei = b.i0 - 0.5, ej = b.j0 - 0.5;
    const ground = grid.toWorld(b.i1 + 0.5, b.j1 + 0.5).y;
    const glow = (g: GameObjects.Image | null, owner: GameObjects.Image) => { if (g) lighting.addGlow(g, owner); };

    if (b.art === 'tree') {
        const c = grid.toWorld((b.i0 + b.i1) / 2, (b.j0 + b.j1) / 2);
        const img = scene.add.image(c.x, c.y + 4, treeTexture(scene)).setOrigin(0.5, 1).setDepth(c.y + 8);
        return { depth: c.y + 8, objects: [img], left: img.x - 28, right: img.x + 28, top: img.y - 78, bottom: c.y + 8 };
    }
    if (b.art === 'bench') {
        // seat along the longer axis, legs implied by the dark underside
        const p = placePrism(scene, grid, prismTexture(scene, `prop_bench_${di}x${dj}`, di - 0.2, dj * 0.4, 7, paint(0x7a5c42, 0.12)),
            ei + 0.1, ej + dj * 0.3, di - 0.2, dj * 0.4, 0, ground);
        return { depth: ground, objects: [p.img], left: p.left, right: p.right, top: p.top, bottom: ground };
    }
    if (b.art === 'clock') {
        const post = placePrism(scene, grid, prismTexture(scene, 'prop_clock_post', 0.16, 0.16, 46, concrete(0x3d4248, { joint: 999 })),
            ei + 0.42, ej + 0.42, 0.16, 0.16, 0, ground);
        const head = placePrism(scene, grid, prismTexture(scene, 'prop_clock_head', 0.42, 0.42, 16, clockHead), ei + 0.29, ej + 0.29, 0.42, 0.42, 46, ground + 0.1);
        glow(head.glow, head.img);
        const lbl = drawLabel(scene, post.left + (post.right - post.left) / 2, head.top - 8, 'จุดนัดเจอ', ground + 0.5);
        lighting.addLight('haloWarm', (head.left + head.right) / 2, head.top + 10, 0.7, 0.8);
        return { depth: ground, objects: [post.img, head.img, lbl], left: head.left, right: head.right, top: head.top, bottom: ground };
    }
    // kiosk
    const body = placePrism(scene, grid, prismTexture(scene, `prop_kiosk_${b.color}_${di}x${dj}`, di, dj, b.h, kiosk(b.color)), ei, ej, di, dj, 0, ground);
    glow(body.glow, body.img);
    const aw = placePrism(scene, grid, prismTexture(scene, `prop_awning_${b.color}_${di}`, di, 0.45, 3, awning(b.color, 0xe8e2d0)),
        ei, ej + dj, di, 0.45, b.h * 0.72, ground + 0.2);
    const front = grid.toWorld(b.i0 + di / 2 - 0.5, b.j1 + 0.9);
    lighting.addLight('glowShop', front.x, front.y, 0.55, 0.6);
    const objects: Drawn['objects'] = [body.img, aw.img];
    if (b.label) objects.push(drawLabel(scene, (body.left + body.right) / 2, body.top - 6, b.label, ground + 0.5));
    return { depth: ground, objects, left: body.left, right: body.right, top: body.top, bottom: ground };
}
