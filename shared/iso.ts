// Isometric grid math (2:1). One tile = 64x32 world pixels. Shared by client (drawing) and server (validation).
// Tile axes: i runs screen down-right, j runs screen down-left. Tile k spans k-0.5..k+0.5.
export const TW = 64;
export const TH = 32;

// Written without TS-only syntax (no parameter properties/enums) so Node can run it directly on the server.
export class IsoGrid {
    readonly w: number;       // tiles along i
    readonly h: number;       // tiles along j
    readonly ox: number;      // world x of tile (0,0) centre
    readonly oy: number;      // world y of tile (0,0) centre
    readonly worldW: number;
    readonly worldH: number;

    constructor(w: number, h: number, margin = { x: 64, top: 260, bottom: 96 }) {
        this.w = w; this.h = h;
        this.ox = h * (TW / 2) + margin.x;
        this.oy = margin.top;  // room for tall buildings on the far edge
        this.worldW = (w + h) * (TW / 2) + margin.x * 2;
        this.worldH = (w + h) * (TH / 2) + margin.top + margin.bottom;
    }

    /** tile (i,j) -> world position (fractional tiles allowed) */
    toWorld(i: number, j: number) {
        return { x: this.ox + (i - j) * (TW / 2), y: this.oy + (i + j) * (TH / 2) };
    }

    /** world position -> fractional tile coords (round them to get the tile index) */
    toTile(x: number, y: number) {
        const dx = (x - this.ox) / (TW / 2), dy = (y - this.oy) / (TH / 2);
        return { i: (dy + dx) / 2, j: (dy - dx) / 2 };
    }

    inside(i: number, j: number) {
        return i >= -0.45 && j >= -0.45 && i <= this.w - 0.55 && j <= this.h - 0.55;
    }
}
