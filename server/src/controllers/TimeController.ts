import type { IncomingMessage, ServerResponse } from 'node:http';
import { currentTime } from '../models/ClockModel.ts';
import { json } from '../views/json.ts';

// GET /api/time -> the authoritative game clock
export function getTime(_req: IncomingMessage, res: ServerResponse) {
    json(res, 200, currentTime());
}
