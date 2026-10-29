// The spring behind swaying parts (ponytails, scarves): one value from -1 (swung screen-left) to 1 (right).
// Pixel art can't be rotated, so the view uses this to pick one of the part's pre-drawn poses.
import type { Sway } from '@shared/avatar';

export class SwaySpring {
    s = 0;      // current swing
    v = 0;      // its speed

    /** drive = where the part wants to hang now (-1..1): trailing behind the walk, plus wind */
    update(dt: number, drive: number, p: Sway) {
        dt = Math.min(dt, 0.05);                 // a long frame (tab in background) must not explode the spring
        const a = p.stiffness * (drive - this.s) - p.damping * this.v;
        this.v += a * dt;
        this.s = Math.max(-1, Math.min(1, this.s + this.v * dt));
        if (Math.abs(this.s) === 1) this.v = 0;   // hit the end pose: stop there instead of sticking
    }

    /** the sheet row to show */
    pose(p: Sway) {
        return Math.round((this.s + 1) / 2 * (p.poses - 1));
    }
}
