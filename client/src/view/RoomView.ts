import { Scene } from 'phaser';
import type { RoomModel } from '../model/RoomModel';
import { drawGround, drawBox, drawExit, corners } from './art/blockout';
import { drawArt } from './art/props';
import type { LightingView } from './LightingView';
import type { Occluders } from './Occluders';

// Draws a room from its model: ground, buildings (grey boxes or real art), exits, street lamps.
export class RoomView {
    constructor(scene: Scene, model: RoomModel, lights: LightingView, occluders: Occluders) {
        const { room, grid } = model;
        drawGround(scene, grid, room);

        for (const b of room.boxes) {
            const d = b.art ? drawArt(scene, grid, b, lights) : drawBox(scene, grid, b);
            if (b.elevated) { occluders.addRoof(d, b); continue; }
            occluders.addSolid(d, b);
            if (b.glow) { // warm spill from an open shop front + upstairs window
                const c = corners(grid, b).S;
                lights.addLight('glowShop', c.x - 70, c.y - 10, 0.9);
                lights.addLight('haloWarm', c.x - 120, c.y - 205, 0.8, 1.6);
            }
        }
        for (const e of room.exits) drawExit(scene, grid, e);

        for (const l of room.lamps) {
            const p = grid.toWorld(l.i, l.j);
            scene.add.image(p.x, p.y + 4, 'lamp').setOrigin(0.5, 1).setDepth(p.y + 4);
            lights.addLight('glowWarm', p.x, p.y + 4, 1.0);
            lights.addLight('haloWarm', p.x, p.y - 72, 1.0);
        }
    }
}
