import { Scene, GameObjects } from 'phaser';
import { SLOTS, SKIN_TONES, HAIR_COLORS, ITEM_COLORS, partById, type Look, type Slot } from '@shared/avatar';
import { WALK_FRAMES, type PlayerModel } from '../model/PlayerModel';
import rig from '../model/player_rig.json';
import { recolored } from './art/recolor';

// player.png (tools/char_sheet.py): 68x68 frames, col 0 = standing, then the walk cycle;
// rows clockwise from screen angle: E, SE, S, SW, W, NW, N, NE
export const PLAYER_SHEET = { key: 'player', file: 'player.png', frame: 68 };
const FEET_Y = 60;

// Head parts (head/<id>.png) have one standing view per diagonal: SE, SW, NW, NE.
export const PART_KEY = (id: string) => `head_${id}`;
const VIEW_OF_ROW = [0, 0, 1, 1, 1, 2, 3, 3];
const facesAway = (row: number) => VIEW_OF_ROW[row] >= 2;
const RAMPS = { hair: HAIR_COLORS, item: ITEM_COLORS };

export class PlayerView {
    private sprite: GameObjects.Sprite;
    private parts: { slot: Slot; sprite: GameObjects.Sprite }[] = [];
    private nameTag: GameObjects.Text;

    constructor(private scene: Scene, model: PlayerModel, name: string, look: Look) {
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

    setLook(look: Look) {
        const f = PLAYER_SHEET.frame;
        this.sprite.setTexture(recolored(this.scene, PLAYER_SHEET.key, `player@skin${look.skin}`, f, SKIN_TONES[look.skin], rig.skin), this.sprite.frame.name);
        for (const p of this.parts) p.sprite.destroy();
        this.parts = look.parts.map(id => {
            const part = partById(id)!;
            const key = part.tint
                ? recolored(this.scene, PART_KEY(id), `${PART_KEY(id)}@${part.tint}${look[part.tint]}`, f, RAMPS[part.tint][look[part.tint]])
                : PART_KEY(id);
            return { slot: part.slot, sprite: this.scene.add.sprite(0, 0, key, 0).setOrigin(this.sprite.originX, this.sprite.originY) };
        }).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
    }

    sync(model: PlayerModel, depth: number) {
        const row = model.facing, col = model.frame;
        this.sprite.setPosition(model.x, model.y).setFrame(row * (WALK_FRAMES + 1) + col).setDepth(depth);
        const [dx, dy] = rig.offset[row][col];
        for (const { slot, sprite } of this.parts) {
            const n = SLOTS.indexOf(slot) + 1;
            // long hair hangs behind the shoulders when facing the camera, over the back when facing away
            const d = slot === 'hairBack' && !facesAway(row) ? depth - 0.01 : depth + n * 0.01;
            sprite.setPosition(model.x + dx, model.y + dy).setFrame(VIEW_OF_ROW[row]).setDepth(d);
        }
        this.nameTag.setPosition(Math.round(model.x), Math.round(model.y - 56)).setDepth(depth + 0.5);
    }
}
