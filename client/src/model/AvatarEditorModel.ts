// Avatar editor state (?avatar=1): a working copy of the head parts, the look being tried on, and which
// part/view is being nudged. No Phaser; the controller changes it, the views read it.
import { PARTS, DEFAULT_LOOK, MAX_OFFSET, SLOTS, VIEWS, formatParts, type Look, type Part } from '@shared/avatar';

export class AvatarEditorModel {
    parts: Part[] = structuredClone(PARTS);
    // start with a face and hair on (the first part of each), hats and glasses off
    look: Look = { ...DEFAULT_LOOK, hair: 2, parts: (['hairBack', 'face', 'hairFront'] as const)
        .map(s => PARTS.find(p => p.slot === s)?.id).filter((id): id is string => !!id) };
    selected: string | null = PARTS[0]?.id ?? null;   // the part that dragging / arrow keys move
    view = 0;                                          // which of the 4 views (VIEWS) arrow keys move
    playing = true;                                    // preview figure animates
    previewRow = 3;                                    // player.png row the preview plays (SW)
    private saved = formatParts(PARTS);
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private onChange: () => void = () => {};

    listen(fn: () => void) { this.onChange = fn; }

    get dirty() { return formatParts(this.parts) !== this.saved; }
    get part() { return this.parts.find(p => p.id === this.selected) ?? null; }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }

    /** a change to the part data: undoable, marks unsaved */
    private edit(fn: () => void) {
        this.undoStack.push(JSON.stringify(this.parts));
        this.redoStack = [];
        fn();
        this.onChange();
    }

    /** a change to what's shown (not saved to parts.json) */
    private show(fn: () => void) { fn(); this.onChange(); }

    select(id: string) {
        this.show(() => {
            this.selected = id;
            if (!this.look.parts.includes(id)) this.wear(id, true);
        });
    }

    /** put a part on (taking off whatever is in its slot) or take it off */
    wear(id: string, on: boolean) {
        this.show(() => {
            const slot = this.parts.find(p => p.id === id)!.slot;
            const rest = this.look.parts.filter(p => p !== id && (!on || this.parts.find(q => q.id === p)!.slot !== slot));
            this.look.parts = on ? [...rest, id] : rest;
            this.look.parts.sort((a, b) => SLOTS.indexOf(this.slotOf(a)) - SLOTS.indexOf(this.slotOf(b)));
        });
    }

    private slotOf(id: string) { return this.parts.find(p => p.id === id)!.slot; }

    colour(which: 'skin' | 'hair' | 'item', n: number) { this.show(() => { this.look[which] = n; }); }
    /** clothes: which top/bottom, and the colour of top, bottom or shoes */
    cloth(field: 'top' | 'bottom', id: string): void;
    cloth(field: 'topColor' | 'bottomColor' | 'shoes', n: number): void;
    cloth(field: 'top' | 'bottom' | 'topColor' | 'bottomColor' | 'shoes', v: string | number) {
        this.show(() => { (this.look as Record<string, unknown>)[field] = v; });
    }
    setView(v: number) { this.show(() => { this.view = v; }); }
    setPlaying(on: boolean) { this.show(() => { this.playing = on; }); }
    setPreviewRow(r: number) { this.show(() => { this.previewRow = r; }); }

    /** move the selected part in one view; drags send many small moves, `group` keeps them as one undo step */
    nudge(view: number, dx: number, dy: number, group = false) {
        const p = this.part;
        if (!p || (!dx && !dy)) return;
        const clamp = (v: number) => Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, v));
        const apply = () => { const o = p.offset[view]; p.offset[view] = [clamp(o[0] + dx), clamp(o[1] + dy)]; };
        if (group) { apply(); this.onChange(); } else this.edit(apply);
    }

    /** call before a drag so the whole drag undoes in one step */
    beginGroup() { this.undoStack.push(JSON.stringify(this.parts)); this.redoStack = []; }

    setOffset(view: number, x: number, y: number) {
        const p = this.part;
        if (p) this.edit(() => { p.offset[view] = [x, y]; });
    }

    /** copy this view's offset to the view mirrored across the screen (SE<->SW, NW<->NE), x flipped */
    mirrorTo(view: number) {
        const p = this.part;
        if (!p) return;
        const other = [1, 0, 3, 2][view], [x, y] = p.offset[view];
        this.edit(() => { p.offset[other] = [-x, y]; });
    }

    /** tune the selected part's spring (sliders send this on release, so each is one undo step) */
    setSway(key: 'stiffness' | 'damping' | 'gain', value: number) {
        const p = this.part;
        if (p?.sway) this.edit(() => { p.sway![key] = value; });
    }

    resetOffsets() {
        const p = this.part;
        if (p) this.edit(() => { p.offset = VIEWS.map(() => [0, 0]); });
    }

    undo() { this.step(this.undoStack, this.redoStack); }
    redo() { this.step(this.redoStack, this.undoStack); }
    private step(from: string[], to: string[]) {
        const s = from.pop();
        if (s === undefined) return;
        to.push(JSON.stringify(this.parts));
        this.parts = JSON.parse(s);
        this.onChange();
    }

    /** after the server wrote parts.json */
    markSaved() { this.saved = formatParts(this.parts); this.onChange(); }
}
