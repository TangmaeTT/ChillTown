import { Scene, GameObjects, Math as PMath } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import type { TrainLine } from '@shared/skytrain';
import { CARS, MID_LEN, CAR_W, TRAIN_LAYOUT, type TrainModel } from '../model/TrainModel';
import type { LightingView } from './LightingView';

// Skytrain cars from ChatGPT art (assets/props/train_{head,mid,tail}_{day,night,glow}.png, made with
// tools/prep_asset.py and lined up by tools/train_align.py). Used on the plaza viaduct and in the platform room.
type CarKind = 'head' | 'mid' | 'tail';
// one car = day sprite, night sprite cross-faded on top of it, and the additive glow of its lit windows
type CarSprites = { kind: CarKind; day: GameObjects.Image; night: GameObjects.Image; glow: GameObjects.Image };

export type TrainCarsOptions = {
    /** fixed depth band (elevated viaduct, above everything on the ground); omit to depth-sort with people */
    depth?: number;
    /** span of i under a roof: lit windows there must not shine through it */
    roof?: { i0: number; i1: number };
    /** draw rails on the ground (the platform room; the viaduct draws its own) */
    rails?: boolean;
};

export class TrainCarsView {
    private trains = new Map<number, CarSprites[]>();

    constructor(private scene: Scene, private grid: IsoGrid, private lighting: LightingView, private line: TrainLine, private opts: TrainCarsOptions = {}) {
        if (opts.rails) {
            const g = scene.add.graphics().setDepth(-9800);
            for (const t of line.tracks) for (const side of [-0.42, 0.42]) {
                const a = grid.toWorld(-0.5, t.j + side), b = grid.toWorld(line.length - 0.5, t.j + side);
                g.lineStyle(2, 0x2a2c2e, 1).lineBetween(a.x, a.y + 1, b.x, b.y + 1);   // rail shadow
                g.lineStyle(1, 0xb8bcc0, 1).lineBetween(a.x, a.y, b.x, b.y);           // rail head
            }
        }
    }

    private car(kind: CarKind): CarSprites {
        const add = (v: string) => this.scene.add.image(0, 0, `train_${kind}_${v}`).setOrigin(0, 0);
        return { kind, day: add('day'), night: add('night'), glow: add('glow').setBlendMode('ADD').setDepth(50002) };
    }

    update(model: TrainModel) {
        const seen = new Set<number>(), night = this.lighting.current.lights, roof = this.opts.roof;
        for (const t of model.trains) {
            seen.add(t.id);
            let cars = this.trains.get(t.id);
            if (!cars) {
                // the car at the highest i shows its +i end: headlights when moving +i, tail lights when moving -i;
                // the others show a gangway there
                cars = Array.from({ length: CARS }, (_, k) => this.car(k === CARS - 1 ? (t.dir === 1 ? 'head' : 'tail') : 'mid'));
                this.trains.set(t.id, cars);
            }
            const track = this.line.tracks[t.track];
            // first car: centred on the rails; every next car: its roof edge starts where the previous one ends
            const first = TRAIN_LAYOUT[cars[0].kind], c0 = this.grid.toWorld(t.tail + MID_LEN / 2, track.j);
            let x = c0.x - first.w / 2, y = c0.y - this.line.z - (first.h - first.w / 4);
            cars.forEach((car, k) => {
                const L = TRAIN_LAYOUT[car.kind];
                if (k > 0) {
                    const P = TRAIN_LAYOUT[cars![k - 1].kind];
                    x += P.front[0] - L.rear[0]; y += P.front[1] - L.rear[1];
                }
                const i = t.tail + k * MID_LEN, len = (L.front[0] - L.rear[0]) / 32;
                const depth = this.opts.depth !== undefined
                    ? this.opts.depth + i * 0.001
                    : this.grid.toWorld(i + len, track.j + CAR_W / 2).y;        // near-front corner, like any ground object
                // fade in/out at the ends of the line instead of popping
                const a = PMath.Clamp(Math.min(i + 0.5, this.line.length - 0.5 - (i + len)) / 1.5 + 1, 0, 1);
                const rx = Math.round(x), ry = Math.round(y);
                car.day.setPosition(rx, ry).setDepth(depth).setAlpha(a);
                car.night.setPosition(rx, ry).setDepth(depth + 0.0001).setAlpha(a * night);
                // glow layers sit above everything, so a car under a roof must not shine through it
                const underRoof = roof && i + len > roof.i0 && i < roof.i1;
                car.glow.setPosition(rx, ry).setAlpha(underRoof ? 0 : a * night);
            });
        }
        for (const [id, cars] of this.trains) if (!seen.has(id)) {
            cars.forEach(c => { c.day.destroy(); c.night.destroy(); c.glow.destroy(); });
            this.trains.delete(id);
        }
    }
}
