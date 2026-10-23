// Room layouts, shared by client (drawing, map editor) and server (collision/validation).
// The data lives in rooms/<id>.json (written by the map editor, formatted by formatRoom below).
//
// Tile axes: i runs screen down-right, j runs screen down-left.
// "North" (toward the mall) = small j = top-right edge; "south" (toward the soi) = large j = bottom-left edge.
import plaza from './rooms/plaza.json' with { type: 'json' };
import soi from './rooms/soi.json' with { type: 'json' };
import mall from './rooms/mall.json' with { type: 'json' };
import canal from './rooms/canal.json' with { type: 'json' };

export type Ground = 'plaza' | 'sidewalk' | 'road' | 'crosswalk' | 'soi' | 'water' | 'wood' | 'grass';
export type Rect = { i0: number; j0: number; i1: number; j1: number };
export type Art = 'tree' | 'bench' | 'clock' | 'kiosk';
export type Box = Rect & {
    h: number;              // height in px
    z?: number;             // base height in px (elevated structures)
    color: number;
    label?: string;
    elevated?: boolean;     // drawn above the player, doesn't block walking (skytrain deck, roofs)
    image?: string;         // real art instead of a grey box (origin = bottom corner of the footprint)
    glow?: boolean;         // warm light spilling from the front
    art?: Art;              // code-drawn pixel art instead of a grey box
    front?: 'left' | 'right';   // which visible face is the shop front (bottom-left = +j side, bottom-right = +i side)
};
export const ROOM_IDS = ['plaza', 'soi', 'mall', 'canal'] as const;
export type RoomId = typeof ROOM_IDS[number];
export type Exit = Rect & { to: RoomId | null; spawn?: { i: number; j: number }; label: string };
export type Room = {
    id: RoomId; name: string; w: number; h: number;
    spawn: { i: number; j: number };
    scenery?: 'skytrain';   // extra code-drawn structure (layout in skytrain.ts)
    boxes: Box[]; exits: Exit[]; lamps: { i: number; j: number }[];
    walkways?: [number, number][][];   // routes ambient pedestrians follow (tile coords, start/end off the edge)
    ground: string[];       // one string per row j, one GROUND_CODE character per tile i
};

/** one character per ground type in Room.ground */
export const GROUND_CODE: Record<Ground, string> = {
    plaza: 'p', sidewalk: 's', road: 'r', crosswalk: 'c', soi: 'o', water: 'w', wood: 'd', grass: 'g',
};
export const GROUND_OF: Record<string, Ground> = Object.fromEntries(Object.entries(GROUND_CODE).map(([g, c]) => [c, g as Ground]));
export const BLOCKING_GROUND: Ground[] = ['road', 'water'];

export const ROOMS: Record<RoomId, Room> = { plaza, soi, mall, canal } as unknown as Record<RoomId, Room>;

/** Readable JSON: one line per box/exit/lamp/walkway and per ground row, so git diffs stay small. */
export function formatRoom(r: Room): string {
    const line = (v: unknown) => JSON.stringify(v);
    const parts = Object.entries(r).filter(([, v]) => v !== undefined).map(([k, v]) =>
        Array.isArray(v) && v.length && typeof v[0] !== 'number'
            ? `  ${line(k)}: [\n${v.map(x => '    ' + line(x)).join(',\n')}\n  ]`
            : `  ${line(k)}: ${line(v)}`);
    return '{\n' + parts.join(',\n') + '\n}\n';
}
