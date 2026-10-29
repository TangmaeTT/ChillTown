import { Scene, GameObjects, Input } from 'phaser';
import { VIEWS } from '@shared/avatar';
import { AvatarEditorModel } from '../model/AvatarEditorModel';
import { PlayerModel, SPEED } from '../model/PlayerModel';
import { PlayerView, PLAYER_SHEET, preloadAvatar } from '../view/PlayerView';
import { AvatarPanel } from '../view/editor/AvatarPanel';
import rig from '../model/player_rig.json';

// The avatar editor (?avatar=1): the 4 drawn views of the character side by side, standing, plus one figure
// playing its animation. Drag a head part on a view (or use the arrow keys) to fit it to the head;
// Ctrl+S writes shared/parts.json through the server (dev only), like the map editor does for rooms.

const CELL = 76;                    // world px per figure (frame 68 + gap)
const FEET = 64;                    // feet line in world px
const ROW_OF_VIEW = [1, 3, 5, 7];   // player.png row drawn for each part view (SE, SW, NW, NE)
const PANEL_W = 300;

export class AvatarEditorController extends Scene {
    private m = new AvatarEditorModel();
    private panel!: AvatarPanel;
    private figures: { model: PlayerModel; view: PlayerView }[] = [];
    private preview!: { model: PlayerModel; view: PlayerView };
    private frameGfx!: GameObjects.Graphics;
    private drag: { view: number; x: number; y: number; moved: [number, number] } | null = null;
    private shownLook = '';
    private shownParts: unknown = null;

    constructor() { super('AvatarEditor'); }

    preload() {
        this.load.setPath('assets');
        preloadAvatar(this);
    }

    create() {
        this.cameras.main.setBackgroundColor('#14181c');
        this.frameGfx = this.add.graphics().setDepth(-1);
        const labels = [...VIEWS.map((v, k) => `${k + 1} · ${v}`), 'ท่า'];
        labels.forEach((t, k) => this.add.text(k * CELL + CELL / 2, 4, t, {
            fontFamily: 'Tahoma, sans-serif', fontSize: '6px', color: '#9fb08f', resolution: 8,
        }).setOrigin(0.5, 0));

        const cx = (k: number) => k * CELL + CELL / 2;
        this.figures = ROW_OF_VIEW.map((row, k) => {
            const model = new PlayerModel(cx(k), FEET, row);
            return { model, view: new PlayerView(this, model, '', this.m.look, this.m.parts) };
        });
        const pm = new PlayerModel(cx(4), FEET, this.m.previewRow);
        this.preview = { model: pm, view: new PlayerView(this, pm, '', this.m.look, this.m.parts) };
        for (const f of [...this.figures, this.preview]) f.view.setVisible(true);

        this.panel = new AvatarPanel({
            select: id => this.m.select(id),
            wear: (id, on) => this.m.wear(id, on),
            view: v => this.m.setView(v),
            offset: (x, y) => this.m.setOffset(this.m.view, x, y),
            mirror: () => this.m.mirrorTo(this.m.view),
            reset: () => this.m.resetOffsets(),
            colour: (w, n) => this.m.colour(w, n),
            sway: (k, v) => this.m.setSway(k, v),
            garment: (f, id) => this.m.cloth(f, id),
            clothColour: (f, n) => this.m.cloth(f, n),
            play: on => this.m.setPlaying(on),
            previewRow: r => this.m.setPreviewRow(r),
            undo: () => this.m.undo(),
            redo: () => this.m.redo(),
            save: () => this.save(),
        });
        this.m.listen(() => this.refresh());
        this.refresh();

        this.fitCamera();
        this.scale.on('resize', () => this.fitCamera());
        this.input.on('pointerdown', (p: Input.Pointer) => this.pointerDown(p));
        this.input.on('pointermove', (p: Input.Pointer) => this.pointerMove(p));
        this.input.on('pointerup', () => { this.drag = null; });
        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.key(e));
        window.addEventListener('beforeunload', e => { if (this.m.dirty) e.preventDefault(); });
    }

    /** biggest whole zoom that fits the 5 figures left of the panel */
    private fitCamera() {
        const cam = this.cameras.main;
        const panel = PANEL_W * this.scale.displayScale.x;     // the panel is CSS px; the game is scaled to the screen
        const w = this.scale.width - panel, h = this.scale.height;
        const zoom = Math.max(1, Math.floor(Math.min(w / (5 * CELL), h / (FEET + 16))));
        cam.setZoom(zoom);
        // centre the strip in the space left of the panel
        cam.centerOn(5 * CELL / 2 + panel / 2 / zoom, FEET / 2 + 4);
    }

    private refresh() {
        const look = JSON.stringify(this.m.look);
        if (look !== this.shownLook || this.m.parts !== this.shownParts) {   // undo swaps in a new parts array
            this.shownLook = look; this.shownParts = this.m.parts;
            for (const f of [...this.figures, this.preview]) f.view.setLook(this.m.look, this.m.parts);
        }
        this.preview.model.facing = this.m.previewRow;
        this.drawFrames();
        this.panel.render(this.m);
    }

    /** cell backgrounds, the chosen view outlined, and the head box from player_rig.json as a guide */
    private drawFrames() {
        const g = this.frameGfx.clear(), f = PLAYER_SHEET.frame;
        for (let k = 0; k < 5; k++) {
            const x0 = k * CELL + (CELL - f) / 2, y0 = FEET - 60;    // frame top-left (feet at y 60 of the frame)
            g.fillStyle(0x1c2226).fillRect(x0, y0, f, f);
            g.lineStyle(1, 0x2a3236).lineBetween(x0, FEET + 0.5, x0 + f, FEET + 0.5);
            if (k < 4) {
                const [bx, by, bw, bh] = rig.box[ROW_OF_VIEW[k]];
                g.lineStyle(1, 0x3d6a7a, 0.6).strokeRect(x0 + bx + 0.5, y0 + by + 0.5, bw - 1, bh - 1);
                if (k === this.m.view) g.lineStyle(1, 0xd3ca90).strokeRect(x0 - 0.5, y0 - 0.5, f + 1, f + 1);
            }
        }
    }

    private viewAt(p: Input.Pointer) {
        const k = Math.floor(p.worldX / CELL);
        return k >= 0 && k < 4 && p.worldY > 0 && p.worldY < FEET + 8 ? k : -1;
    }

    private pointerDown(p: Input.Pointer) {
        const v = this.viewAt(p);
        if (v < 0) return;
        if (v !== this.m.view) this.m.setView(v);
        const part = this.m.part;
        if (!part || !this.m.look.parts.includes(part.id)) return;
        this.m.beginGroup();
        this.drag = { view: v, x: p.worldX, y: p.worldY, moved: [0, 0] };
    }

    private pointerMove(p: Input.Pointer) {
        const d = this.drag;
        if (!d || !p.isDown) return;
        const tx = Math.round(p.worldX - d.x), ty = Math.round(p.worldY - d.y);
        const dx = tx - d.moved[0], dy = ty - d.moved[1];
        if (!dx && !dy) return;
        d.moved = [tx, ty];
        this.m.nudge(d.view, dx, dy, true);
    }

    private key(e: KeyboardEvent) {
        if ((e.target as HTMLElement).closest?.('input, select')) return;
        const ctrl = e.ctrlKey || e.metaKey, step = e.shiftKey ? 4 : 1;
        const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); }
        else if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); this.m.undo(); }
        else if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); this.m.redo(); }
        else if (arrows[e.key]) { e.preventDefault(); this.m.nudge(this.m.view, ...arrows[e.key]); }
        else if (e.key >= '1' && e.key <= '4') this.m.setView(Number(e.key) - 1);
        else if (e.key === ' ') { e.preventDefault(); this.m.setPlaying(!this.m.playing); }
    }

    private async save() {
        this.panel.status = 'กำลังบันทึก…';
        this.panel.render(this.m);
        try {
            const res = await fetch('/api/parts', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.m.parts),
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok) { this.panel.status = 'บันทึกแล้ว ✓'; this.m.markSaved(); return; }
            this.panel.status = `บันทึกไม่ได้: ${body.error ?? res.status}`;
        } catch {
            this.panel.status = 'บันทึกไม่ได้: ติดต่อ server ไม่ได้ (cd server && npm run dev)';
        }
        this.panel.render(this.m);
    }

    update(_t: number, delta: number) {
        const pm = this.preview.model;
        pm.moving = this.m.playing;
        // walking in place, but swaying parts feel the speed as if it were moving that way
        pm.vx = this.m.playing ? Math.cos(pm.facing * Math.PI / 4) * SPEED : 0;
        if (this.m.playing) pm.walkT += delta / 1000; else pm.walkT = 0;
        this.figures.forEach(f => f.view.sync(f.model, 1));
        this.preview.view.sync(pm, 1);
    }
}
