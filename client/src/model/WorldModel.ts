// World state shared by every scene: clock, weather, player preferences. No Phaser in here.
import { gameTime, phaseOf, PHASE_TH, clockLabel, DAY_SECONDS } from '@shared/clock';
import { DEFAULT_LOOK, decodeLook } from '@shared/avatar';
import { BODY_H } from './PlayerModel';

const params = new URLSearchParams(location.search);

export const world = {
    minutes: 0,              // in-game time of day, 0-1440 (from the real clock, see shared/clock.ts)
    day: 1,
    speed: 1,                // fast-forward for testing (HUD button); 1 = normal
    offset: 0,               // seconds added to the real clock
    raining: params.get('rain') !== '0',
    roomName: '',            // shown in the HUD
    // camera zoom, kept across room changes. ?zoom=2 in the URL sets the starting value. The game shows the nearest
    // whole number (cameraZoom) so pixels stay even; the map editor zooms freely. Big (new style) characters start at 1.
    zoom: Number(params.get('zoom')) || (BODY_H > 60 ? 1 : 2),
    edit: params.get('edit') === '1',   // ?edit=1 opens the map editor
    // the player's avatar; ?look=1.1.0.beanie (see shared/avatar.ts) until there is a dressing room
    look: decodeLook(params.get('look') ?? '') ?? DEFAULT_LOOK,
};

// ?time=18:30 starts at that in-game time (testing/screenshots)
const startAt = params.get('time');
if (startAt) {
    const [h, m] = startAt.split(':').map(Number);
    const now = gameTime(Date.now() / 1000).minutes;
    world.offset = (((h * 60 + (m || 0)) - now + 1440) % 1440) / 1440 * DAY_SECONDS;
}

export function tickClock(dt: number) {
    if (world.speed !== 1) world.offset += dt * (world.speed - 1);
    const t = gameTime(Date.now() / 1000 + world.offset);
    world.minutes = t.minutes;
    world.day = t.day;
}
tickClock(0);

/** jump the clock to an hour of the day (map editor time slider) */
export function setTimeOfDay(hours: number) {
    const now = gameTime(Date.now() / 1000).minutes;
    world.offset = (((hours * 60 - now) % 1440 + 1440) % 1440) / 1440 * DAY_SECONDS;
    world.speed = 1;
    tickClock(0);
}

export const timeLabel = () => clockLabel(world.minutes);
export const phaseLabel = () => PHASE_TH[phaseOf(world.minutes)];

export const ZOOM_MIN = 0.5, ZOOM_MAX = 3;

/** the zoom the game camera settles on: whole numbers only (pixel art stays even), any value in the map editor */
export const cameraZoom = () => world.edit ? world.zoom : Math.max(1, Math.round(world.zoom));

/** multiply the zoom by f (wheel, pinch, buttons), clamped */
export function zoomBy(f: number) {
    world.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, world.zoom * f));
}
