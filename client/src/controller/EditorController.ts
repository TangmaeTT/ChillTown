import { Scene, Input } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import { ROOMS, type Room, type RoomId, type Rect } from '@shared/rooms';
import { world, zoomBy, setTimeOfDay } from '../model/WorldModel';
import { EditorModel, type Tool } from '../model/EditorModel';
import { CATALOG } from '../model/editorCatalog';
import { pickBox } from '../model/editorGeometry';
import { EditorPanel, type PanelActions } from '../view/editor/EditorPanel';
import { EditorOverlay, type Hover, type Ghost } from '../view/editor/EditorOverlay';

// Map editor controller: mouse/keyboard/panel -> EditorModel operations. The room view is rebuilt
// (scene restart) whenever the model's data version changes; the model and panel live in module state
// so they survive those restarts.
let model: EditorModel | null = null;
let panel: EditorPanel | null = null;
const CAM_KEY = 'chilltown-editor-cam';

/** The room to draw while editing (the editor's working copy). */
export function editorRoom(id: RoomId): Room {
    if (!model || model.id !== id) model = new EditorModel(ROOMS[id]);
    return model.room;
}

/** Camera position saved before a save-triggered page reload, if it belongs to this room. */
export function savedCamera(id: RoomId): { x: number; y: number } | null {
    try {
        const c = JSON.parse(sessionStorage.getItem(CAM_KEY) ?? 'null');
        return c && c.room === id ? c : null;
    } catch { return null; }
}

const TOOL_KEYS: Tool[] = ['select', 'place', 'paint', 'lamp', 'exit', 'spawn', 'walkway'];

export class EditorController {
    private m: EditorModel;
    private overlay: EditorOverlay;
    private hover: Hover = null;
    private drag: { start: { i: number; j: number }; orig: Rect } | null = null;
    private exitStart: { i: number; j: number } | null = null;
    private stroke: { changed: boolean; tiles: Set<string>; last: { i: number; j: number } | null } | null = null;
    private pan: { x: number; y: number } | null = null;
    private held = new Set<string>();
    private builtVersion: number;

    constructor(private scene: Scene, private grid: IsoGrid, private rebuild: () => void) {
        this.m = model!;
        this.builtVersion = this.m.version;
        panel ??= new EditorPanel(this.actions());
        this.overlay = new EditorOverlay(scene, grid, this.m);

        const input = scene.input;
        input.mouse?.disableContextMenu();
        input.on('pointermove', (p: Input.Pointer) => this.onMove(p));
        input.on('pointerdown', (p: Input.Pointer) => this.onDown(p));
        input.on('pointerup', (p: Input.Pointer) => this.onUp(p));
        input.on('wheel', (_p: Input.Pointer, _o: unknown, _dx: number, dy: number) => zoomBy(dy > 0 ? 0.9 : 1.1));

        const down = (e: KeyboardEvent) => this.onKey(e);
        const up = (e: KeyboardEvent) => this.held.delete(e.key.toLowerCase());
        const leave = (e: BeforeUnloadEvent) => { if (this.m.dirty) e.preventDefault(); };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('beforeunload', leave);
        scene.events.once('shutdown', () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('beforeunload', leave);
        });
        this.render();
    }

    /** where the cursor points in the world, so buildings in front of it turn see-through */
    get focusPoint() {
        return this.hover ? this.grid.toWorld(this.hover.fi, this.hover.fj) : { x: -9999, y: -9999 };
    }

    update(dt: number) {
        // keyboard panning
        const cam = this.scene.cameras.main, sp = 600 * dt / cam.zoom, k = this.held;
        if (k.has('a') || k.has('arrowleft')) cam.scrollX -= sp;
        if (k.has('d') || k.has('arrowright')) cam.scrollX += sp;
        if (k.has('w') || k.has('arrowup')) cam.scrollY -= sp;
        if (k.has('s') || k.has('arrowdown')) cam.scrollY += sp;
        this.overlay.update(this.m, this.hover, this.ghost(), this.stroke?.tiles ?? null);
        if (this.m.version !== this.builtVersion) this.rebuild();
    }

    // ---------------------------------------------------------------- mouse
    private tileOf(p: Input.Pointer) {
        const t = this.grid.toTile(p.worldX, p.worldY), r = this.m.room;
        const fi = Math.max(-0.6, Math.min(r.w - 0.4, Math.round(t.i * 2) / 2));
        const fj = Math.max(-0.6, Math.min(r.h - 0.4, Math.round(t.j * 2) / 2));
        return { i: Math.round(t.i), j: Math.round(t.j), fi, fj };
    }

    private placeRect(i: number, j: number): Rect | null {
        const t = this.m.template;
        if (!t) return null;
        const i0 = i - Math.floor((t.di - 1) / 2), j0 = j - Math.floor((t.dj - 1) / 2);
        return { i0, j0, i1: i0 + t.di - 1, j1: j0 + t.dj - 1 };
    }

    private ghost(): Ghost {
        const h = this.hover, r = this.m.room;
        const inside = (x: Rect) => x.i0 >= 0 && x.j0 >= 0 && x.i1 < r.w && x.j1 < r.h;
        if (this.drag && h) {
            const o = this.drag.orig, di = h.i - this.drag.start.i, dj = h.j - this.drag.start.j;
            const rect = { i0: o.i0 + di, j0: o.j0 + dj, i1: o.i1 + di, j1: o.j1 + dj };
            return { rect, ok: inside(rect) };
        }
        if (this.exitStart && h) {
            const s = this.exitStart;
            return { rect: { i0: Math.min(s.i, h.i), j0: Math.min(s.j, h.j), i1: Math.max(s.i, h.i), j1: Math.max(s.j, h.j) }, ok: true };
        }
        if (this.m.tool === 'place' && h) {
            const rect = this.placeRect(h.i, h.j);
            return rect ? { rect, ok: inside(rect) } : null;
        }
        return null;
    }

    private onMove(p: Input.Pointer) {
        if (this.pan) {
            const cam = this.scene.cameras.main;
            cam.scrollX -= (p.x - this.pan.x) / cam.zoom; cam.scrollY -= (p.y - this.pan.y) / cam.zoom;
            this.pan = { x: p.x, y: p.y };
            return;
        }
        this.hover = this.tileOf(p);
        if (this.stroke && p.leftButtonDown()) this.paint();
    }

    private onDown(p: Input.Pointer) {
        if (p.rightButtonDown() || p.middleButtonDown()) { this.pan = { x: p.x, y: p.y }; return; }
        const h = this.hover = this.tileOf(p), m = this.m;
        switch (m.tool) {
            case 'select': {
                const box = pickBox(this.grid, m.room.boxes, { x: p.worldX, y: p.worldY });
                if (box >= 0) {
                    m.select({ kind: 'box', index: box });
                    const b = m.room.boxes[box];
                    this.drag = { start: { i: h.i, j: h.j }, orig: { i0: b.i0, j0: b.j0, i1: b.i1, j1: b.j1 } };
                    break;
                }
                const ex = m.room.exits.findIndex(e => h.i >= e.i0 && h.i <= e.i1 && h.j >= e.j0 && h.j <= e.j1);
                if (ex >= 0) {
                    m.select({ kind: 'exit', index: ex });
                    const e = m.room.exits[ex];
                    this.drag = { start: { i: h.i, j: h.j }, orig: { i0: e.i0, j0: e.j0, i1: e.i1, j1: e.j1 } };
                    break;
                }
                const ww = (m.room.walkways ?? []).findIndex(w => w.some(([i, j], k) => k > 0 && nearSegment(h.fi, h.fj, w[k - 1], [i, j])));
                m.select(ww >= 0 ? { kind: 'walkway', index: ww } : null);
                break;
            }
            case 'place': { const r = this.placeRect(h.i, h.j); if (r && m.template) m.place(m.template, r.i0, r.j0); break; }
            case 'paint': m.beginStroke(); this.stroke = { changed: false, tiles: new Set(), last: null }; this.paint(); break;
            case 'lamp': m.toggleLamp(h.i, h.j); break;
            case 'exit': this.exitStart = { i: h.i, j: h.j }; break;
            case 'spawn': m.setSpawn(h.i, h.j); break;
            case 'walkway': m.addPathPoint(h.fi, h.fj); break;
        }
        this.render();
    }

    private onUp(p: Input.Pointer) {
        if (this.pan && !p.rightButtonDown() && !p.middleButtonDown()) { this.pan = null; return; }
        const g = this.ghost();
        if (this.drag && g) {
            if (g.ok) this.m.moveSelected(g.rect.i0, g.rect.j0);
            this.drag = null;
        }
        if (this.exitStart && g) { this.m.addExit(g.rect); this.exitStart = null; }
        if (this.stroke) { this.m.endStroke(this.stroke.changed); this.stroke = null; }
        this.render();
    }

    private paint() {
        if (!this.hover || !this.stroke) return;
        // fill every tile between the last mouse position and this one, so fast drags don't leave gaps
        const s = this.stroke, to = this.hover, from = s.last ?? to;
        const steps = Math.max(Math.abs(to.i - from.i), Math.abs(to.j - from.j), 1);
        const r = Math.floor(this.m.brush / 2);
        for (let k = 0; k <= steps; k++) {
            const i = Math.round(from.i + (to.i - from.i) * k / steps), j = Math.round(from.j + (to.j - from.j) * k / steps);
            s.changed = this.m.paintAt(i, j) || s.changed;
            for (let y = j - r; y <= j + r; y++) for (let x = i - r; x <= i + r; x++)
                if (x >= 0 && y >= 0 && x < this.m.room.w && y < this.m.room.h) s.tiles.add(`${x},${y}`);
        }
        s.last = { i: to.i, j: to.j };
    }

    // ---------------------------------------------------------------- keyboard
    private onKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        const k = e.key.toLowerCase(), m = this.m;
        if (e.ctrlKey || e.metaKey) {
            if (k === 'z' && !e.shiftKey) m.undo();
            else if (k === 'y' || (k === 'z' && e.shiftKey)) m.redo();
            else if (k === 's') { e.preventDefault(); void this.save(); }
            else return;
            e.preventDefault(); this.render(); return;
        }
        if (k >= '1' && k <= '7') this.setTool(TOOL_KEYS[Number(k) - 1]);
        else if (k === 'delete' || k === 'backspace') m.deleteSelected();
        else if (k === 'r') m.rotateSelected();
        else if (k === 'enter') m.finishPath();
        else if (k === 'escape') { m.path = null; m.select(null); this.drag = null; this.exitStart = null; }
        else { this.held.add(k); return; }
        this.render();
    }

    private setTool(t: Tool) {
        const m = this.m;
        if (t !== 'walkway') m.path = null;
        m.tool = t;
        if (t === 'place' && !m.template) m.template = CATALOG[0];
    }

    // ---------------------------------------------------------------- panel
    private render() {
        panel!.render(this.m, world.minutes / 60, world.raining);
    }

    private actions(): PanelActions {
        // `model` (module state) rather than this.m: the panel outlives this controller across rebuilds
        const m = () => model!;
        const after = (fn: () => void) => () => { fn(); this.render(); };
        return {
            tool: t => { this.setTool(t); this.render(); },
            template: id => { const m0 = m(); m0.template = CATALOG.find(t => t.id === id) ?? null; m0.tool = 'place'; this.render(); },
            ground: g => { m().paintGround = g; this.render(); },
            brush: n => { m().brush = n; this.render(); },
            update: patch => { m().updateSelected(patch); this.render(); },
            resize: (di, dj) => { m().resizeSelected(di, dj); this.render(); },
            rotate: after(() => m().rotateSelected()),
            remove: after(() => m().deleteSelected()),
            undo: after(() => m().undo()),
            redo: after(() => m().redo()),
            save: () => void this.save(),
            switchRoom: id => {
                if (m().dirty && !confirm('ยังไม่ได้บันทึกห้องนี้ ทิ้งการแก้ไขแล้วเปลี่ยนห้อง?')) { this.render(); return; }
                m().markSaved();
                location.search = `?edit=1&room=${id}`;
            },
            time: h => { setTimeOfDay(h); this.render(); },
            rain: on => { world.raining = on; this.render(); },
            roomSize: (w, h) => { m().setRoomSize(w, h); this.render(); },
            roomName: n => { m().setName(n); this.render(); },
            finishPath: after(() => m().finishPath()),
            focus: (i, j) => { const p = this.grid.toWorld(i, j); this.scene.cameras.main.centerOn(p.x, p.y); },
            exit: () => {
                if (m().dirty && !confirm('ยังไม่ได้บันทึก ออกจาก editor เลยไหม?')) return;
                m().markSaved();
                location.search = `?room=${m().id}`;
            },
        };
    }

    private async save() {
        const m = this.m;
        if (m.hasErrors || !m.dirty) return;
        panel!.status = 'กำลังบันทึก…'; this.render();
        try {
            const res = await fetch(`/api/rooms/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m.room) });
            const out = await res.json().catch(() => ({}));
            if (res.ok && out.saved) {
                m.markSaved();
                const cam = this.scene.cameras.main;
                sessionStorage.setItem(CAM_KEY, JSON.stringify({ room: m.id, x: cam.scrollX, y: cam.scrollY }));
                panel!.status = 'บันทึกแล้ว ✓ เกมจะโหลดห้องใหม่เอง';
            } else {
                const why = out.error ?? out.problems?.filter((p: { level: string }) => p.level === 'error').map((p: { message: string }) => p.message).join(' · ');
                panel!.status = `บันทึกไม่ได้: ${why || res.status}`;
            }
        } catch {
            panel!.status = 'ต่อ server ไม่ได้: เปิด server ก่อน (cd server แล้ว npm run dev)';
        }
        this.render();
    }
}

/** is (i, j) within ~0.35 tiles of segment a-b */
function nearSegment(i: number, j: number, a: [number, number], b: [number, number]) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((i - a[0]) * dx + (j - a[1]) * dy) / L));
    return Math.hypot(a[0] + t * dx - i, a[1] + t * dy - j) < 0.35;
}
