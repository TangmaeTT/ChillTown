// Screen-space shapes for picking things in the editor (pure maths on the shared iso grid).
import type { IsoGrid } from '@shared/iso';
import type { Box, Rect } from '@shared/rooms';

type Pt = { x: number; y: number };

/** footprint corners (N far, E right, S near, W left) lifted by z */
export function footprint(grid: IsoGrid, r: Rect, z = 0) {
    const p = (i: number, j: number) => { const w = grid.toWorld(i, j); return { x: w.x, y: w.y - z }; };
    return { N: p(r.i0 - 0.5, r.j0 - 0.5), E: p(r.i1 + 0.5, r.j0 - 0.5), S: p(r.i1 + 0.5, r.j1 + 0.5), W: p(r.i0 - 0.5, r.j1 + 0.5) };
}

/** visible outline of a box (6 points), what you see on screen */
export function silhouette(grid: IsoGrid, b: Box): Pt[] {
    const z0 = b.z ?? 0, h = b.h || (b.image ? 260 : 6);
    const lo = footprint(grid, b, z0), hi = footprint(grid, b, z0 + h);
    return [hi.N, hi.E, lo.E, lo.S, lo.W, hi.W];
}

export function inPolygon(p: Pt, poly: Pt[]) {
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const A = poly[a], B = poly[b];
        if ((A.y > p.y) !== (B.y > p.y) && p.x < ((B.x - A.x) * (p.y - A.y)) / (B.y - A.y) + A.x) inside = !inside;
    }
    return inside;
}

/** index of the front-most box drawn under the point, or -1 */
export function pickBox(grid: IsoGrid, boxes: Box[], p: Pt) {
    let best = -1, bestDepth = -Infinity;
    boxes.forEach((b, k) => {
        if (!inPolygon(p, silhouette(grid, b))) return;
        const d = (b.elevated ? 1e6 : 0) + footprint(grid, b).S.y;
        if (d > bestDepth) { bestDepth = d; best = k; }
    });
    return best;
}
