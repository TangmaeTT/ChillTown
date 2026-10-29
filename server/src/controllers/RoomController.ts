import type { IncomingMessage, ServerResponse } from 'node:http';
import { listRooms, getRoom, isRoomId, isWalkable, saveRoom } from '../models/RoomModel.ts';
import type { Room } from '../../../shared/rooms.ts';
import { json, notFound } from '../views/json.ts';
import { editorBody } from './devOnly.ts';

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
    if (!isRoomId(params.id)) return notFound(res, 'unknown room');
    editorBody(req, res, MAX_BODY, 'room', body => {
        const result = saveRoom(params.id as Room['id'], body as Room);
        json(res, result.saved ? 200 : 422, result);
    });
}
