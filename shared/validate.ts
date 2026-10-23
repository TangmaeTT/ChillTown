// Checks a room before it's saved (map editor) or loaded (server). Errors block saving; warnings don't.
import { ROOM_IDS, GROUND_OF, type Room } from './rooms.ts';
import { buildBlocked } from './collision.ts';

export type Problem = { level: 'error' | 'warning'; message: string; at?: { i: number; j: number } };

const inRect = (r: { i0: number; j0: number; i1: number; j1: number }, i: number, j: number) =>
    i >= r.i0 && i <= r.i1 && j >= r.j0 && j <= r.j1;

/** Tiles reachable on foot from (si, sj). */
export function reachable(room: Room, blocked: Set<string>, si: number, sj: number) {
    const seen = new Set<string>();
    if (blocked.has(`${si},${sj}`)) return seen;
    const q: [number, number][] = [[si, sj]];
    seen.add(`${si},${sj}`);
    while (q.length) {
        const [i, j] = q.shift()!;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj, k = `${ni},${nj}`;
            if (ni < 0 || nj < 0 || ni >= room.w || nj >= room.h || seen.has(k) || blocked.has(k)) continue;
            seen.add(k); q.push([ni, nj]);
        }
    }
    return seen;
}

/** `incoming` = spawn points other rooms' exits use to arrive here. */
export function validateRoom(room: Room, incoming: { from: string; i: number; j: number }[] = []): Problem[] {
    const out: Problem[] = [];
    const err = (message: string, at?: { i: number; j: number }) => out.push({ level: 'error', message, at });
    const warn = (message: string, at?: { i: number; j: number }) => out.push({ level: 'warning', message, at });

    // shape
    if (!ROOM_IDS.includes(room.id)) err(`ไม่รู้จักห้อง "${room.id}"`);
    if (!(room.w >= 4 && room.w <= 64 && room.h >= 4 && room.h <= 64)) err('ขนาดห้องต้องอยู่ระหว่าง 4–64 ช่อง');
    if (room.ground.length !== room.h || room.ground.some(row => row.length !== room.w)) err('กริดพื้นไม่ตรงกับขนาดห้อง');
    else if (room.ground.some(row => [...row].some(c => !(c in GROUND_OF)))) err('มีชนิดพื้นที่ไม่รู้จัก');
    if (out.length) return out;

    const blocked = buildBlocked(room);
    const walk = reachable(room, blocked, room.spawn.i, room.spawn.j);
    if (!walk.size) err('จุดเกิดหลักยืนไม่ได้ (ทับตึก ถนน น้ำ หรือไฟถนน)', room.spawn);

    for (const e of room.exits) {
        if (e.to && !ROOM_IDS.includes(e.to)) err(`ทางออก "${e.label}" ไปห้องที่ไม่มีอยู่`, { i: e.i0, j: e.j0 });
        let ok = false;
        for (let i = e.i0; i <= e.i1; i++) for (let j = e.j0; j <= e.j1; j++) if (walk.has(`${i},${j}`)) ok = true;
        if (e.to && !ok) err(`เดินไปถึงทางออก "${e.label}" ไม่ได้`, { i: e.i0, j: e.j0 });
    }
    for (const s of incoming) {
        if (blocked.has(`${s.i},${s.j}`)) err(`จุดที่มาจากห้อง ${s.from} ยืนไม่ได้`, s);
        else if (!walk.has(`${s.i},${s.j}`)) warn(`จุดที่มาจากห้อง ${s.from} เดินไปจุดเกิดหลักไม่ได้`, s);
        else if (room.exits.some(e => e.to && inRect(e, s.i, s.j))) err(`จุดที่มาจากห้อง ${s.from} ทับทางออก (จะเด้งกลับทันที)`, s);
    }

    // shop fronts must face a visible side and open onto somewhere you can walk
    for (const b of room.boxes) {
        if (!b.front || b.elevated) continue;
        const name = b.label ?? 'ร้าน';
        let open = false;
        if (b.front === 'left') for (let i = b.i0; i <= b.i1; i++) open ||= walk.has(`${i},${b.j1 + 1}`);
        else for (let j = b.j0; j <= b.j1; j++) open ||= walk.has(`${b.i1 + 1},${j}`);
        if (!open) warn(`หน้าร้าน "${name}" ติดกำแพง/เดินไปไม่ถึง`, { i: b.i0, j: b.j0 });
    }
    // boxes overlapping each other
    const solid = room.boxes.filter(b => !b.elevated);
    for (let a = 0; a < solid.length; a++) for (let c = a + 1; c < solid.length; c++) {
        const A = solid[a], C = solid[c];
        if (A.i0 <= C.i1 && C.i0 <= A.i1 && A.j0 <= C.j1 && C.j0 <= A.j1)
            warn(`"${A.label ?? A.art ?? 'กล่อง'}" ทับกับ "${C.label ?? C.art ?? 'กล่อง'}"`, { i: C.i0, j: C.j0 });
    }
    return out;
}

/** Spawn points that other rooms send players to in `room`. */
export function incomingSpawns(rooms: Room[], id: string) {
    return rooms.flatMap(r => r.exits.filter(e => e.to === id && e.spawn).map(e => ({ from: r.id, i: e.spawn!.i, j: e.spawn!.j })));
}
