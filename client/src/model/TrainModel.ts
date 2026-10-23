// Skytrain service: trains run along the viaduct, slow into the station, dwell, leave.
// Positions are in tiles along i. Pure logic.
import { SKYTRAIN } from '@shared/skytrain';

// car size follows the art (assets/props/train_*.png, 224 px wide = 7 tiles of i + j): 5.7 long x 1.3 wide
export const CAR_LEN = 5.7, CAR_W = 1.3, CAR_GAP = 0.12, CARS = 3;
export const TRAIN_LEN = CARS * CAR_LEN + (CARS - 1) * CAR_GAP;
const VMAX = 7, ACCEL = 3, DWELL = 8;
const ENTER = -1, EXIT = SKYTRAIN.roadLength + 1;

export type Train = {
    id: number; track: number; dir: 1 | -1;
    tail: number;            // lowest i the train occupies (cars run tail .. tail + TRAIN_LEN)
    v: number; state: 'arriving' | 'dwell' | 'leaving'; dwell: number;
};

export class TrainModel {
    trains: Train[] = [];
    private nextId = 1;
    private timer: number;
    private nextDir: 1 | -1 = 1;

    constructor() {
        // a train already standing in the station, so the plaza never starts empty
        this.spawn(-1, 'dwell');
        this.timer = 20 + Math.random() * 20;
    }

    private spawn(dir: 1 | -1, state: Train['state'] = 'arriving') {
        const track = SKYTRAIN.tracks.findIndex(t => t.dir === dir);
        if (this.trains.some(t => t.track === track)) return;
        const stopTail = SKYTRAIN.station.stopI - TRAIN_LEN / 2;
        const tail = state === 'dwell' ? stopTail : dir === 1 ? ENTER - TRAIN_LEN : EXIT;
        this.trains.push({ id: this.nextId++, track, dir, tail, v: state === 'dwell' ? 0 : VMAX, state, dwell: state === 'dwell' ? 3 + Math.random() * 4 : 0 });
    }

    update(dt: number) {
        this.timer -= dt;
        if (this.timer <= 0) { this.spawn(this.nextDir); this.nextDir = this.nextDir === 1 ? -1 : 1; this.timer = 25 + Math.random() * 30; }

        const stopTail = SKYTRAIN.station.stopI - TRAIN_LEN / 2;
        for (const t of this.trains) {
            if (t.state === 'dwell') {
                if ((t.dwell -= dt) <= 0) t.state = 'leaving';
                continue;
            }
            if (t.state === 'arriving') {
                const dist = Math.max(0, (stopTail - t.tail) * t.dir);       // tiles left to the stop
                t.v = Math.min(VMAX, Math.sqrt(2 * ACCEL * dist), t.v + ACCEL * dt);
                if (dist < 0.02) { t.tail = stopTail; t.v = 0; t.state = 'dwell'; t.dwell = DWELL; continue; }
            } else t.v = Math.min(VMAX, t.v + ACCEL * dt);
            t.tail += t.v * t.dir * dt;
        }
        this.trains = this.trains.filter(t => t.dir === 1 ? t.tail < EXIT : t.tail + TRAIN_LEN > ENTER);
    }
}
