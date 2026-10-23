// Walkability and exits for a room. The client uses it to move the player; the server will use the
// same rules to reject impossible moves.
import { BLOCKING_GROUND, type Ground, type Room, type Exit } from './rooms.ts';
import { skytrainSolids } from './skytrain.ts';

const inRect = (r: { i0: number; j0: number; i1: number; j1: number }, i: number, j: number) =>
    i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;

export function groundAt(room: Room, i: number, j: number): Ground {
    let g = room.base;
    for (const a of room.areas) if (inRect(a, i, j)) g = a.g;
    return g;
}

/** Set of "i,j" tile keys nobody can stand on. */
export function buildBlocked(room: Room): Set<string> {
    const blocked = new Set<string>();
    const add = (r: { i0: number; j0: number; i1: number; j1: number }) => {
        for (let i = Math.ceil(r.i0); i <= Math.floor(r.i1); i++) for (let j = Math.ceil(r.j0); j <= Math.floor(r.j1); j++) blocked.add(`${i},${j}`);
    };
    for (let i = 0; i < room.w; i++) for (let j = 0; j < room.h; j++)
        if (BLOCKING_GROUND.includes(groundAt(room, i, j))) blocked.add(`${i},${j}`);
    for (const b of room.boxes) if (!b.elevated) add(b);
    for (const l of room.lamps) blocked.add(`${l.i},${l.j}`);
    if (room.scenery === 'skytrain') skytrainSolids().forEach(add);
    return blocked;
}

/** The live exit (one that leads somewhere) covering tile (i,j), if any. */
export function exitAt(room: Room, i: number, j: number): Exit | undefined {
    return room.exits.find(e => e.to && inRect(e, i, j));
}
