import { Scene, GameObjects } from 'phaser';
import { WALK_FRAMES, type PlayerModel } from '../model/PlayerModel';

// player.png (PixelLab): 68x68 frames, col 0 = standing, cols 1-8 = walk cycle;
// rows clockwise from screen angle: E, SE, S, SW, W, NW, N, NE
export const PLAYER_SHEET = { key: 'player', file: 'player.png', frame: 68 };
const FEET_Y = 60;

export class PlayerView {
    private sprite: GameObjects.Sprite;
    private nameTag: GameObjects.Text;

    constructor(scene: Scene, model: PlayerModel, name: string) {
        this.sprite = scene.add.sprite(model.x, model.y, PLAYER_SHEET.key, 0).setOrigin(0.5, FEET_Y / PLAYER_SHEET.frame);
        this.nameTag = scene.add.text(model.x, model.y - 56, name, {
            fontFamily: 'Tahoma, sans-serif', fontSize: '8px', color: '#e8f0c8', resolution: 4,
            stroke: '#0e1014', strokeThickness: 2,
        }).setOrigin(0.5, 1);
    }

    get gameObject() { return this.sprite; }

    setVisible(on: boolean) { this.sprite.setVisible(on); this.nameTag.setVisible(on); }

    sync(model: PlayerModel, depth: number) {
        this.sprite.setPosition(model.x, model.y).setFrame(model.facing * (WALK_FRAMES + 1) + model.frame).setDepth(depth);
        this.nameTag.setPosition(Math.round(model.x), Math.round(model.y - 56)).setDepth(depth + 0.5);
    }
}
