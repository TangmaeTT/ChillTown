import { Scene } from 'phaser';

// Small code-drawn textures: street lamp and the light glows used with ADD blend.

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

/** Create every texture in this file once per game. */
export function makeSharedTextures(scene: Scene) {
    if (scene.textures.exists('lamp')) return;
    makeLamp(scene);
    makeGlow(scene, 'glowWarm', 160, [255, 196, 110]);
    makeGlow(scene, 'glowShop', 220, [255, 170, 80]);
    makeGlow(scene, 'glowCool', 120, [200, 225, 255]);
    makeHalo(scene, 'haloWarm', 48, [255, 220, 150]);
}
