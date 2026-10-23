// Time-of-day look: keyframes over the in-game day. Presentation only; the clock itself is in the model.
import { world } from '../model/WorldModel';

type RGB = [number, number, number];
// ambient multiplies the whole scene; lights = street/window lights 0-1; sun = daylight shadow strength; sky = background
type Key = { h: number; ambient: RGB; lights: number; sun: number; sky: RGB };
const KEYS: Key[] = [
    { h: 0, ambient: [62, 80, 122], lights: 1, sun: 0, sky: [8, 12, 22] },
    { h: 4.5, ambient: [62, 80, 122], lights: 1, sun: 0, sky: [8, 12, 22] },
    { h: 5.5, ambient: [120, 112, 150], lights: 0.8, sun: 0, sky: [44, 40, 70] },          // blue hour
    { h: 6.3, ambient: [235, 170, 150], lights: 0.25, sun: 0.35, sky: [214, 150, 130] },   // sunrise
    { h: 7.5, ambient: [250, 225, 200], lights: 0, sun: 0.7, sky: [190, 200, 210] },       // morning
    { h: 10, ambient: [255, 255, 250], lights: 0, sun: 1, sky: [170, 196, 214] },          // midday
    { h: 14.5, ambient: [255, 250, 240], lights: 0, sun: 1, sky: [170, 196, 214] },
    { h: 16.5, ambient: [255, 222, 175], lights: 0, sun: 0.85, sky: [214, 190, 150] },     // golden afternoon
    { h: 17.8, ambient: [235, 160, 135], lights: 0.35, sun: 0.5, sky: [205, 120, 100] },   // sunset
    { h: 18.6, ambient: [150, 110, 150], lights: 0.85, sun: 0.1, sky: [70, 50, 90] },      // dusk
    { h: 19.6, ambient: [70, 88, 128], lights: 1, sun: 0, sky: [14, 18, 34] },             // night
    { h: 24, ambient: [62, 80, 122], lights: 1, sun: 0, sky: [8, 12, 22] },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type Light = { ambient: RGB; lights: number; sun: number; sky: RGB };

export function lighting(): Light {
    const h = (world.minutes % 1440) / 60;
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1].h <= h) k++;
    const a = KEYS[k], b = KEYS[k + 1], t = (h - a.h) / (b.h - a.h);
    const rgb = (x: RGB, y: RGB) => x.map((v, i) => Math.round(mix(v, y[i], t))) as RGB;
    const ambient = rgb(a.ambient, b.ambient);
    let lights = mix(a.lights, b.lights, t), sun = mix(a.sun, b.sun, t);
    if (world.raining) { // greyer, a little darker, lights come on earlier, softer shadows
        for (let i = 0; i < 3; i++) ambient[i] = Math.round(ambient[i] * 0.82 + 18);
        if (sun > 0) lights = Math.min(1, lights + 0.15 * (1 - lights));
        sun *= 0.3;
    }
    return { ambient, lights, sun, sky: rgb(a.sky, b.sky) };
}
