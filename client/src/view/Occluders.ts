import { Math as PMath } from 'phaser';
import type { Rect } from '@shared/rooms';
import type { Drawn } from './art/blockout';

// Everything that can hide the player: solids (buildings on the ground, sorted against the player) and
// roofs (elevated things like the skytrain, always drawn above). Both turn see-through while covering the player.
type Entry = Drawn & { kind: 'solid' | 'roof'; rect: Rect };

export class Occluders {
    private list: Entry[] = [];

    addSolid(d: Drawn, rect: Rect) { this.list.push({ ...d, kind: 'solid', rect }); }
    addRoof(d: Drawn, rect: Rect) { this.list.push({ ...d, kind: 'roof', rect }); }

    /** Returns the depth the player should have, and fades whatever is covering them. */
    update(px: number, py: number, ti: number, tj: number): number {
        let depth = py, lo = -Infinity, hi = Infinity;
        for (const s of this.list) {
            if (s.kind === 'solid') {
                const overlaps = px > s.left - 12 && px < s.right + 12 && py < s.bottom + 4;
                const inFront = ti > s.rect.i1 || tj > s.rect.j1;
                if (overlaps) { if (inFront) lo = Math.max(lo, s.depth + 1); else hi = Math.min(hi, s.depth - 1); }
                fade(s, overlaps && !inFront && py - 40 > s.top, 0.4);
            } else {
                const covered = px > s.left - 8 && px < s.right + 8 && py - 40 < s.bottom && py > s.top;
                fade(s, covered, 0.3);
            }
        }
        return Math.min(Math.max(depth, lo), hi);
    }
}

function fade(d: Drawn, on: boolean, to: number) {
    for (const o of d.objects) o.setAlpha(PMath.Linear(o.alpha, on ? to : 1, 0.15));
}
