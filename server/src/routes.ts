// URL -> controller. Add new endpoints here.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getTime } from './controllers/TimeController.ts';
import { getRooms, getRoomLayout, getWalkable, putRoom } from './controllers/RoomController.ts';

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, query: URLSearchParams) => void;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, pattern, keys, handler });
}

route('GET', '/api/health', (_q, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
route('GET', '/api/time', getTime);
route('GET', '/api/rooms', getRooms);
route('GET', '/api/rooms/:id', getRoomLayout);
route('GET', '/api/rooms/:id/walkable', getWalkable);
route('PUT', '/api/rooms/:id', putRoom);   // map editor (dev only)

/** Find the handler for a request; false if nothing matched. */
export function dispatch(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url ?? '/', 'http://localhost');
    for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.pattern);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, n) => [k, decodeURIComponent(m[n + 1])]));
        r.handler(req, res, params, url.searchParams);
        return true;
    }
    return false;
}
