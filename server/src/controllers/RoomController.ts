import type { IncomingMessage, ServerResponse } from 'node:http';
import { listRooms, isRoomId, isWalkable } from '../models/RoomModel.ts';
import { json, notFound } from '../views/json.ts';

// GET /api/rooms -> every room with its size and where its exits lead
export function getRooms(_req: IncomingMessage, res: ServerResponse) {
    json(res, 200, listRooms());
}

// GET /api/rooms/:id/walkable?i=&j= -> can a player stand on that tile?
export function getWalkable(_req: IncomingMessage, res: ServerResponse, params: { id: string }, query: URLSearchParams) {
    if (!isRoomId(params.id)) return notFound(res, 'unknown room');
    const i = Number(query.get('i')), j = Number(query.get('j'));
    if (!Number.isInteger(i) || !Number.isInteger(j)) return json(res, 400, { error: 'i and j must be integers' });
    json(res, 200, { room: params.id, i, j, walkable: isWalkable(params.id, i, j) });
}
