// Game clock. One in-game day = DAY_SECONDS real seconds, derived from wall-clock time,
// so every client and the server agree on the time without syncing state.
export const DAY_SECONDS = 2 * 60 * 60;
const EPOCH = Date.UTC(2026, 9, 23) / 1000;   // day 1 = the day the project started counting

/** in-game time for a unix time in seconds */
export function gameTime(unixSeconds: number) {
    return {
        minutes: ((unixSeconds % DAY_SECONDS) / DAY_SECONDS) * 1440,   // 0-1440
        day: Math.floor((unixSeconds - EPOCH) / DAY_SECONDS) + 1,
    };
}

export type Phase = 'morning' | 'day' | 'afternoon' | 'evening' | 'night';

export function phaseOf(minutes: number): Phase {
    const h = minutes / 60;
    if (h >= 5 && h < 9) return 'morning';
    if (h >= 9 && h < 15) return 'day';
    if (h >= 15 && h < 17.5) return 'afternoon';
    if (h >= 17.5 && h < 19.5) return 'evening';
    return 'night';
}

export const PHASE_TH: Record<Phase, string> = { morning: 'เช้า', day: 'กลางวัน', afternoon: 'บ่าย', evening: 'เย็น', night: 'กลางคืน' };

export function clockLabel(minutes: number) {
    const m = Math.floor(minutes) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
