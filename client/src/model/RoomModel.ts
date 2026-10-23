// The room the player is in: layout, grid math, what's walkable, where the exits lead.
import { ROOMS, type Room, type RoomId } from '@shared/rooms';
import { IsoGrid } from '@shared/iso';
import { buildBlocked, exitAt } from '@shared/collision';

export class RoomModel {
    readonly room: Room;
    readonly grid: IsoGrid;
    readonly blocked: Set<string>;

    constructor(room: Room) {
        this.room = room;
        this.grid = new IsoGrid(this.room.w, this.room.h);
        this.blocked = buildBlocked(this.room);
    }

    tileAt(x: number, y: number) {
        const t = this.grid.toTile(x, y);
        return { i: Math.round(t.i), j: Math.round(t.j), fi: t.i, fj: t.j };
    }

    walkable(x: number, y: number) {
        const t = this.tileAt(x, y);
        return this.grid.inside(t.fi, t.fj) && !this.blocked.has(`${t.i},${t.j}`);
    }

    exitAt(x: number, y: number) {
        const t = this.tileAt(x, y);
        return exitAt(this.room, t.i, t.j);
    }
}

/** ?room=soi in the URL jumps straight to a room (testing) */
export function roomFromUrl(): RoomId {
    const r = new URLSearchParams(location.search).get('room');
    return r && r in ROOMS ? (r as RoomId) : 'plaza';
}
