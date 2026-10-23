// Shared clock/weather state between the world scene and the HUD.
export const world = {
    minutes: 17 * 60 + 50,   // in-game time of day
    speed: 1,                // 1 = one game minute every 120 ms
    raining: true,
    day: 1,
    roomName: '',            // shown in the HUD
    // camera zoom, kept across room changes. ?zoom=0.75 in the URL sets the starting value
    zoom: Number(new URLSearchParams(location.search).get('zoom')) || 2,
};

export const ZOOM_MIN = 0.5, ZOOM_MAX = 3;

/** multiply the zoom by f (wheel, pinch, buttons), clamped */
export function zoomBy(f: number) {
    world.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, world.zoom * f));
}

export function timeLabel() {
    const m = Math.floor(world.minutes) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 0 = full daylight, 1 = deep night */
export function nightFactor() {
    const h = (world.minutes % 1440) / 60;
    if (h >= 6.5 && h < 17) return 0;
    if (h >= 17 && h < 19.5) return (h - 17) / 2.5;
    if (h >= 19.5 || h < 5) return 1;
    return 1 - (h - 5) / 1.5; // dawn 05:00-06:30
}
