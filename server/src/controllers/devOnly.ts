// Guards for the editors' save endpoints (map editor, avatar editor): only while developing, only from this PC.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../views/json.ts';

export const EDITOR_ENABLED = process.env.NODE_ENV !== 'production' && process.env.CHILLTOWN_EDITOR !== '0';

const LOCAL = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/** Only this machine: the direct peer, and (through the Vite proxy) the original sender, must be local. */
export function isLocal(req: IncomingMessage) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    return LOCAL.includes(req.socket.remoteAddress ?? '') && forwarded.every(a => LOCAL.includes(a));
}

/** Check the guards, read a JSON body of at most `max` bytes and hand it on; answers the request itself on failure. */
export function editorBody(req: IncomingMessage, res: ServerResponse, max: number, what: string, then: (body: unknown) => void) {
    if (!EDITOR_ENABLED) return json(res, 403, { error: 'editors are disabled on this server' });
    if (!isLocal(req)) return json(res, 403, { error: 'editors only accept requests from this machine' });
    let body = '', tooBig = false;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { body += chunk; if (body.length > max) { tooBig = true; req.destroy(); } });
    req.on('end', () => {
        if (tooBig) return json(res, 413, { error: `${what} too large` });
        let data: unknown;
        try { data = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid JSON' }); }
        then(data);
    });
}
