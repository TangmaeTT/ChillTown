import { Scene, GameObjects } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import { SKYTRAIN } from '@shared/skytrain';
import { CAR_SPEC, type CarKind, type TrafficModel, type Car } from '../model/TrafficModel';
import { prismTexture, prismXY, carPart, type PrismTex } from './art/pixelart';
import type { LightingView } from './LightingView';

// Bangkok traffic drawn as small pixel-art prisms: body + cabin, lights that come on at dusk.
type Look = { body: number; cabin: number; w: number; bodyH: number; cabinH: number; cabinLen: number; cabinAt: number };
const LOOK: Record<CarKind, Look> = {
    taxiPink: { body: 0xd9668f, cabin: 0xd9668f, w: 0.55, bodyH: 8, cabinH: 7, cabinLen: 0.55, cabinAt: 0.25 },
    taxiGreen: { body: 0x5e9e4a, cabin: 0xd8c645, w: 0.55, bodyH: 8, cabinH: 7, cabinLen: 0.55, cabinAt: 0.25 },
    sedan: { body: 0xcfd0c8, cabin: 0xcfd0c8, w: 0.55, bodyH: 8, cabinH: 7, cabinLen: 0.55, cabinAt: 0.25 },
    pickup: { body: 0x7d848b, cabin: 0x7d848b, w: 0.56, bodyH: 9, cabinH: 7, cabinLen: 0.45, cabinAt: 0.6 },
    tuktuk: { body: 0x2f5f9a, cabin: 0x22303e, w: 0.5, bodyH: 7, cabinH: 9, cabinLen: 0.55, cabinAt: 0.2 },
    bus: { body: 0x3e6fa8, cabin: 0xd8d8cc, w: 0.62, bodyH: 7, cabinH: 15, cabinLen: 2.3, cabinAt: 0.05 },
};

type CarSprites = { body: GameObjects.Image; bodyGlow: GameObjects.Image | null; cabin: GameObjects.Image; beam: GameObjects.Image; bt: PrismTex; ct: PrismTex };

export class TrafficView {
    private cars = new Map<number, CarSprites>();

    constructor(private scene: Scene, private grid: IsoGrid, private lighting: LightingView) {
        // lane markings: dashed white between same-direction lanes, double yellow on the median
        const g = scene.add.graphics().setDepth(-9800);
        const line = (j: number, color: number, dash: boolean) => {
            for (let i = -0.5; i < SKYTRAIN.roadLength - 0.5; i += dash ? 1 : 0.25) {
                if (i + 0.5 > SKYTRAIN.crosswalk.i0 && i < SKYTRAIN.crosswalk.i1) continue;
                const a = grid.toWorld(i, j), b = grid.toWorld(i + (dash ? 0.5 : 0.25), j);
                g.lineStyle(1, color, 0.8).lineBetween(a.x, a.y, b.x, b.y);
            }
        };
        line(8.375, 0xd8d8d0, true); line(10.625, 0xd8d8d0, true);
        line(9.35, 0xc9a640, false); line(9.65, 0xc9a640, false);
    }

    private sprites(c: Car): CarSprites {
        const L = LOOK[c.kind], len = CAR_SPEC[c.kind].len;
        const end = c.dir === 1 ? 'head' : 'tail';
        const bt = prismTexture(this.scene, `car_${c.kind}_body_${end}`, len, L.w, L.bodyH, carPart(L.body, 'body', end));
        const ct = prismTexture(this.scene, `car_${c.kind}_cabin`, L.cabinLen, L.w * 0.9, L.cabinH, carPart(L.cabin, 'cabin', end));
        const body = this.scene.add.image(0, 0, bt.key).setOrigin(0, 0);
        const bodyGlow = bt.glowKey ? this.scene.add.image(0, 0, bt.glowKey).setOrigin(0, 0).setDepth(50002).setBlendMode('ADD') : null;
        const cabin = this.scene.add.image(0, 0, ct.key).setOrigin(0, 0);
        const beam = this.scene.add.image(0, 0, 'glowCool').setBlendMode('ADD').setDepth(50001).setScale(0.45, 0.35);
        return { body, bodyGlow, cabin, beam, bt, ct };
    }

    update(model: TrafficModel) {
        const lights = this.lighting.current.lights, seen = new Set<number>();
        for (const c of model.cars) {
            seen.add(c.id);
            let s = this.cars.get(c.id);
            if (!s) { s = this.sprites(c); this.cars.set(c.id, s); }
            const L = LOOK[c.kind], len = CAR_SPEC[c.kind].len, lane = SKYTRAIN.lanes[c.lane];
            const ei = c.dir === 1 ? c.front - len : c.front, ej = lane.j - L.w / 2;
            const depth = this.grid.toWorld(ei + len, ej + L.w).y;
            const b = prismXY(this.grid, s.bt, ei, ej, len, L.w, 0);
            s.body.setPosition(Math.round(b.x), Math.round(b.y)).setDepth(depth);
            s.bodyGlow?.setPosition(Math.round(b.x), Math.round(b.y)).setAlpha(lights);
            // cabin sits on the body, toward the back for cars (cabinAt measured from the rear)
            const ci = c.dir === 1 ? ei + L.cabinAt * len : ei + len - L.cabinAt * len - L.cabinLen;
            const cp = prismXY(this.grid, s.ct, ci, ej + L.w * 0.05, L.cabinLen, L.w * 0.9, L.bodyH);
            s.cabin.setPosition(Math.round(cp.x), Math.round(cp.y)).setDepth(depth + 0.01);
            const f = this.grid.toWorld(c.front + c.dir * 0.9, lane.j);
            s.beam.setPosition(f.x, f.y).setAlpha(lights * 0.55);
        }
        for (const [id, s] of this.cars) if (!seen.has(id)) {
            s.body.destroy(); s.bodyGlow?.destroy(); s.cabin.destroy(); s.beam.destroy();
            this.cars.delete(id);
        }
    }
}
