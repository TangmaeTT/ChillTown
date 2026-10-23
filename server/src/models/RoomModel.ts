// Room layouts and walkability, from the same shared data the client draws.
// Later the multiplayer rooms will use isWalkable to reject impossible moves.
import { ROOMS, type RoomId } from '../../../shared/rooms.ts';
import { buildBlocked } from '../../../shared/collision.ts';

const blocked = new Map<RoomId, Set<string>>();
for (const id of Object.keys(ROOMS) as RoomId[]) blocked.set(id, buildBlocked(ROOMS[id]));

export function isRoomId(id: string): id is RoomId {
    return id in ROOMS;
}

export function listRooms() {
    return (Object.keys(ROOMS) as RoomId[]).map(id => {
        const r = ROOMS[id];
        return { id, name: r.name, w: r.w, h: r.h, exits: r.exits.filter(e => e.to).map(e => e.to) };
    });
}

export function isWalkable(id: RoomId, i: number, j: number) {
    const r = ROOMS[id];
    return i >= 0 && j >= 0 && i < r.w && j < r.h && !blocked.get(id)!.has(`${i},${j}`);
}
