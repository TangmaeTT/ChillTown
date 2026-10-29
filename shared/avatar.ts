// Avatar look: skin tone, hair colour, item colour and the head parts the player wears.
// Shared so the server can check a look before passing it to other players (only ids and indexes travel).
//
// Body = a set sheet (Autosprite, face painted off by tools/blank_face.py) recoloured to the skin tone.
// Head = parts drawn on the standing frame of each view, moved with the head every frame (player_rig.json).
// The part list lives in parts.json, written by the avatar editor (?avatar=1) and checked by partsError.
import parts from './parts.json' with { type: 'json' };

export type Slot = 'hairBack' | 'face' | 'hairFront' | 'glasses' | 'hat';
// front-to-back order on top of the body; hairBack goes behind the body when facing the camera
export const SLOTS: Slot[] = ['hairBack', 'face', 'hairFront', 'glasses', 'hat'];
export const TINTS = ['hair', 'item'] as const;

// the 4 drawn views of a part, in its sheet order (player.png rows 1, 3, 5, 7)
export const VIEWS = ['SE', 'SW', 'NW', 'NE'] as const;
export const MAX_OFFSET = 20;  // px a part may be nudged from where it was drawn

export type Part = {
    id: string;             // file: client/public/assets/head/<id>.png (4 views of 68x68: SE, SW, NW, NE)
    slot: Slot;
    tint?: 'hair' | 'item'; // recoloured by brightness onto that ramp; none = drawn colours as they are
    offset: [number, number][];   // per view: px moved from where it was drawn, set in the avatar editor
};

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

export type Look = {
    skin: number;
    hair: number;
    item: number;
    parts: string[];        // part ids, at most one per slot
};

export const DEFAULT_LOOK: Look = { skin: 1, hair: 1, item: 0, parts: [] };

export const partById = (id: string) => PARTS.find(p => p.id === id);

/** the reason a look is not allowed, or null */
export function lookError(l: Look): string | null {
    const idx = (v: number, list: unknown[]) => Number.isInteger(v) && v >= 0 && v < list.length;
    if (!idx(l.skin, SKIN_TONES)) return 'skin';
    if (!idx(l.hair, HAIR_COLORS)) return 'hair';
    if (!idx(l.item, ITEM_COLORS)) return 'item';
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
        const ok = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) <= MAX_OFFSET;
        if (!Array.isArray(p.offset) || p.offset.length !== VIEWS.length || !p.offset.every(o => Array.isArray(o) && o.length === 2 && o.every(ok)))
            return `${p.id}: offset must be ${VIEWS.length} [x, y] pairs within ${MAX_OFFSET} px`;
    }
    return null;
}

/** parts.json as the editor writes it: one part per line */
export function formatParts(list: Part[]): string {
    const clean = list.map(({ id, slot, tint, offset }) => ({ id, slot, ...(tint ? { tint } : {}), offset }));
    return '[\n' + clean.map(p => '  ' + JSON.stringify(p)).join(',\n') + '\n]\n';
}

// Wire / URL form: "<skin>.<hair>.<item>[.<part id>...]", e.g. "1.1.0.beanie.round_glasses"
export function encodeLook(l: Look): string {
    return [l.skin, l.hair, l.item, ...l.parts].join('.');
}

export function decodeLook(s: string): Look | null {
    const [skin, hair, item, ...parts] = s.split('.');
    const l: Look = { skin: Number(skin), hair: Number(hair), item: Number(item), parts };
    return lookError(l) ? null : l;
}
