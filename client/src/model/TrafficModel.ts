// Road traffic under the skytrain: cars keep their distance and stop for people on the crosswalk.
// Amount of traffic follows the time of day (rush hours busy, late night quiet). Pure logic.
import { SKYTRAIN } from '@shared/skytrain';

export type CarKind = 'taxiPink' | 'taxiGreen' | 'sedan' | 'pickup' | 'tuktuk' | 'bus';
export const CAR_SPEC: Record<CarKind, { len: number; vmax: number; weight: number }> = {
    taxiPink: { len: 1.1, vmax: 3.6, weight: 3 },
    taxiGreen: { len: 1.1, vmax: 3.6, weight: 2 },
    sedan: { len: 1.1, vmax: 3.8, weight: 3 },
    pickup: { len: 1.2, vmax: 3.4, weight: 2 },
    tuktuk: { len: 0.8, vmax: 2.8, weight: 1 },
    bus: { len: 2.4, vmax: 2.8, weight: 1 },
};
const KINDS = Object.keys(CAR_SPEC) as CarKind[];
const TOTAL_WEIGHT = KINDS.reduce((s, k) => s + CAR_SPEC[k].weight, 0);
const ROAD = SKYTRAIN.roadLength, ACCEL = 2.5, BRAKE = 6, GAP = 0.5;

export type Car = {
    id: number; kind: CarKind; lane: number; dir: 1 | -1;
    front: number;   // i of the car's front bumper
    v: number;
};

/** cars per second per lane over the in-game day */
function density(minutes: number) {
    const h = minutes / 60;
    const rush = Math.exp(-((h - 8) ** 2) / 1.5) + Math.exp(-((h - 18) ** 2) / 1.5);
    const day = h > 6 && h < 22 ? 0.35 : 0.08;
    return 0.06 + 0.25 * (day + rush * 0.6);
}

export class TrafficModel {
    cars: Car[] = [];
    private nextId = 1;

    constructor(minutes: number) {
        // start with cars already on the road
        for (let n = 0; n < 60; n++) this.update(0.5, minutes, false);
    }

    private pickKind(): CarKind {
        let r = Math.random() * TOTAL_WEIGHT;
        for (const k of KINDS) if ((r -= CAR_SPEC[k].weight) < 0) return k;
        return 'sedan';
    }

    update(dt: number, minutes: number, crosswalkBusy: boolean) {
        const rate = density(minutes);
        SKYTRAIN.lanes.forEach((lane, li) => {
            if (Math.random() >= rate * dt) return;
            const kind = this.pickKind(), len = CAR_SPEC[kind].len;
            const front = lane.dir === 1 ? -0.5 : ROAD + len - 0.5;
            const clear = this.cars.every(c => c.lane !== li || Math.abs(c.front - front) > len + 1.5);
            if (clear) this.cars.push({ id: this.nextId++, kind, lane: li, dir: lane.dir, front, v: CAR_SPEC[kind].vmax * 0.8 });
        });

        const cw = SKYTRAIN.crosswalk;
        for (const c of this.cars) {
            const spec = CAR_SPEC[c.kind];
            let limit = spec.vmax;
            // keep distance to the car ahead in the same lane
            for (const o of this.cars) {
                if (o === c || o.lane !== c.lane) continue;
                const oRear = o.front - o.dir * CAR_SPEC[o.kind].len;
                const gap = (oRear - c.front) * c.dir;
                if (gap > 0 && gap < 4) limit = Math.min(limit, Math.max(0, (gap - GAP) * 1.6));
            }
            // stop line before the crosswalk while someone is on it
            if (crosswalkBusy) {
                const stopAt = c.dir === 1 ? cw.i0 - 0.25 : cw.i1 + 0.25;
                const toStop = (stopAt - c.front) * c.dir;
                if (toStop > -0.1 && toStop < 4) limit = Math.min(limit, Math.max(0, toStop * 1.8));
            }
            c.v = c.v < limit ? Math.min(limit, c.v + ACCEL * dt) : Math.max(limit, c.v - BRAKE * dt);
            c.front += c.v * c.dir * dt;
        }
        this.cars = this.cars.filter(c => c.dir === 1 ? c.front - CAR_SPEC[c.kind].len < ROAD : c.front + CAR_SPEC[c.kind].len > -1);
    }
}
