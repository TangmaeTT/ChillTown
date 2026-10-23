import { Scene, GameObjects } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import { WALK_FRAMES, WALK_FPS } from '../model/PlayerModel';
import type { NpcModel } from '../model/NpcModel';
import { PLAYER_SHEET } from './PlayerView';

// Placeholder pedestrians: the player sheet with different tints, until NPC characters are made in PixelLab.
export const NPC_TINTS = [0xffffff, 0xaec4ff, 0xffd2a6, 0xbfe8bf, 0xffb8cc, 0xd2d2d2, 0xe8d8ff];
const FEET_Y = 60;

export class NpcView {
    private sprites = new Map<number, GameObjects.Sprite>();

    constructor(private scene: Scene, private grid: IsoGrid) {}

    update(model: NpcModel) {
        const seen = new Set<number>();
        for (const n of model.npcs) {
            seen.add(n.id);
            let s = this.sprites.get(n.id);
            if (!s) {
                s = this.scene.add.sprite(0, 0, PLAYER_SHEET.key, 0).setOrigin(0.5, FEET_Y / PLAYER_SHEET.frame).setTint(NPC_TINTS[n.look]);
                this.sprites.set(n.id, s);
            }
            const p = this.grid.toWorld(n.i, n.j);
            const frame = n.walkT > 0 ? 1 + (Math.floor(n.walkT * WALK_FPS) % WALK_FRAMES) : 0;
            s.setPosition(Math.round(p.x), Math.round(p.y)).setFrame(n.facing * (WALK_FRAMES + 1) + frame).setDepth(p.y);
            // fade at the map edge instead of popping in
            s.setAlpha(Math.min(1, (n.i + 0.6) / 0.8, (this.grid.w - 0.4 - n.i) / 0.8, (n.j + 0.6) / 0.8, (this.grid.h - 0.4 - n.j) / 0.8));
        }
        for (const [id, s] of this.sprites) if (!seen.has(id)) { s.destroy(); this.sprites.delete(id); }
    }
}
