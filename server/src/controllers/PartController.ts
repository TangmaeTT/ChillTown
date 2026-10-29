import type { IncomingMessage, ServerResponse } from 'node:http';
import { saveParts } from '../models/PartModel.ts';
import type { Part } from '../../../shared/avatar.ts';
import { json } from '../views/json.ts';
import { editorBody } from './devOnly.ts';

const MAX_BODY = 64 * 1024;

// PUT /api/parts (avatar editor) -> check, then write shared/parts.json
export function putParts(req: IncomingMessage, res: ServerResponse) {
    editorBody(req, res, MAX_BODY, 'part list', body => {
        const result = saveParts(body as Part[]);
        json(res, result.saved ? 200 : 422, result);
    });
}
