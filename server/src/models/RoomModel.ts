// Room layouts and walkability. Read from shared/rooms/*.json (the same files the client bundles),
// re-read after the map editor saves, so the server never serves a stale layout.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROOM_IDS, formatRoom, type Room, type RoomId } from '../../../shared/rooms.ts';
import { buildBlocked } from '../../../shared/collision.ts';
import { validateRoom, incomingSpawns, type Problem } from '../../../shared/validate.ts';

const DIR = fileURLToPath(new URL('../../../shared/rooms/', import.meta.url));
const rooms = new Map<RoomId, Room>();
const blocked = new Map<RoomId, Set<string>>();

function load(id: RoomId) {
    const room = JSON.parse(readFileSync(DIR + id + '.json', 'utf8')) as Room;
    rooms.set(id, room);
    blocked.set(id, buildBlocked(room));
}
ROOM_IDS.forEach(load);

export function isRoomId(id: string): id is RoomId {
    return (ROOM_IDS as readonly string[]).includes(id);
}

export function getRoom(id: RoomId) { return rooms.get(id)!; }

export function listRooms() {
    return ROOM_IDS.map(id => {
        const r = rooms.get(id)!;
        return { id, name: r.name, w: r.w, h: r.h, exits: r.exits.filter(e => e.to).map(e => e.to) };
    });
}

export function isWalkable(id: RoomId, i: number, j: number) {
    const r = rooms.get(id)!;
    return i >= 0 && j >= 0 && i < r.w && j < r.h && !blocked.get(id)!.has(`${i},${j}`);
}

/** Validate and write a room. Nothing is written if there are errors. */
export function saveRoom(id: RoomId, room: Room): { saved: boolean; problems: Problem[] } {
    room.id = id;
    const others = ROOM_IDS.filter(r => r !== id).map(r => rooms.get(r)!);
    const problems = validateRoom(room, incomingSpawns([...others, room], id));
    if (problems.some(p => p.level === 'error')) return { saved: false, problems };
    // write to a temp file first so a crash can't leave half a room on disk
    const tmp = DIR + id + '.json.tmp';
    writeFileSync(tmp, formatRoom(room));
    renameSync(tmp, DIR + id + '.json');
    load(id);
    return { saved: true, problems };
}
