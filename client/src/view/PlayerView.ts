import { Scene, GameObjects } from 'phaser';
import { SLOTS, HAIR_COLORS, ITEM_COLORS, CLOTH_COLORS, TOPS, BOTTOMS, PARTS, VIEWS, type Look, type Part } from '@shared/avatar';
import { WALK_FRAMES, WALK_FPS, SPEED, type PlayerModel } from '../model/PlayerModel';
import { SwaySpring } from '../model/SwaySpring';
import { world } from '../model/WorldModel';
import rig from '../model/player_rig.json';
import body from '../model/player_body.json';
import { recolored } from './art/recolor';
import { dressed, REGIONS_KEY, PART_KEY, VIEW_OF_ROW } from './art/outfit';
export { PART_KEY, VIEW_OF_ROW };

// player.png (tools/char_sheet.py): 68x68 frames, col 0 = standing, then the walk cycle;
// rows clockwise from screen angle: E, SE, S, SW, W, NW, N, NE
export const PLAYER_SHEET = { key: 'player', file: 'player.png', frame: 68 };
const FEET_Y = 60;

// Head parts (head/<id>.png) have one standing view per diagonal: SE, SW, NW, NE.
const facesAway = (row: number) => VIEW_OF_ROW[row] >= 2;
/** the ramp a tinted part is recoloured to, and a short name for it (texture cache key) */
const tintOf = (tint: NonNullable<Part['tint']>, l: Look): [string[], string] => ({
    hair: [HAIR_COLORS[l.hair], `hair${l.hair}`],
    item: [ITEM_COLORS[l.item], `item${l.item}`],
    top: [CLOTH_COLORS[l.topColor], `cloth${l.topColor}`],
    bottom: [CLOTH_COLORS[l.bottomColor], `cloth${l.bottomColor}`],
} as Record<string, [string[], string]>)[tint];

// Blink: ms since the blink started -> sheet row (0 open, 1 half, 2 closed). Every 2-6 s, now and then twice.
const BLINK: [number, number][] = [[45, 1], [125, 2], [180, 1]];
const blinkRow = (ms: number) => ms < 0 ? 0 : BLINK.find(([end]) => ms < end)?.[1] ?? 0;

/** gusts, a little stronger in the rain: a slow drift toward screen-right with some flutter */
const wind = (t: number) => (world.raining ? 0.22 : 0.08) * (0.6 + Math.sin(t * 0.5) * 0.4 + Math.sin(t * 2.3 + 1) * 0.25);

/** load the body sheet and every head part (call from a scene's preload, with the path set to assets/) */
export function preloadAvatar(scene: Scene) {
    const f = PLAYER_SHEET.frame;
    scene.load.spritesheet(PLAYER_SHEET.key, PLAYER_SHEET.file, { frameWidth: f, frameHeight: f });
    scene.load.image(REGIONS_KEY, 'player_regions.png');
    for (const p of PARTS) scene.load.spritesheet(PART_KEY(p.id), `head/${p.id}.png`, { frameWidth: f, frameHeight: f });
}

export class PlayerView {
    private sprite: GameObjects.Sprite;
    private parts: { part: Part; sprite: GameObjects.Sprite; spring: SwaySpring }[] = [];
    private lastSync = 0;
    private nameTag: GameObjects.Text;
    private blinkAt = 0;     // scene time the current/next blink starts

    // catalog: the avatar editor passes its working copy, so nudged offsets show at once
    constructor(private scene: Scene, model: PlayerModel, name: string, look: Look, private catalog: Part[] = PARTS) {
        this.sprite = scene.add.sprite(model.x, model.y, PLAYER_SHEET.key, 0).setOrigin(0.5, FEET_Y / PLAYER_SHEET.frame);
        this.nameTag = scene.add.text(model.x, model.y - 56, name, {
            fontFamily: 'Tahoma, sans-serif', fontSize: '8px', color: '#e8f0c8', resolution: 4,
            stroke: '#0e1014', strokeThickness: 2,
        }).setOrigin(0.5, 1);
        this.setLook(look);
    }

    get gameObject() { return this.sprite; }

    setVisible(on: boolean) {
        this.sprite.setVisible(on); this.nameTag.setVisible(on);
        for (const p of this.parts) p.sprite.setVisible(on);
    }

    setLook(look: Look, catalog = this.catalog) {
        this.catalog = catalog;
        const f = PLAYER_SHEET.frame;
        this.sprite.setTexture(dressed(this.scene, PLAYER_SHEET.key, look, f, rig.skin), this.sprite.frame.name);
        for (const p of this.parts) p.sprite.destroy();
        // the head parts chosen, plus whatever the clothes bring with them (a hood, a skirt over the legs)
        const overlays = [TOPS.find(x => x.id === look.top)?.overlay, BOTTOMS.find(x => x.id === look.bottom)?.overlay]
            .filter((id): id is string => !!id);
        const ids = [...new Set([...look.parts, ...overlays])].filter(id => this.catalog.some(p => p.id === id));
        this.parts = ids.map(id => {
            const part = this.catalog.find(p => p.id === id)!;
            let key = PART_KEY(id);
            if (part.tint) {
                const [ramp, name] = tintOf(part.tint, look);
                key = recolored(this.scene, PART_KEY(id), `${PART_KEY(id)}@${name}`, f, ramp);
            }
            return { part, spring: new SwaySpring(), sprite: this.scene.add.sprite(0, 0, key, 0).setOrigin(this.sprite.originX, this.sprite.originY) };
        }).sort((a, b) => SLOTS.indexOf(a.part.slot) - SLOTS.indexOf(b.part.slot));
    }

    sync(model: PlayerModel, depth: number) {
        const row = model.facing, col = model.frame;
        this.sprite.setPosition(model.x, model.y).setFrame(row * (WALK_FRAMES + 1) + col).setDepth(depth);
        const head = rig.offset[row][col], waist = body.offset[row][col];
        const view = VIEW_OF_ROW[row];
        const now = this.scene.time.now;
        if (now - this.blinkAt > 200) {
            const double = Math.random() < 0.15;
            this.blinkAt = now + (double ? 260 : 2000 + Math.random() * 4000);
        }
        const eyes = blinkRow(now - this.blinkAt);
        const dt = this.lastSync ? (now - this.lastSync) / 1000 : 0;
        this.lastSync = now;
        // swaying parts trail behind the walk (screen x), bob with the steps, and lean in the wind
        const step = model.moving ? Math.sin(model.walkT * WALK_FPS / WALK_FRAMES * Math.PI * 4) * 0.12 : 0;
        const drive = Math.max(-1, Math.min(1, -model.vx / SPEED + step + wind(now / 1000)));
        for (const { part, sprite, spring } of this.parts) {
            const slot = part.slot, n = SLOTS.indexOf(slot) + 1;
            const [ox, oy] = part.offset[view];
            // long hair and hoods hang behind the shoulders when facing the camera, over the back when facing away
            // (a hood under the hair)
            const behind = (slot === 'hairBack' || slot === 'hood') && !facesAway(row);
            const d = behind ? depth - (slot === 'hood' ? 0.02 : 0.01) : depth + n * 0.01;
            let r = 0;
            if (part.blink) r = eyes;
            else if (part.sway) { spring.update(dt, drive * part.sway.gain, part.sway); r = spring.pose(part.sway); }
            const frame = r * VIEWS.length + view;
            const [dx, dy] = part.anchor === 'waist' ? waist : head;
            sprite.setPosition(model.x + dx + ox, model.y + dy + oy).setFrame(frame).setDepth(d);
        }
        this.nameTag.setPosition(Math.round(model.x), Math.round(model.y - 56)).setDepth(depth + 0.5);
    }
}
