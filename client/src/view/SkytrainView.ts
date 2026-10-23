import { Scene, GameObjects, Math as PMath } from 'phaser';
import type { IsoGrid } from '@shared/iso';
import { SKYTRAIN } from '@shared/skytrain';
import { CAR_LEN, CAR_GAP, CARS, type TrainModel } from '../model/TrainModel';
import {
    prismTexture, placePrism, prismXY, concrete, trackTop, platformTop, glassWall, metalRoof, trainCar, concourse, stairStep,
    type PrismTex, type Placed,
} from './art/pixelart';
import type { LightingView } from './LightingView';
import type { Occluders } from './Occluders';

// The skytrain, drawn in code as pixel art: viaduct, piers, three-level station, stairs, and the trains.
// Depth bands for elevated parts (all above anything on the ground):
const D = { deck: 40000, farWall: 40500, train: 41000, nearWall: 41500, roof: 42000 };
const LIVERY = 0x2f8f8a;                // fictional line colour (teal), not a real operator's
const CONCRETE = 0x9a9d96, CAR_W = 0.85, CAR_H = 22, TRAIN_Z = SKYTRAIN.deck.z + SKYTRAIN.deck.h;

type TrainSprites = { cars: { img: GameObjects.Image; glow: GameObjects.Image | null; tex: PrismTex }[] };

export class SkytrainView {
    private trains = new Map<number, TrainSprites>();
    private carTex: Record<'head' | 'tail' | 'none', PrismTex>;

    constructor(private scene: Scene, private grid: IsoGrid, private lighting: LightingView, occluders: Occluders) {
        const { deck, station: st } = SKYTRAIN;
        const roof = (p: Placed, rect: { i0: number; j0: number; i1: number; j1: number }) => {
            occluders.addRoof({ depth: p.img.depth, objects: [p.img], left: p.left, right: p.right, top: p.top, bottom: p.top + p.img.height }, rect);
            if (p.glow) lighting.addGlow(p.glow, p.img);
        };
        const tileRect = (i0: number, j0: number, i1: number, j1: number) => ({ i0: Math.round(i0 + 0.5), j0: Math.round(j0 + 0.5), i1: Math.round(i1 - 0.5), j1: Math.round(j1 - 0.5) });

        // --- daylight shadows on the road and sidewalks (offset toward the bottom-right, away from the sun)
        const shadow = scene.add.graphics().setDepth(-9500);
        const shadowOf = (i0: number, i1: number, j0: number, j1: number, z: number) => {
            const o = z / 96;
            const p = [grid.toWorld(i0 + 0.6 * o, j0 + 0.25 * o), grid.toWorld(i1 + 0.6 * o, j0 + 0.25 * o), grid.toWorld(i1 + 0.6 * o, j1 + 0.25 * o), grid.toWorld(i0 + 0.6 * o, j1 + 0.25 * o)];
            shadow.fillStyle(0x10141c, 1).fillPoints(p as PMath.Vector2[], true);
        };
        shadowOf(-0.5, SKYTRAIN.roadLength - 0.5, deck.j0, deck.j1, deck.z);
        shadowOf(st.roof.i0, st.roof.i1, st.roof.j0, st.roof.j1, st.roof.z * 0.7);
        lighting.addShadow(shadow, 0.3);

        // --- viaduct deck in 2-tile segments, skipping the station
        const seg = (di: number) => prismTexture(scene, `deck_${di}`, di, deck.j1 - deck.j0, deck.h, trackTop(CONCRETE));
        for (const [a, b] of [[-0.5, st.platform.i0], [st.platform.i1, SKYTRAIN.roadLength - 0.5]]) {
            for (let i = a; i < b - 0.01; i += 2) {
                const di = Math.min(2, b - i);
                const p = placePrism(scene, grid, seg(di), i, deck.j0, di, deck.j1 - deck.j0, deck.z, 0);
                p.img.setDepth(D.deck + p.groundY * 0.001);
                roof(p, tileRect(i, deck.j0, i + di, deck.j1));
            }
        }

        // --- hammerhead piers on the median
        const colTex = prismTexture(scene, 'pier_col', 0.55, 0.55, deck.z - 8, concrete(0x8f928b, { joint: 999 }));
        const capTex = prismTexture(scene, 'pier_cap', 0.8, deck.j1 - deck.j0 - 0.2, 10, concrete(0x8f928b, { joint: 999 }));
        for (const i of SKYTRAIN.pillars) {
            const col = placePrism(scene, grid, colTex, i - 0.275, SKYTRAIN.pillarJ - 0.275, 0.55, 0.55, 0, 0);
            col.img.setDepth(col.groundY);
            occluders.addSolid({ depth: col.groundY, objects: [col.img], left: col.left, right: col.right, top: col.top, bottom: col.groundY }, { i0: i, j0: 9, i1: i, j1: 10 });
            const cap = placePrism(scene, grid, capTex, i - 0.4, deck.j0 + 0.1, 0.8, deck.j1 - deck.j0 - 0.2, deck.z - 10, 0);
            cap.img.setDepth(D.deck - 1);
        }

        // --- station: concourse (ticket hall) over the road, platform level, glass walls, roof
        const c = st.concourse, pf = st.platform, rf = st.roof;
        const conc = placePrism(scene, grid, prismTexture(scene, 'st_concourse', c.i1 - c.i0, c.j1 - c.j0, c.h, concourse(0xa4a69e)),
            c.i0, c.j0, c.i1 - c.i0, c.j1 - c.j0, c.z, 0);
        conc.img.setDepth(D.deck - 0.5);
        roof(conc, tileRect(c.i0, c.j0, c.i1, c.j1));

        const tf = (deck.j0 - pf.j0) * 32, tt = (deck.j1 - pf.j0) * 32;
        const plat = placePrism(scene, grid, prismTexture(scene, 'st_platform', pf.i1 - pf.i0, pf.j1 - pf.j0, pf.h, platformTop(tf, tt)),
            pf.i0, pf.j0, pf.i1 - pf.i0, pf.j1 - pf.j0, pf.z, 0);
        plat.img.setDepth(D.deck + 0.5);
        roof(plat, tileRect(pf.i0, pf.j0, pf.i1, pf.j1));

        const wallZ = pf.z + pf.h, wallH = rf.z - wallZ, L = pf.i1 - pf.i0;
        const far = placePrism(scene, grid, prismTexture(scene, 'st_wall_far', L, 0.3, wallH, glassWall(0x5d6268, { glow: null })), pf.i0, pf.j0, L, 0.3, wallZ, 0);
        far.img.setDepth(D.farWall);
        roof(far, tileRect(pf.i0, pf.j0, pf.i1, pf.j0 + 1));
        const near = placePrism(scene, grid, prismTexture(scene, 'st_wall_near', L, 0.3, wallH, glassWall(0x5d6268, { alpha: 0.4 })), pf.i0, pf.j1 - 0.3, L, 0.3, wallZ, 0);
        near.img.setDepth(D.nearWall);
        roof(near, tileRect(pf.i0, pf.j1 - 1, pf.i1, pf.j1));

        const postTex = prismTexture(scene, 'st_post', 0.22, 0.22, wallH, concrete(0x6f747a, { joint: 999 }));
        for (const i of [pf.i0 + 0.1, (pf.i0 + pf.i1) / 2, pf.i1 - 0.35]) for (const [j, d] of [[pf.j0 + 0.05, D.farWall + 1], [pf.j1 - 0.27, D.nearWall + 1]]) {
            const p = placePrism(scene, grid, postTex, i, j, 0.22, 0.22, wallZ, 0);
            p.img.setDepth(d);
            roof(p, tileRect(i, j, i + 1, j + 1));
        }

        const rt = placePrism(scene, grid, prismTexture(scene, 'st_roof', rf.i1 - rf.i0, rf.j1 - rf.j0, rf.h, metalRoof(0x707a82, [140, 235, 215])),
            rf.i0, rf.j0, rf.i1 - rf.i0, rf.j1 - rf.j0, rf.z, 0);
        rt.img.setDepth(D.roof);
        roof(rt, tileRect(rf.i0, rf.j0, rf.i1, rf.j1));

        // --- stairs from the sidewalks up to the concourse
        const STEPS = 10;
        for (const s of SKYTRAIN.stairs) {
            const d = (s.j1 - s.j0) / STEPS, rise = c.z / STEPS, di = s.i1 - s.i0;
            for (let k = 0; k < STEPS; k++) {
                const h = (k + 1) * rise;
                const j = s.up === 1 ? s.j0 + k * d : s.j1 - (k + 1) * d;
                const step = prismTexture(scene, `stair_${di}_${d.toFixed(2)}_${k}`, di, d, h, stairStep(0xb0b2aa));
                const p = placePrism(scene, grid, step, s.i0, j, di, d, 0, 0);
                p.img.setDepth(p.groundY);
                occluders.addSolid({ depth: p.groundY, objects: [p.img], left: p.left, right: p.right, top: p.top, bottom: p.groundY }, tileRect(s.i0, s.j0, s.i1, s.j1));
            }
        }

        // --- train cars (one texture per visible end)
        this.carTex = {
            head: prismTexture(scene, 'car_head', CAR_LEN, CAR_W, CAR_H, trainCar(LIVERY, 'head')),
            tail: prismTexture(scene, 'car_tail', CAR_LEN, CAR_W, CAR_H, trainCar(LIVERY, 'tail')),
            none: prismTexture(scene, 'car_mid', CAR_LEN, CAR_W, CAR_H, trainCar(LIVERY, 'none')),
        };
    }

    update(model: TrainModel) {
        const seen = new Set<number>();
        for (const t of model.trains) {
            seen.add(t.id);
            let s = this.trains.get(t.id);
            if (!s) {
                // the car at the highest i shows its +i end: headlights when moving +i, tail lights when moving -i
                const kinds = Array.from({ length: CARS }, (_, k) => k === CARS - 1 ? (t.dir === 1 ? 'head' : 'tail') : 'none') as ('head' | 'tail' | 'none')[];
                s = {
                    cars: kinds.map(k => {
                        const tex = this.carTex[k];
                        const img = this.scene.add.image(0, 0, tex.key).setOrigin(0, 0);
                        const glow = tex.glowKey ? this.scene.add.image(0, 0, tex.glowKey).setOrigin(0, 0).setDepth(50002).setBlendMode('ADD') : null;
                        return { img, glow, tex };
                    }),
                };
                this.trains.set(t.id, s);
            }
            const track = SKYTRAIN.tracks[t.track];
            s.cars.forEach((car, k) => {
                const i = t.tail + k * (CAR_LEN + CAR_GAP);
                const { x, y } = prismXY(this.grid, car.tex, i, track.j - CAR_W / 2, CAR_LEN, CAR_W, TRAIN_Z);
                // fade in/out at the ends of the viaduct instead of popping
                const a = PMath.Clamp(Math.min(i + 0.5, SKYTRAIN.roadLength - 0.5 - (i + CAR_LEN)) / 1.5 + 1, 0, 1);
                car.img.setPosition(Math.round(x), Math.round(y)).setDepth(D.train + i * 0.001).setAlpha(a);
                // glow layers sit above everything, so a car under the station roof must not shine through it
                const underRoof = i + CAR_LEN > SKYTRAIN.station.roof.i0 && i < SKYTRAIN.station.roof.i1;
                car.glow?.setPosition(Math.round(x), Math.round(y)).setAlpha(underRoof ? 0 : a * this.lighting.current.lights);
            });
        }
        for (const [id, s] of this.trains) if (!seen.has(id)) {
            s.cars.forEach(c => { c.img.destroy(); c.glow?.destroy(); });
            this.trains.delete(id);
        }
    }
}
