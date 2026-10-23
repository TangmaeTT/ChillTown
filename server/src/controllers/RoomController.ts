import type { IncomingMessage, ServerResponse } from 'node:http';
import { listRooms, getRoom, isRoomId, isWalkable, saveRoom } from '../models/RoomModel.ts';
import type { Room } from '../../../shared/rooms.ts';
import { json, notFound } from '../views/json.ts';

// The map editor can only save while developing (never on a public server).
const EDITOR_ENABLED = process.env.NODE_ENV !== 'production' && process.env.CHILLTOWN_EDITOR !== '0';
const MAX_BODY = 512 * 1024;

// GET /api/rooms -> every room with its size and where its exits lead
export function getRooms(_req: IncomingMessage, res: ServerResponse) {
    json(res, 200, listRooms());
}

// GET /api/rooms/:id -> the full layout
export function getRoomLayout(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
    if (!isRoomId(params.id)) return notFound(res, 'unknown room');
    json(res, 200, getRoom(params.id));
}

// GET /api/rooms/:id/walkable?i=&j= -> can a player stand on that tile?
export function getWalkable(_req: IncomingMessage, res: ServerResponse, params: Record<string, string>, query: URLSearchParams) {
    if (!isRoomId(params.id)) return notFound(res, 'unknown room');
    const i = Number(query.get('i')), j = Number(query.get('j'));
    if (!Number.isInteger(i) || !Number.isInteger(j)) return json(res, 400, { error: 'i and j must be integers' });
    json(res, 200, { room: params.id, i, j, walkable: isWalkable(params.id, i, j) });
}

// PUT /api/rooms/:id (map editor) -> validate, then write shared/rooms/<id>.json
export function putRoom(req: IncomingMessage, res: ServerResponse, params: Record<string, string>) {
    if (!EDITOR_ENABLED) return json(res, 403, { error: 'map editor is disabled on this server' });
    if (!isLocal(req)) return json(res, 403, { error: 'map editor only accepts requests from this machine' });
    if (!isRoomId(params.id)) return notFound(res, 'unknown room');
    let body = '', tooBig = false;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { body += chunk; if (body.length > MAX_BODY) { tooBig = true; req.destroy(); } });
    req.on('end', () => {
        if (tooBig) return json(res, 413, { error: 'room too large' });
        let room: Room;
        try { room = JSON.parse(body) as Room; } catch { return json(res, 400, { error: 'invalid JSON' }); }
        const result = saveRoom(params.id as Room['id'], room);
        json(res, result.saved ? 200 : 422, result);
    });
}

const LOCAL = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/** Only this machine: the direct peer, and (through the Vite proxy) the original sender, must be local. */
function isLocal(req: IncomingMessage) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    return LOCAL.includes(req.socket.remoteAddress ?? '') && forwarded.every(a => LOCAL.includes(a));
}
