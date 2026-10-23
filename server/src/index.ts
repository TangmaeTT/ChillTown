// Chill Town backend entry point.
//   models/       game state and rules (uses ../shared, the same code as the client)
//   views/        how responses are written (JSON for now; later the multiplayer state sent to clients)
//   controllers/  handle a request: read input, ask models, render a view
//   routes.ts     URL -> controller
// Multiplayer (Colyseus rooms) will be added as controllers over the same models.
import { createServer } from 'node:http';
import { dispatch } from './routes.ts';
import { notFound } from './views/json.ts';

const PORT = Number(process.env.PORT) || 2567;

createServer((req, res) => {
    try {
        if (!dispatch(req, res)) notFound(res);
    } catch (err) {
        console.error(err);
        res.writeHead(500).end();
    }
}).listen(PORT, () => console.log(`Chill Town server on http://localhost:${PORT}`));
