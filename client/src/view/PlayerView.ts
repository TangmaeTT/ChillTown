import { Scene, GameObjects } from 'phaser';
import { SLOTS, SKIN_TONES, HAIR_COLORS, ITEM_COLORS, PARTS, VIEWS, type Look, type Part } from '@shared/avatar';
import { WALK_FRAMES, type PlayerModel } from '../model/PlayerModel';
import rig from '../model/player_rig.json';
import { recolored } from './art/recolor';

// player.png (tools/char_sheet.py): 68x68 frames, col 0 = standing, then the walk cycle;
// rows clockwise from screen angle: E, SE, S, SW, W, NW, N, NE
export const PLAYER_SHEET = { key: 'player', file: 'player.png', frame: 68 };
const FEET_Y = 60;

// Head parts (head/<id>.png) have one standing view per diagonal: SE, SW, NW, NE.
export const PART_KEY = (id: string) => `head_${id}`;
export const VIEW_OF_ROW = [0, 0, 1, 1, 1, 2, 3, 3];
const facesAway = (row: number) => VIEW_OF_ROW[row] >= 2;
const RAMPS = { hair: HAIR_COLORS, item: ITEM_COLORS };

// Blink: ms since the blink started -> sheet row (0 open, 1 half, 2 closed). Every 2-6 s, now and then twice.
const BLINK: [number, number][] = [[45, 1], [125, 2], [180, 1]];
const blinkRow = (ms: number) => ms < 0 ? 0 : BLINK.find(([end]) => ms < end)?.[1] ?? 0;

/** load the body sheet and every head part (call from a scene's preload, with the path set to assets/) */
export function preloadAvatar(scene: Scene) {
    const f = PLAYER_SHEET.frame;
    scene.load.spritesheet(PLAYER_SHEET.key, PLAYER_SHEET.file, { frameWidth: f, frameHeight: f });
    for (const p of PARTS) scene.load.spritesheet(PART_KEY(p.id), `head/${p.id}.png`, { frameWidth: f, frameHeight: f });
}

export class PlayerView {
    private sprite: GameObjects.Sprite;
    private parts: { part: Part; sprite: GameObjects.Sprite }[] = [];
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
        this.sprite.setTexture(recolored(this.scene, PLAYER_SHEET.key, `player@skin${look.skin}`, f, SKIN_TONES[look.skin], rig.skin), this.sprite.frame.name);
        for (const p of this.parts) p.sprite.destroy();
        this.parts = look.parts.map(id => {
            const part = this.catalog.find(p => p.id === id)!;
            const key = part.tint
                ? recolored(this.scene, PART_KEY(id), `${PART_KEY(id)}@${part.tint}${look[part.tint]}`, f, RAMPS[part.tint][look[part.tint]])
                : PART_KEY(id);
            return { part, sprite: this.scene.add.sprite(0, 0, key, 0).setOrigin(this.sprite.originX, this.sprite.originY) };
        }).sort((a, b) => SLOTS.indexOf(a.part.slot) - SLOTS.indexOf(b.part.slot));
    }

    sync(model: PlayerModel, depth: number) {
        const row = model.facing, col = model.frame;
        this.sprite.setPosition(model.x, model.y).setFrame(row * (WALK_FRAMES + 1) + col).setDepth(depth);
        const [dx, dy] = rig.offset[row][col];
        const view = VIEW_OF_ROW[row];
        const now = this.scene.time.now;
        if (now - this.blinkAt > 200) {
            const double = Math.random() < 0.15;
            this.blinkAt = now + (double ? 260 : 2000 + Math.random() * 4000);
        }
        const eyes = blinkRow(now - this.blinkAt);
        for (const { part, sprite } of this.parts) {
            const slot = part.slot, n = SLOTS.indexOf(slot) + 1;
            const [ox, oy] = part.offset[view];
            // long hair hangs behind the shoulders when facing the camera, over the back when facing away
            const d = slot === 'hairBack' && !facesAway(row) ? depth - 0.01 : depth + n * 0.01;
            const frame = part.blink ? eyes * VIEWS.length + view : view;
            sprite.setPosition(model.x + dx + ox, model.y + dy + oy).setFrame(frame).setDepth(d);
        }
        this.nameTag.setPosition(Math.round(model.x), Math.round(model.y - 56)).setDepth(depth + 0.5);
    }
}
