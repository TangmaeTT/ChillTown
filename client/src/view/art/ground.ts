import { Scene } from 'phaser';
import type { Ground } from '@shared/rooms';
import { hash, type RGB } from './pixelart';

// Ground tiles in daylight colours (the lighting overlay tints them for the time of day).
// Each type has a few variants so large areas don't look stamped.
export const GROUND_VARIANTS = 4;

type Pattern = (u: number, v: number, x: number, y: number, seed: number) => RGB;
const n = (x: number, y: number, s: number, amt: number) => 1 + (hash(x, y, s) - 0.5) * amt;
const mul = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];

// u, v: position inside the tile along i and j, 0..1 (32 steps each)
const PATTERNS: Record<Ground, Pattern> = {
    sidewalk: (u, v, x, y, s) => {            // running-bond pavers
        const row = Math.floor(v * 8), off = row % 2 ? 0.125 : 0;
        const joint = (v * 8) % 1 < 0.14 || ((u + off) * 4) % 1 < 0.07;
        const stain = hash(Math.floor((u + off) * 4), row, s) < 0.12 ? 0.9 : 1;
        return mul([158, 152, 136], (joint ? 0.78 : stain) * n(x, y, s, 0.08));
    },
    plaza: (u, v, x, y, s) => {               // big granite slabs
        const joint = (u * 2) % 1 < 0.04 || (v * 2) % 1 < 0.04;
        const slab = 0.94 + hash(Math.floor(u * 2), Math.floor(v * 2), s) * 0.1;
        return mul([168, 162, 148], (joint ? 0.8 : slab) * n(x, y, s, 0.06));
    },
    road: (_u, _v, x, y, s) => {              // asphalt with aggregate specks
        const speck = hash(x, y, s + 3) < 0.05 ? 1.25 : 1;
        return mul([70, 72, 76], speck * n(x >> 1, y >> 1, s, 0.1));
    },
    crosswalk: (u, v, x, y, s) => {           // zebra bars run along the road (i), two per tile
        const bar = (v * 2) % 1 > 0.2 && (v * 2) % 1 < 0.75 && u > 0.04 && u < 0.96;
        return bar ? mul([214, 212, 200], n(x, y, s, 0.1)) : PATTERNS.road(u, v, x, y, s);
    },
    soi: (u, v, x, y, s) => {                 // older, patched asphalt
        const patch = hash(Math.floor(u * 3), Math.floor(v * 3), s) < 0.15 ? 0.88 : 1;
        return mul([78, 78, 80], patch * n(x >> 1, y >> 1, s, 0.12));
    },
    grass: (_u, _v, x, y, s) => mul(hash(x, y, s) < 0.15 ? [110, 140, 84] : [78, 110, 66], n(x >> 1, y, s, 0.2)),
    water: (u, v, x, y, s) => {
        const glint = ((u * 3 + v * 7 + hash(Math.floor(u * 6), Math.floor(v * 6), s)) % 1) < 0.06;
        return glint ? [120, 160, 176] : mul([38, 78, 98], n(x >> 2, y >> 1, s, 0.1));
    },
    tile: (u, v, x, y, s) => {                // station floor: large polished tiles with a soft sheen
        const joint = (u * 2) % 1 < 0.03 || (v * 2) % 1 < 0.03;
        const sheen = ((u + v) * 3 + hash(Math.floor(u * 2), Math.floor(v * 2), s)) % 1 < 0.12 ? 1.06 : 1;
        return mul([196, 192, 182], (joint ? 0.86 : sheen) * n(x, y, s, 0.04));
    },
    rail: (u, _v, x, y, s) => {               // track bed: dark ballast, concrete sleepers across the rails
        const sleeper = (u * 3) % 1 < 0.28;
        return sleeper ? mul([120, 118, 112], n(x, y, s, 0.1)) : mul([62, 58, 54], n(x, y, s + 5, 0.3));
    },
    wood: (_u, v, x, y, s) => {               // planks along i
        const gap = (v * 6) % 1 < 0.12;
        return mul([128, 98, 70], (gap ? 0.6 : 0.92 + hash(0, Math.floor(v * 6), s) * 0.15) * n(x, y, s, 0.1));
    },
};

export function groundKey(type: Ground, variant: number) { return `ground_${type}_${variant}`; }

/** Create all ground tile textures once per game. */
export function makeGroundTextures(scene: Scene) {
    if (scene.textures.exists(groundKey('road', 0))) return;
    for (const type of Object.keys(PATTERNS) as Ground[]) for (let s = 0; s < GROUND_VARIANTS; s++) {
        const tex = scene.textures.createCanvas(groundKey(type, s), 64, 32)!;
        const ctx = tex.getContext(), img = ctx.createImageData(64, 32);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
            const dx = (x + 0.5 - 32) / 32, dy = (y + 0.5) / 16;
            const u = (dy + dx) / 2, v = (dy - dx) / 2;          // 0..1 inside the diamond
            if (u < 0 || u > 1 || v < 0 || v > 1) continue;
            const c = PATTERNS[type](u, v, x, y, s * 31 + 7), k = (y * 64 + x) * 4;
            img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
        }
        ctx.putImageData(img, 0, 0); tex.refresh();
    }
}
