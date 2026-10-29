import { Scene } from 'phaser';

// Palette swap for the avatar: make a copy of a loaded sprite sheet where chosen colours are moved onto a
// ramp (shadow -> highlight) by their brightness, so the shading of the original art survives.

export const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** write the colour at t (0 shadow .. 1 highlight) along a ramp of [r, g, b] stops into px at i */
export function onRamp(px: Uint8ClampedArray, i: number, stops: number[][], t: number) {
    t = Math.max(0, Math.min(1, t));
    const f = t * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(f)), u = f - k;
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(stops[k][c] * (1 - u) + stops[k + 1][c] * u);
}

/**
 * Copy sheet `src` (frames of `frame` px) to `key` with colours recoloured onto `ramp`.
 * only = the source colours to change ('#rrggbb'); omitted = every opaque pixel.
 * Cached: the same key is only built once per game.
 */
export function recolored(scene: Scene, src: string, key: string, frame: number, ramp: string[], only?: string[]): string {
    if (scene.textures.exists(key)) return key;
    const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
    const tex = scene.textures.createCanvas(key, img.width, img.height)!;
    const ctx = tex.getContext();
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    const px = data.data;

    const pick = only && new Set(only.map(s => s.toLowerCase()));
    const chosen = (i: number) => px[i + 3] > 0 && (!pick || pick.has('#' + [px[i], px[i + 1], px[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')));
    // brightness range of the colours being changed, mapped onto the whole ramp
    let lo = 255, hi = 0;
    for (let i = 0; i < px.length; i += 4) if (chosen(i)) {
        const l = luma(px[i], px[i + 1], px[i + 2]);
        lo = Math.min(lo, l); hi = Math.max(hi, l);
    }
    const stops = ramp.map(hex);
    for (let i = 0; i < px.length; i += 4) {
        if (!chosen(i)) continue;
        const t = hi > lo ? (luma(px[i], px[i + 1], px[i + 2]) - lo) / (hi - lo) : 0.5;
        onRamp(px, i, stops, t);
    }
    ctx.putImageData(data, 0, 0);
    tex.refresh();

    let n = 0;
    for (let y = 0; y + frame <= img.height; y += frame)
        for (let x = 0; x + frame <= img.width; x += frame) tex.add(n++, 0, x, y, frame, frame);
    return key;
}
