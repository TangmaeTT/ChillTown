// Avatar look: skin tone, hair colour, item colour and the head parts the player wears.
// Shared so the server can check a look before passing it to other players (only ids and indexes travel).
//
// Body = a set sheet (Autosprite, face painted off by tools/blank_face.py) recoloured to the skin tone.
// Head = parts drawn on the standing frame of each view, moved with the head every frame (player_rig.json).
// The part list lives in parts.json, written by the avatar editor (?avatar=1) and checked by partsError.
import parts from './parts.json' with { type: 'json' };

export type Slot = 'hairBack' | 'skirt' | 'face' | 'hairFront' | 'glasses' | 'hat';
// front-to-back order on top of the body; hairBack goes behind the body when facing the camera
export const SLOTS: Slot[] = ['hairBack', 'skirt', 'face', 'hairFront', 'glasses', 'hat'];
export const TINTS = ['hair', 'item', 'top', 'bottom'] as const;   // top/bottom = that garment's cloth colour
export const ANCHORS = ['head', 'waist'] as const;

// the 4 drawn views of a part, in its sheet order (player.png rows 1, 3, 5, 7)
export const VIEWS = ['SE', 'SW', 'NW', 'NE'] as const;
export const MAX_OFFSET = 20;  // px a part may be nudged from where it was drawn

export type Part = {
    id: string;             // file: client/public/assets/head/<id>.png (4 views of 68x68: SE, SW, NW, NE)
    slot: Slot;
    tint?: typeof TINTS[number];   // recoloured by brightness onto that ramp; none = drawn colours as they are
    anchor?: 'head' | 'waist';     // what it moves with frame to frame (player_rig.json / player_body.json); default head
    offset: [number, number][];   // per view: px moved from where it was drawn, set in the avatar editor
    blink?: boolean;        // sheet has 3 rows: open, half closed, closed (tools/face_part.py); the game blinks it
    sway?: Sway;            // sheet rows are poses swung screen-left -> right; a spring picks one (hair, scarves)
};

export type Sway = {
    poses: number;          // rows in the sheet (odd: the middle one hangs straight)
    stiffness: number;      // spring pull back to the drive (higher = snappier)
    damping: number;        // how fast the swing dies out (low = swings longer)
    gain: number;           // how far walking pushes it
};
export const SWAY_LIMITS = { poses: [2, 9], stiffness: [1, 300], damping: [0, 50], gain: [0, 3] } as const;

export const PARTS: Part[] = parts as Part[];

// Ramps run shadow to highlight. Kept muted to sit in the game palette (PROJECT_NOTES §3).
export const SKIN_TONES: string[][] = [
    ['#b7866d', '#dcaa88', '#f0c6a0', '#fbdcb8'],
    ['#a87560', '#d49c7e', '#eab38f', '#fbd6aa'],
    ['#8a5c45', '#b47e5c', '#cf9a72', '#e3b48a'],
    ['#6a4232', '#8f5f45', '#ad7a59', '#c8956e'],
    ['#45281f', '#63402f', '#7e5640', '#9a6e52'],
    ['#2e1b16', '#452a20', '#5c3a2b', '#74503b'],
];

export const HAIR_COLORS: string[][] = [
    ['#141214', '#241f22', '#3a3236', '#574a4f'],   // black
    ['#1f1715', '#3a2a24', '#554238', '#765a4c'],   // dark brown
    ['#2c1710', '#5a3020', '#84492c', '#a8683f'],   // chestnut
    ['#5a4426', '#977a45', '#c8a865', '#e6cf8f'],   // blonde
    ['#3a3a3d', '#66666b', '#96969b', '#c4c4c8'],   // grey
    ['#18251c', '#2e4a35', '#4d6c55', '#8ab074'],   // moss
    ['#0f1a2a', '#1c3048', '#2e4d6e', '#4d7396'],   // navy
    ['#3a1f25', '#6a3a44', '#8f5562', '#b37c86'],   // dusty rose
];

export const ITEM_COLORS: string[][] = [
    ['#1b1818', '#2c2a2c', '#43403f', '#5e5a58'],   // charcoal
    ['#6b6663', '#9f9a94', '#cbc3b7', '#f1ece8'],   // cream
    ['#5a4f2a', '#8f8250', '#b8ab6e', '#d3ca90'],   // mustard
    ['#1f3326', '#3b5849', '#4d6c55', '#648566'],   // moss
    ['#152d47', '#17364f', '#285265', '#3f6f80'],   // teal navy
    ['#3a1d18', '#6a3428', '#8f4a36', '#b06a4f'],   // brick
    ['#2e2430', '#51444a', '#67565a', '#8f7068'],   // mauve
];

// Clothes: the base body's shirt, trousers and shoes are re-drawn per pixel from a region map
// (tools/body_regions.py), so any top goes with any bottom in every frame of every animation.
export type Top = { id: string; name: string; sleeves: 'short' | 'long'; pattern: 'plain' | 'stripes' };
export const TOPS: Top[] = [
    { id: 'tee', name: 'เสื้อยืด', sleeves: 'short', pattern: 'plain' },
    { id: 'tee_stripe', name: 'เสื้อยืดลายขวาง', sleeves: 'short', pattern: 'stripes' },
    { id: 'long', name: 'แขนยาว', sleeves: 'long', pattern: 'plain' },
    { id: 'long_stripe', name: 'แขนยาวลายขวาง', sleeves: 'long', pattern: 'stripes' },
];
// overlay: a part (shared/parts.json) worn with it that changes the outline, e.g. a skirt over bare legs
export type Bottom = { id: string; name: string; length: 'long' | 'short'; overlay?: string };
export const BOTTOMS: Bottom[] = [
    { id: 'pants', name: 'ขายาว', length: 'long' },
    { id: 'shorts', name: 'ขาสั้น', length: 'short' },
    { id: 'skirt', name: 'กระโปรง', length: 'short', overlay: 'skirt' },
];

// cloth ramps, shadow to highlight; muted to sit in the game palette (PROJECT_NOTES §3)
export const CLOTH_COLORS: string[][] = [
    ['#5f5b58', '#8d8984', '#b5b0a9', '#dedad2'],   // light grey
    ['#7a756e', '#aaa49a', '#d3cdc1', '#f3efe6'],   // off-white
    ['#141414', '#222122', '#323031', '#47444a'],   // black
    ['#1c2638', '#2a3a55', '#3d5274', '#5a7396'],   // denim
    ['#152d47', '#17364f', '#285265', '#3f6f80'],   // teal navy
    ['#1f3326', '#3b5849', '#4d6c55', '#648566'],   // moss
    ['#5a4f2a', '#8f8250', '#b8ab6e', '#d3ca90'],   // mustard
    ['#3a1d18', '#6a3428', '#8f4a36', '#b06a4f'],   // brick
    ['#4a1c22', '#7a2f36', '#9e4049', '#bf6168'],   // wine
    ['#2e2430', '#51444a', '#67565a', '#8f7068'],   // mauve
    ['#3b2e22', '#5e4a36', '#806649', '#a3865f'],   // khaki brown
];

export type Look = {
    skin: number;
    hair: number;
    item: number;
    top: string;            // TOPS id
    topColor: number;       // CLOTH_COLORS index (stripes use the next-lightest of it plus off-white)
    bottom: string;         // BOTTOMS id
    bottomColor: number;
    shoes: number;          // CLOTH_COLORS index
    parts: string[];        // part ids, at most one per slot
};

export const DEFAULT_LOOK: Look = { skin: 1, hair: 1, item: 0, top: 'tee', topColor: 0, bottom: 'pants', bottomColor: 2, shoes: 2, parts: [] };

export const partById = (id: string) => PARTS.find(p => p.id === id);

/** the reason a look is not allowed, or null */
export function lookError(l: Look): string | null {
    const idx = (v: number, list: unknown[]) => Number.isInteger(v) && v >= 0 && v < list.length;
    if (!idx(l.skin, SKIN_TONES)) return 'skin';
    if (!idx(l.hair, HAIR_COLORS)) return 'hair';
    if (!idx(l.item, ITEM_COLORS)) return 'item';
    if (!TOPS.some(x => x.id === l.top)) return 'top';
    if (!BOTTOMS.some(x => x.id === l.bottom)) return 'bottom';
    if (!idx(l.topColor, CLOTH_COLORS) || !idx(l.bottomColor, CLOTH_COLORS) || !idx(l.shoes, CLOTH_COLORS)) return 'cloth colour';
    if (!Array.isArray(l.parts)) return 'parts';
    const slots = new Set<Slot>();
    for (const id of l.parts) {
        const p = partById(id);
        if (!p) return `unknown part ${id}`;
        if (slots.has(p.slot)) return `two parts in ${p.slot}`;
        slots.add(p.slot);
    }
    return null;
}

/** what's wrong with a part list from the avatar editor, or null. `known` = the ids that have art */
export function partsError(list: Part[], known: string[]): string | null {
    if (!Array.isArray(list)) return 'not a list';
    const seen = new Set<string>();
    for (const p of list) {
        if (!known.includes(p.id)) return `unknown part ${p.id}`;
        if (seen.has(p.id)) return `${p.id} twice`;
        seen.add(p.id);
        if (!SLOTS.includes(p.slot)) return `${p.id}: bad slot`;
        if (p.tint !== undefined && !TINTS.includes(p.tint)) return `${p.id}: bad tint`;
        if (p.blink !== undefined && typeof p.blink !== 'boolean') return `${p.id}: blink must be true or false`;
        if (p.anchor !== undefined && !ANCHORS.includes(p.anchor)) return `${p.id}: bad anchor`;
        if (p.sway !== undefined) {
            for (const [k, [lo, hi]] of Object.entries(SWAY_LIMITS)) {
                const v = (p.sway as Record<string, unknown>)[k];
                if (typeof v !== 'number' || !(v >= lo && v <= hi) || (k === 'poses' && !Number.isInteger(v)))
                    return `${p.id}: sway.${k} must be ${lo}-${hi}`;
            }
        }
        const ok = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) <= MAX_OFFSET;
        if (!Array.isArray(p.offset) || p.offset.length !== VIEWS.length || !p.offset.every(o => Array.isArray(o) && o.length === 2 && o.every(ok)))
            return `${p.id}: offset must be ${VIEWS.length} [x, y] pairs within ${MAX_OFFSET} px`;
    }
    return null;
}

/** parts.json as the editor writes it: one part per line */
export function formatParts(list: Part[]): string {
    const clean = list.map(({ id, slot, tint, anchor, offset, blink, sway }) =>
        ({ id, slot, ...(tint ? { tint } : {}), ...(anchor ? { anchor } : {}), ...(blink ? { blink } : {}), ...(sway ? { sway } : {}), offset }));
    return '[\n' + clean.map(p => '  ' + JSON.stringify(p)).join(',\n') + '\n]\n';
}

// Wire / URL form: "<skin>.<hair>.<item>.<top>-<colour>.<bottom>-<colour>.<shoes>[.<part id>...]",
// e.g. "1.1.0.tee_stripe-4.shorts-3.2.face_default". The older "<skin>.<hair>.<item>[.<part>...]" still reads,
// with the default clothes.
export function encodeLook(l: Look): string {
    return [l.skin, l.hair, l.item, `${l.top}-${l.topColor}`, `${l.bottom}-${l.bottomColor}`, l.shoes, ...l.parts].join('.');
}

export function decodeLook(s: string): Look | null {
    const [skin, hair, item, ...rest] = s.split('.');
    const l: Look = { ...DEFAULT_LOOK, skin: Number(skin), hair: Number(hair), item: Number(item), parts: rest };
    if (rest[0]?.includes('-') && rest[1]?.includes('-')) {
        const [top, topColor] = rest[0].split('-'), [bottom, bottomColor] = rest[1].split('-');
        Object.assign(l, { top, topColor: Number(topColor), bottom, bottomColor: Number(bottomColor), shoes: Number(rest[2]), parts: rest.slice(3) });
    }
    return lookError(l) ? null : l;
}
