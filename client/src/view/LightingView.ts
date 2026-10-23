import { Scene, GameObjects, BlendModes } from 'phaser';
import { lighting, type Light } from './lighting';

// Applies the time-of-day look: a multiply overlay for ambient colour, additive lights (lamps, shop spill)
// and glow layers (lit windows, signs) that fade in with `lights`, and daylight shadows that fade with `sun`.
export class LightingView {
    private overlay: GameObjects.Rectangle;
    private lights: { img: GameObjects.Image; base: number; phase: number }[] = [];
    private glows: { glow: GameObjects.Image; owner: GameObjects.Image | null }[] = [];
    private shadows: { obj: { setAlpha(a: number): unknown }; base: number }[] = [];
    current: Light = lighting();

    constructor(private scene: Scene) {
        this.overlay = scene.add.rectangle(0, 0, 4000, 4000, 0xffffff).setScrollFactor(0).setDepth(50000)
            .setBlendMode(BlendModes.MULTIPLY);
    }

    /** A flickering light pool / halo (ADD blend, above the overlay so the dark doesn't eat it). */
    addLight(key: string, x: number, y: number, base: number, scale = 1) {
        const img = this.scene.add.image(x, y, key).setBlendMode(BlendModes.ADD).setDepth(50001).setScale(scale);
        this.lights.push({ img, base, phase: Math.random() * 10 });
        return img;
    }

    /** A glow layer made with its sprite (see art/pixelart.ts); alpha follows `lights` x the owner's alpha
     *  (so a building that turns see-through takes its lit windows with it). */
    addGlow(glow: GameObjects.Image, owner: GameObjects.Image | null = null) { this.glows.push({ glow, owner }); }

    /** A daylight shadow; alpha = base * sun. */
    addShadow(obj: { setAlpha(a: number): unknown }, base: number) { this.shadows.push({ obj, base }); }

    update(time: number) {
        const L = this.current = lighting();
        this.overlay.setFillStyle((L.ambient[0] << 16) | (L.ambient[1] << 8) | L.ambient[2]);
        this.scene.cameras.main.setBackgroundColor((L.sky[0] << 16) | (L.sky[1] << 8) | L.sky[2]);
        for (const l of this.lights) {
            const flicker = 0.92 + 0.08 * Math.sin(time / 90 + l.phase) * Math.sin(time / 37 + l.phase * 2);
            l.img.setAlpha(Math.min(1, L.lights * 1.2) * l.base * flicker);
        }
        for (const g of this.glows) g.glow.setAlpha(L.lights * (g.owner ? g.owner.alpha : 1));
        for (const s of this.shadows) s.obj.setAlpha(s.base * L.sun);
    }
}
