// Local player: position, facing, walking. Pure logic; the view reads it, the controller feeds it input.

import sheet from './player_sheet.json';

// player.png layout, written by tools/char_sheet.py together with the sheet: col 0 standing + WALK_FRAMES walk cycle
export const WALK_FRAMES: number = sheet.walkFrames;
// frame size, where the feet are in it, and how tall the character stands (px); defaults = the 68 px sheet
const s = sheet as { frame?: number; feet?: number; height?: number };
export const FRAME: number = s.frame ?? 68;
export const FEET_Y: number = s.feet ?? 60;
export const BODY_H: number = s.height ?? 52;
export const WALK_FPS: number = sheet.walkFps;
export const SPEED = 70; // world px per second

export class PlayerModel {
    facing = 2;          // 0..7 clockwise from screen east (E, SE, S, SW, W, NW, N, NE)
    walkT = 0;
    moving = false;
    vx = 0;              // screen-x speed this frame (px/s): swaying parts trail behind it
    target: { x: number; y: number } | null = null;   // click/tap destination

    constructor(public x: number, public y: number, facing?: number) {
        if (facing !== undefined) this.facing = facing;
    }

    /** move = keyboard direction (0,0 if none); keyboard beats a click target */
    update(dt: number, move: { vx: number; vy: number }, canWalk: (x: number, y: number) => boolean) {
        let { vx, vy } = move;
        if (vx || vy) this.target = null;
        else if (this.target) {
            const dx = this.target.x - this.x, dy = this.target.y - this.y;
            if (Math.hypot(dx, dy) < 2) this.target = null; else { vx = dx; vy = dy; }
        }
        const len = Math.hypot(vx, vy);
        this.moving = len > 0;
        if (!this.moving) { this.walkT = 0; this.vx = 0; return; }

        const x0 = this.x;
        const mx = (vx / len) * SPEED * dt, my = (vy / len) * SPEED * dt;
        // slide along walls instead of stopping dead
        if (canWalk(this.x + mx, this.y + my)) { this.x += mx; this.y += my; }
        else if (canWalk(this.x + mx, this.y)) this.x += mx;
        else if (canWalk(this.x, this.y + my)) this.y += my;
        else this.target = null;
        this.facing = (Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8;
        this.walkT += dt;
        this.vx = (this.x - x0) / dt;
    }

    /** 0 = standing, 1..WALK_FRAMES = walk cycle */
    get frame() {
        return this.moving ? 1 + (Math.floor(this.walkT * WALK_FPS) % WALK_FRAMES) : 0;
    }
}
