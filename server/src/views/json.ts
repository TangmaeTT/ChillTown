// Response views: how data leaves the server. Controllers never write to the response directly.
import type { ServerResponse } from 'node:http';

export function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',   // the Vite dev client runs on another port
    });
    res.end(JSON.stringify(body));
}

export function notFound(res: ServerResponse, what = 'not found') {
    json(res, 404, { error: what });
}
