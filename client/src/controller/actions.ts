// Things the player can ask for from the HUD. Views call these; these change the model.
import type { Scene } from 'phaser';
import { world } from '../model/WorldModel';

export function toggleRain() { world.raining = !world.raining; }

/** testing aid: 60x = a full in-game day in 2 real minutes */
export function toggleFastForward() { world.speed = world.speed === 1 ? 60 : 1; }

/** HUD buttons: one whole zoom step in (+1) or out (-1) */
export function zoom(step: number) { world.zoom = Math.min(3, Math.max(1, Math.round(world.zoom) + step)); }

export function toggleFullscreen(scene: Scene) {
    if (scene.scale.isFullscreen) { scene.scale.stopFullscreen(); return; }
    scene.scale.startFullscreen();
    // phones: try to hold landscape while full screen (not supported everywhere, so ignore failures)
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.('landscape').catch(() => {});
}
