// Ambient pedestrians: walk set routes through the room (sidewalks, the crosswalk, across the plaza),
// appearing at one edge and leaving at another. How many depends on the time of day. Pure logic.
// Positions are in tiles (i, j); routes are hand-checked to avoid buildings.

export type Npc = {
    id: number; look: number;
    route: number; leg: number;          // walking from route[leg] to route[leg + 1]
    i: number; j: number;
    facing: number; walkT: number; speed: number;
    pause: number;                       // seconds left standing still (looking at the clock, waiting…)
};

type P = [number, number];

/** people per second entering the room over the in-game day */
function rate(minutes: number) {
    const h = minutes / 60;
    const rush = Math.exp(-((h - 8) ** 2) / 1.2) + Math.exp(-((h - 18) ** 2) / 1.5);
    const awake = h > 6 && h < 23 ? 0.25 : 0.04;
    return 0.04 + 0.22 * (awake + rush * 0.7);
}

export class NpcModel {
    npcs: Npc[] = [];
    private nextId = 1;

    constructor(private routes: P[][], minutes: number, private looks: number) {
        for (let n = 0; n < 50; n++) this.update(0.5, minutes);   // start with people already walking
    }

    update(dt: number, minutes: number) {
        if (Math.random() < rate(minutes) * dt) {
            const route = Math.floor(Math.random() * this.routes.length);
            const [i, j] = this.routes[route][0];
            this.npcs.push({
                id: this.nextId++, look: Math.floor(Math.random() * this.looks), route, leg: 0, i, j,
                facing: 2, walkT: 0, speed: 1.3 + Math.random() * 0.6, pause: 0,
            });
        }
        for (const n of this.npcs) {
            if (n.pause > 0) { n.pause -= dt; n.walkT = 0; continue; }
            const r = this.routes[n.route], [ti, tj] = r[n.leg + 1];
            const di = ti - n.i, dj = tj - n.j, d = Math.hypot(di, dj), step = n.speed * dt;
            if (d <= step) {
                n.i = ti; n.j = tj; n.leg++;
                if (Math.random() < 0.15) n.pause = 1 + Math.random() * 3;   // stop for a moment now and then
            } else { n.i += (di / d) * step; n.j += (dj / d) * step; }
            // facing from the screen-space direction (i goes down-right, j goes down-left)
            const sx = di - dj, sy = (di + dj) / 2;
            n.facing = (Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) + 8) % 8;
            n.walkT += dt;
        }
        this.npcs = this.npcs.filter(n => n.leg < this.routes[n.route].length - 1);
    }

    /** anyone inside the rectangle (tile coords)? */
    anyIn(i0: number, i1: number, j0: number, j1: number) {
        return this.npcs.some(n => n.i > i0 && n.i < i1 && n.j > j0 && n.j < j1);
    }
}
