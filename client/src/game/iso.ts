// Isometric helpers (2:1). One tile = 64x32 world pixels.
// The map size changes per room: call setMapSize() before using the other helpers.
export const TW = 64;
export const TH = 32;
const MARGIN_X = 64, MARGIN_TOP = 260, MARGIN_BOTTOM = 96;

export let MAP_W = 16;      // tiles along i (screen down-right)
export let MAP_H = 16;      // tiles along j (screen down-left)
export let OX = 0;          // world x of tile (0,0) centre
export let OY = 0;          // world y of tile (0,0) centre
export let WORLD_W = 0;
export let WORLD_H = 0;

export function setMapSize(w: number, h: number) {
    MAP_W = w; MAP_H = h;
    OX = h * (TW / 2) + MARGIN_X;
    OY = MARGIN_TOP;  // room for tall buildings on the far edge
    WORLD_W = (w + h) * (TW / 2) + MARGIN_X * 2;
    WORLD_H = (w + h) * (TH / 2) + MARGIN_TOP + MARGIN_BOTTOM;
}
setMapSize(16, 16);

/** tile (i,j) -> world position of the tile centre (fractional tiles allowed) */
export function tileToWorld(i: number, j: number) {
    return { x: OX + (i - j) * (TW / 2), y: OY + (i + j) * (TH / 2) };
}

/** world position -> fractional tile coords (round them to get the tile index) */
export function worldToTile(x: number, y: number) {
    const dx = (x - OX) / (TW / 2);
    const dy = (y - OY) / (TH / 2);
    return { i: (dy + dx) / 2, j: (dy - dx) / 2 };
}
