// Map editor overlay drawn on the map: grid, spawns, lamps, exits, walkways, problems, and per frame
// the hover/selection/ghost. Sits above the lighting so it's readable at any time of day.
import { Scene, GameObjects, Math as PMath } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import { ROOMS, ROOM_IDS, type Rect, type Ground } from '@shared/rooms';
import type { EditorModel } from '../../model/EditorModel';
import { footprint, silhouette } from '../../model/editorGeometry';

const DEPTH = 60000;
const pts = (p: { x: number; y: number }[]) => p as PMath.Vector2[];
const TEXT = { fontFamily: 'Tahoma, "Leelawadee UI", sans-serif', fontSize: '9px', color: '#ffffff', resolution: 4, stroke: '#000000', strokeThickness: 3 };

export type Hover = { i: number; j: number; fi: number; fj: number } | null;
export type Ghost = { rect: Rect; ok: boolean } | null;

// preview colours for ground painted during a drag (the real tiles appear when the stroke ends)
const PAINT: Record<Ground, number> = {
    plaza: 0xa8a294, sidewalk: 0x9e9888, road: 0x46484c, crosswalk: 0xc9c7bc, soi: 0x4e4e50, grass: 0x4e6e42, water: 0x264e62, wood: 0x806246,
    tile: 0xc4c0b6, rail: 0x3e3a36,
};

export class EditorOverlay {
    private live: GameObjects.Graphics;

    constructor(private scene: Scene, private grid: IsoGrid, m: EditorModel) {
        const g = scene.add.graphics().setDepth(DEPTH);
        const r = m.room;
        // grid
        g.lineStyle(1, 0xffffff, 0.12);
        for (let i = 0; i <= r.w; i++) { const a = grid.toWorld(i - 0.5, -0.5), b = grid.toWorld(i - 0.5, r.h - 0.5); g.lineBetween(a.x, a.y, b.x, b.y); }
        for (let j = 0; j <= r.h; j++) { const a = grid.toWorld(-0.5, j - 0.5), b = grid.toWorld(r.w - 0.5, j - 0.5); g.lineBetween(a.x, a.y, b.x, b.y); }
        // exits
        r.exits.forEach(e => this.diamond(g, e, e.to ? 0xd3ca90 : 0x8f7068, 2));
        // lamps
        for (const l of r.lamps) { const p = grid.toWorld(l.i, l.j); g.fillStyle(0xffd77a, 1).fillCircle(p.x, p.y, 4); }
        // walkways
        (r.walkways ?? []).forEach(w => this.polyline(g, w, 0x7fd6ff, 0.6));
        // spawns: this room's own (green) and where other rooms drop players (blue)
        this.marker(g, r.spawn.i, r.spawn.j, 0x6be36b, 'เกิด');
        for (const id of ROOM_IDS) if (id !== r.id) for (const e of ROOMS[id].exits)
            if (e.to === r.id && e.spawn) this.marker(g, e.spawn.i, e.spawn.j, 0x6bb8ff, `จาก ${ROOMS[id].name}`);
        // problems
        for (const p of m.problems) if (p.at) {
            const c = grid.toWorld(p.at.i, p.at.j), col = p.level === 'error' ? 0xff4040 : 0xffb030;
            g.lineStyle(3, col, 1).lineBetween(c.x - 7, c.y - 7, c.x + 7, c.y + 7).lineBetween(c.x - 7, c.y + 7, c.x + 7, c.y - 7);
        }
        this.live = scene.add.graphics().setDepth(DEPTH + 1);
    }

    private diamond(g: GameObjects.Graphics, r: Rect, color: number, width = 1, alpha = 1) {
        const f = footprint(this.grid, r);
        g.lineStyle(width, color, alpha).strokePoints(pts([f.N, f.E, f.S, f.W]), true);
    }

    private polyline(g: GameObjects.Graphics, p: [number, number][], color: number, alpha: number) {
        g.lineStyle(2, color, alpha);
        for (let k = 1; k < p.length; k++) {
            const a = this.grid.toWorld(...p[k - 1]), b = this.grid.toWorld(...p[k]);
            g.lineBetween(a.x, a.y, b.x, b.y);
            if (k === p.length - 1) g.fillStyle(color, alpha).fillTriangle(b.x, b.y, b.x - 4, b.y - 6, b.x + 4, b.y - 6);
        }
        p.forEach(([i, j]) => { const c = this.grid.toWorld(i, j); g.fillStyle(color, alpha).fillCircle(c.x, c.y, 2.5); });
    }

    private marker(g: GameObjects.Graphics, i: number, j: number, color: number, text: string) {
        this.diamond(g, { i0: i, j0: j, i1: i, j1: j }, color, 2);
        const c = this.grid.toWorld(i, j);
        g.fillStyle(color, 1).fillCircle(c.x, c.y, 3);
        this.scene.add.text(c.x, c.y - 10, text, { ...TEXT, color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5, 1).setDepth(DEPTH);
    }

    /** per-frame part: hover, selection, ghost of what a click would do, the walkway being drawn */
    update(m: EditorModel, hover: Hover, ghost: Ghost, painted: Set<string> | null) {
        const g = this.live.clear();
        if (painted) for (const k of painted) {
            const [i, j] = k.split(',').map(Number), f = footprint(this.grid, { i0: i, j0: j, i1: i, j1: j });
            g.fillStyle(PAINT[m.paintGround], 0.85).fillPoints(pts([f.N, f.E, f.S, f.W]), true);
        }
        const sel = m.selection;
        if (sel?.kind === 'box' && m.room.boxes[sel.index]) {
            const b = m.room.boxes[sel.index];
            g.lineStyle(2, 0xffe14a, 1).strokePoints(pts(silhouette(this.grid, b)), true);
            this.diamond(g, b, 0xffe14a, 1, 0.7);
        }
        if (sel?.kind === 'exit' && m.room.exits[sel.index]) this.diamond(g, m.room.exits[sel.index], 0xffe14a, 3);
        if (sel?.kind === 'walkway' && m.room.walkways?.[sel.index]) this.polyline(g, m.room.walkways[sel.index], 0xffe14a, 1);
        if (m.path) this.polyline(g, hover ? [...m.path, [hover.fi, hover.fj]] : m.path, 0xffffff, 0.9);
        if (ghost) this.diamond(g, ghost.rect, ghost.ok ? 0x6be36b : 0xff5050, 2);
        else if (hover) {
            const r = m.tool === 'paint' ? Math.floor(m.brush / 2) : 0;
            this.diamond(g, { i0: hover.i - r, j0: hover.j - r, i1: hover.i + r, j1: hover.j + r }, 0xffffff, 1, 0.8);
        }
    }
}
