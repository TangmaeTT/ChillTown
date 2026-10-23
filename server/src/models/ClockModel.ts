// The authoritative game clock. Same maths as the client (shared/clock.ts), so they always agree.
import { DAY_SECONDS, gameTime, phaseOf, clockLabel } from '../../../shared/clock.ts';

export function currentTime(nowMs = Date.now()) {
    const t = gameTime(nowMs / 1000);
    return {
        serverTimeMs: nowMs,
        daySeconds: DAY_SECONDS,
        day: t.day,
        minutes: t.minutes,
        clock: clockLabel(t.minutes),
        phase: phaseOf(t.minutes),
    };
}
