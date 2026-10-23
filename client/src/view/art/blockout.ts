import { Scene, GameObjects, Math as PMath } from 'phaser';
import { TH, type IsoGrid } from '@shared/iso';
import type { Box, Ground, Room, Rect } from '@shared/rooms';
import { groundAt } from '@shared/collision';

// Blockout drawing: flat muted ground colours and grey boxes, so scale and layout read before real art exists.
const GROUND: Record<Ground, [number, number]> = {
    plaza: [0x4a4d47, 0x46493f], sidewalk: [0x55574f, 0x4f5149], road: [0x2a2e31, 0x282c2f],
    crosswalk: [0x2a2e31, 0xa9ab9c], soi: [0x35393a, 0x333738], water: [0x17364f, 0x152d47],
    wood: [0x5a4636, 0x544130], grass: [0x3b5849, 0x37533f],
};

// Graphics.fillPoints is typed for Vector2[] but only reads x/y
const pts = (p: { x: number; y: number }[]) => p as PMath.Vector2[];

function shade(c: number, f: number) {
    const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Corners of a footprint in world space (N = far, E = right, S = near/bottom, W = left), lifted by z. */
export function corners(grid: IsoGrid, f: Rect, z = 0) {
    const p = (i: number, j: number) => { const w = grid.toWorld(i, j); return { x: w.x, y: w.y - z }; };
    return { N: p(f.i0 - 0.5, f.j0 - 0.5), E: p(f.i1 + 0.5, f.j0 - 0.5), S: p(f.i1 + 0.5, f.j1 + 0.5), W: p(f.i0 - 0.5, f.j1 + 0.5) };
}

export function drawGround(scene: Scene, grid: IsoGrid, room: Room) {
    const g = scene.add.graphics().setDepth(-10000);
    for (let i = 0; i < room.w; i++) for (let j = 0; j < room.h; j++) {
        const type = groundAt(room, i, j);
        const [a, b] = GROUND[type];
        // crosswalk: stripes across the road; everything else: subtle checker
        const c = type === 'crosswalk' ? (j % 2 === 0 ? b : a) : ((i + j) % 2 ? a : b);
        const { N, E, S, W } = corners(grid, { i0: i, j0: j, i1: i, j1: j });
        g.fillStyle(c, 1).fillPoints(pts([N, E, S, W]), true);
    }
    g.lineStyle(1, 0x000000, 0.12);
    for (let i = 0; i <= room.w; i++) { const a = grid.toWorld(i - 0.5, -0.5), b = grid.toWorld(i - 0.5, room.h - 0.5); g.lineBetween(a.x, a.y, b.x, b.y); }
    for (let j = 0; j <= room.h; j++) { const a = grid.toWorld(-0.5, j - 0.5), b = grid.toWorld(room.w - 0.5, j - 0.5); g.lineBetween(a.x, a.y, b.x, b.y); }
}

export type DrawnObject = GameObjects.Graphics | GameObjects.Image | GameObjects.Text;
export type Drawn = { depth: number; objects: DrawnObject[]; left: number; right: number; top: number; bottom: number };

export const LABEL_STYLE = {
    fontFamily: 'Tahoma, "Leelawadee UI", sans-serif', fontSize: '8px', color: '#e9eed8', resolution: 4,
    stroke: '#0e1014', strokeThickness: 2, align: 'center',
};

/** An extruded iso grey box: top + two visible side faces, outlined. Light comes from the top-left. */
export function drawBox(scene: Scene, grid: IsoGrid, box: Box): Drawn {
    const z0 = box.z ?? 0, z1 = z0 + box.h;
    const lo = corners(grid, box, z0), hi = corners(grid, box, z1);
    const depth = box.elevated ? 40000 + lo.S.y * 0.001 : lo.S.y;
    const objects: DrawnObject[] = [];

    if (box.image) {
        const w = grid.toWorld(box.i1, box.j1);
        objects.push(scene.add.image(w.x, w.y + TH / 2, box.image).setOrigin(131 / 227, 298 / 299).setDepth(depth));
    } else {
        const g = scene.add.graphics().setDepth(depth);
        g.fillStyle(shade(box.color, 0.92), 1).fillPoints(pts([lo.W, lo.S, hi.S, hi.W]), true);   // left face (lit)
        g.fillStyle(shade(box.color, 0.66), 1).fillPoints(pts([lo.S, lo.E, hi.E, hi.S]), true);   // right face (shade)
        g.fillStyle(shade(box.color, 1.12), 1).fillPoints(pts([hi.N, hi.E, hi.S, hi.W]), true);   // top
        g.lineStyle(1, 0x0e1014, 0.8);
        g.strokePoints(pts([hi.N, hi.E, hi.S, hi.W]), true);
        for (const k of ['W', 'S', 'E'] as const) g.lineBetween(lo[k].x, lo[k].y, hi[k].x, hi[k].y);
        g.lineBetween(lo.W.x, lo.W.y, lo.S.x, lo.S.y);
        g.lineBetween(lo.S.x, lo.S.y, lo.E.x, lo.E.y);
        objects.push(g);
    }
    if (box.label) objects.push(drawLabel(scene, (hi.N.x + hi.S.x) / 2, (hi.N.y + hi.S.y) / 2, box.label, depth + 0.5));
    const top = box.image ? (objects[0] as GameObjects.Image).getBounds().top : hi.N.y;
    return { depth, objects, left: lo.W.x, right: lo.E.x, top, bottom: lo.S.y };
}

export function drawLabel(scene: Scene, x: number, y: number, text: string, depth: number) {
    return scene.add.text(Math.round(x), Math.round(y), text, LABEL_STYLE).setOrigin(0.5).setDepth(depth);
}

/** Exit pads: a lit strip on the ground + a floating label. */
export function drawExit(scene: Scene, grid: IsoGrid, e: Rect & { to: string | null; label: string }) {
    const { N, E, S, W } = corners(grid, e);
    const live = e.to !== null;
    scene.add.graphics().setDepth(-9000)
        .fillStyle(live ? 0xd3ca90 : 0x67565a, live ? 0.35 : 0.3).fillPoints(pts([N, E, S, W]), true)
        .lineStyle(1, live ? 0xd3ca90 : 0x8f7068, 0.8).strokePoints(pts([N, E, S, W]), true);
    const c = grid.toWorld((e.i0 + e.i1) / 2, (e.j0 + e.j1) / 2);
    scene.add.text(Math.round(c.x), Math.round(c.y - 10), e.label, { ...LABEL_STYLE, color: live ? '#f2e9b0' : '#b9a8a8' })
        .setOrigin(0.5, 1).setDepth(39000);
}
