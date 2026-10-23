import { Scene, Input, Math as PMath } from 'phaser';
import { zoomBy } from '../model/WorldModel';
import type { PlayerModel } from '../model/PlayerModel';

// Turns keyboard / mouse / touch into intents: a move direction, a walk target, zoom changes.
export class InputController {
    private keys: Record<string, Input.Keyboard.Key>;
    private pinchDist = 0;

    constructor(private scene: Scene, private player: PlayerModel) {
        const input = scene.input;
        this.keys = input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Input.Keyboard.Key>;

        // zoom: mouse wheel, +/- keys, two-finger pinch (HUD buttons go through controller/actions)
        input.on('wheel', (_p: Input.Pointer, _o: unknown, _dx: number, dy: number) => zoomBy(dy > 0 ? 0.9 : 1.1));
        input.keyboard!.on('keydown', (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') zoomBy(1.15);
            if (e.key === '-' || e.key === '_') zoomBy(1 / 1.15);
        });
        input.addPointer(1);

        // click / tap to walk
        input.on('pointerdown', (p: Input.Pointer) => {
            if (input.pointer2.isDown) { player.target = null; return; } // second finger = pinch, not walk
            if (this.overHud(p)) return;
            player.target = { x: p.worldX, y: p.worldY };
        });
    }

    private overHud(p: Input.Pointer) {
        const { width: W, height: H } = this.scene.scale;
        return (p.x < 320 && p.y < 100) || (p.x > W - 120 && p.y > H - 70);
    }

    /** keyboard direction in screen space; (0,0) when no key is held */
    moveVector(enabled: boolean) {
        if (!enabled) return { vx: 0, vy: 0 };
        const k = this.keys;
        return {
            vx: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
            vy: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
        };
    }

    /** two-finger pinch zoom; call every frame */
    update() {
        const a = this.scene.input.pointer1, b = this.scene.input.pointer2;
        if (a.isDown && b.isDown) {
            const d = PMath.Distance.Between(a.x, a.y, b.x, b.y);
            if (this.pinchDist > 0) zoomBy(d / this.pinchDist);
            this.pinchDist = d;
            this.player.target = null;
        } else this.pinchDist = 0;
    }
}
