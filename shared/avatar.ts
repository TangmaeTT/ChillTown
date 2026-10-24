// Avatar look: skin tone, hair colour, item colour and the head parts the player wears.
// Shared so the server can check a look before passing it to other players (only ids and indexes travel).
//
// Body = a set sheet (Autosprite, drawn with a plain bald head) recoloured to the skin tone.
// Head = parts drawn on the standing frame of each view, moved with the head every frame (player_rig.json).

export type Slot = 'hairBack' | 'face' | 'hairFront' | 'glasses' | 'hat';
// front-to-back order on top of the body; hairBack goes behind the body when facing the camera
export const SLOTS: Slot[] = ['hairBack', 'face', 'hairFront', 'glasses', 'hat'];

export type Part = {
    id: string;             // file: client/public/assets/head/<id>.png (4 views of 68x68: SE, SW, NW, NE)
    slot: Slot;
    tint?: 'hair' | 'item'; // recoloured by brightness onto that ramp; none = drawn colours as they are
};

export const PARTS: Part[] = [
    { id: 'beanie', slot: 'hat', tint: 'item' },
    { id: 'round_glasses', slot: 'glasses', tint: 'item' },
];

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

// Wire / URL form: "<skin>.<hair>.<item>[.<part id>...]", e.g. "1.1.0.beanie.round_glasses"
export function encodeLook(l: Look): string {
    return [l.skin, l.hair, l.item, ...l.parts].join('.');
}

export function decodeLook(s: string): Look | null {
    const [skin, hair, item, ...parts] = s.split('.');
    const l: Look = { skin: Number(skin), hair: Number(hair), item: Number(item), parts };
    return lookError(l) ? null : l;
}
