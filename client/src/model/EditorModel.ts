// Map editor state: a working copy of one room, the current tool, the selection, undo/redo.
// Every change goes through an operation here, which snapshots for undo and re-validates. No Phaser.
import { ROOMS, ROOM_IDS, GROUND_CODE, type Room, type RoomId, type Box, type Exit, type Ground, type Rect } from '@shared/rooms';
import { validateRoom, incomingSpawns, type Problem } from '@shared/validate';
import type { Template } from './editorCatalog';

export type Tool = 'select' | 'place' | 'paint' | 'lamp' | 'exit' | 'spawn' | 'walkway';
export type Selection = { kind: 'box' | 'exit' | 'walkway'; index: number } | null;

const UNDO_LIMIT = 100;

export class EditorModel {
    room: Room;
    tool: Tool = 'select';
    template: Template | null = null;
    paintGround: Ground = 'sidewalk';
    brush = 1;
    selection: Selection = null;
    path: [number, number][] | null = null;     // walkway being drawn
    problems: Problem[] = [];
    dirty = false;
    version = 0;                                 // bumps when the room data changes; the scene rebuilds when it moves
    private undoStack: string[] = [];
    private redoStack: string[] = [];

    constructor(room: Room) {
        this.room = structuredClone(room);
        this.validate();
    }

    get id(): RoomId { return this.room.id; }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
    get hasErrors() { return this.problems.some(p => p.level === 'error'); }
    get selectedBox(): Box | null { return this.selection?.kind === 'box' ? this.room.boxes[this.selection.index] ?? null : null; }
    get selectedExit(): Exit | null { return this.selection?.kind === 'exit' ? this.room.exits[this.selection.index] ?? null : null; }

    // ---------------------------------------------------------------- history
    /** call before changing the room */
    private snap() {
        this.undoStack.push(JSON.stringify(this.room));
        if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
        this.redoStack = [];
    }
    /** call after changing the room */
    private changed() {
        this.dirty = true;
        this.version++;
        this.validate();
    }
    private edit(fn: () => void) { this.snap(); fn(); this.changed(); }

    undo() {
        const s = this.undoStack.pop();
        if (!s) return;
        this.redoStack.push(JSON.stringify(this.room));
        this.room = JSON.parse(s); this.selection = null; this.changed();
    }
    redo() {
        const s = this.redoStack.pop();
        if (!s) return;
        this.undoStack.push(JSON.stringify(this.room));
        this.room = JSON.parse(s); this.selection = null; this.changed();
    }
    markSaved() { this.dirty = false; }

    validate() {
        const others = ROOM_IDS.filter(id => id !== this.room.id).map(id => ROOMS[id]);
        this.problems = validateRoom(this.room, incomingSpawns([...others, this.room], this.room.id));
    }

    // ---------------------------------------------------------------- boxes
    private clampRect(r: Rect): Rect {
        const di = r.i1 - r.i0, dj = r.j1 - r.j0;
        const i0 = Math.max(0, Math.min(this.room.w - 1 - di, r.i0)), j0 = Math.max(0, Math.min(this.room.h - 1 - dj, r.j0));
        return { i0, j0, i1: i0 + di, j1: j0 + dj };
    }

    place(t: Template, i: number, j: number) {
        this.edit(() => {
            const rect = this.clampRect({ i0: i, j0: j, i1: i + t.di - 1, j1: j + t.dj - 1 });
            this.room.boxes.push({ ...rect, ...structuredClone(t.box) });
            this.selection = { kind: 'box', index: this.room.boxes.length - 1 };
        });
    }

    moveSelected(i0: number, j0: number) {
        const b = this.selectedBox, e = this.selectedExit;
        const target = b ?? e;
        if (!target || (target.i0 === i0 && target.j0 === j0)) return;
        this.edit(() => Object.assign(target, this.clampRect({ i0, j0, i1: i0 + target.i1 - target.i0, j1: j0 + target.j1 - target.j0 })));
    }

    /** di/dj = new footprint size */
    resizeSelected(di: number, dj: number) {
        const b = this.selectedBox ?? this.selectedExit;
        if (!b || di < 1 || dj < 1) return;
        this.edit(() => Object.assign(b, this.clampRect({ i0: b.i0, j0: b.j0, i1: b.i0 + di - 1, j1: b.j0 + dj - 1 })));
    }

    /** quarter turn: swap the footprint's sides, and the shop front moves to the other visible face */
    rotateSelected() {
        const b = this.selectedBox;
        if (!b) return;
        this.edit(() => {
            Object.assign(b, this.clampRect({ i0: b.i0, j0: b.j0, i1: b.i0 + (b.j1 - b.j0), j1: b.j0 + (b.i1 - b.i0) }));
            if (b.front) b.front = b.front === 'left' ? 'right' : 'left';
        });
    }

    updateSelected(patch: Partial<Box> & Partial<Exit>) {
        const t = this.selectedBox ?? this.selectedExit;
        if (!t) return;
        this.edit(() => {
            for (const [k, v] of Object.entries(patch)) {
                const remove = v === undefined || v === '' || (v === null && k !== 'to');   // exit.to = null means "closed"
            if (remove) delete (t as Record<string, unknown>)[k];
                else (t as Record<string, unknown>)[k] = v;
            }
        });
    }

    deleteSelected() {
        const s = this.selection;
        if (!s) return;
        this.edit(() => {
            if (s.kind === 'box') this.room.boxes.splice(s.index, 1);
            else if (s.kind === 'exit') this.room.exits.splice(s.index, 1);
            else this.room.walkways?.splice(s.index, 1);
            this.selection = null;
        });
    }

    select(sel: Selection) { this.selection = sel; }

    // ---------------------------------------------------------------- ground, lamps, spawn, exits
    /** paint without snapshotting each tile; call beginStroke() once before a drag */
    beginStroke() { this.snap(); }
    paintAt(i: number, j: number) {
        const c = GROUND_CODE[this.paintGround], r = Math.floor(this.brush / 2);
        let any = false;
        for (let y = j - r; y <= j + r; y++) for (let x = i - r; x <= i + r; x++) {
            if (x < 0 || y < 0 || x >= this.room.w || y >= this.room.h || this.room.ground[y][x] === c) continue;
            const row = this.room.ground[y];
            this.room.ground[y] = row.slice(0, x) + c + row.slice(x + 1);
            any = true;
        }
        return any;
    }
    endStroke(changedAnything: boolean) {
        if (changedAnything) this.changed(); else this.undoStack.pop();
    }

    toggleLamp(i: number, j: number) {
        this.edit(() => {
            const k = this.room.lamps.findIndex(l => l.i === i && l.j === j);
            if (k >= 0) this.room.lamps.splice(k, 1); else this.room.lamps.push({ i, j });
        });
    }

    setSpawn(i: number, j: number) { this.edit(() => { this.room.spawn = { i, j }; }); }

    addExit(r: Rect) {
        this.edit(() => {
            this.room.exits.push({ ...this.clampRect(r), to: null, label: 'ทางออก' });
            this.selection = { kind: 'exit', index: this.room.exits.length - 1 };
        });
    }

    // ---------------------------------------------------------------- walkways (pedestrian routes)
    addPathPoint(i: number, j: number) {
        (this.path ??= []).push([i, j]);
    }
    finishPath() {
        const p = this.path;
        this.path = null;
        if (!p || p.length < 2) return;
        this.edit(() => { (this.room.walkways ??= []).push(p); });
    }

    // ---------------------------------------------------------------- room settings
    setRoomSize(w: number, h: number) {
        if (w < 4 || h < 4 || w > 64 || h > 64) return;
        this.edit(() => {
            const fill = this.room.ground[0]?.[0] ?? 'p';
            this.room.ground = Array.from({ length: h }, (_, j) => (this.room.ground[j] ?? '').slice(0, w).padEnd(w, fill));
            this.room.w = w; this.room.h = h;
            // drop anything that no longer fits
            this.room.boxes = this.room.boxes.filter(b => b.i1 < w && b.j1 < h);
            this.room.exits = this.room.exits.filter(e => e.i1 < w && e.j1 < h);
            this.room.lamps = this.room.lamps.filter(l => l.i < w && l.j < h);
            this.selection = null;
        });
    }

    setName(name: string) { if (name.trim()) this.edit(() => { this.room.name = name.trim(); }); }
}
