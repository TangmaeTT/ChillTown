// Skytrain layout for the station plaza (geometry only; the client draws it, the server uses the solids).
// Coordinates are tile-edge coords: tile k spans k-0.5..k+0.5. z/heights are world pixels.
import type { Rect } from './rooms.ts';

export type Span = { i0: number; i1: number; j0: number; j1: number };

export const SKYTRAIN = {
    deck: { j0: 7.6, j1: 11.4, z: 96, h: 16 },                 // viaduct over the road, full room length
    tracks: [{ j: 8.6, dir: 1 as const }, { j: 10.4, dir: -1 as const }],
    pillars: [2, 7, 12, 16, 20, 25, 30],                        // hammerhead piers on the median (i)
    pillarJ: 9.5,
    station: {
        platform: { i0: 10.5, i1: 21.5, j0: 6.2, j1: 12.8, z: 96, h: 16 },
        concourse: { i0: 8.5, i1: 21.5, j0: 6.5, j1: 12.5, z: 56, h: 40 },
        roof: { i0: 10.2, i1: 21.8, j0: 5.9, j1: 13.1, z: 156, h: 10 },
        stopI: 16,                                              // trains stop with their middle here
    },
    // stairs from the sidewalks up to the concourse; `up` = direction the steps climb (+j or -j)
    stairs: [
        { i0: 8.5, i1: 10.5, j0: 2.5, j1: 6.5, up: 1 },
        { i0: 18.5, i1: 20.5, j0: 12.5, j1: 16.5, up: -1 },
    ],
    // road traffic
    lanes: [{ j: 8.0, dir: 1 as const }, { j: 8.75, dir: 1 as const }, { j: 10.25, dir: -1 as const }, { j: 11.0, dir: -1 as const }],
    crosswalk: { i0: 14.5, i1: 17.5 },
    roadLength: 32,
};

/** Tiles the skytrain makes unwalkable (stairs; pillars stand on the road which is blocked anyway). */
export function skytrainSolids(): Rect[] {
    return SKYTRAIN.stairs.map(s => ({ i0: s.i0 + 0.5, j0: s.j0 + 0.5, i1: s.i1 - 0.5, j1: s.j1 - 0.5 }));
}
