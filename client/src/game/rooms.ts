// Siam centre, blockout v1: four connected rooms (Zheza-style). Grey boxes stand in for buildings
// until real art exists; labels say what each one is for. All names are placeholders, no real brands.
//
// Tile axes: i runs screen down-right, j runs screen down-left.
// "North" (toward the mall) = small j = top-right edge; "south" (toward the soi) = large j = bottom-left edge.

export type Ground = 'plaza' | 'sidewalk' | 'road' | 'crosswalk' | 'soi' | 'water' | 'wood' | 'grass';
export type Rect = { i0: number; j0: number; i1: number; j1: number };
export type Box = Rect & {
    h: number;              // height in px
    z?: number;             // base height in px (elevated structures)
    color: number;
    label?: string;
    elevated?: boolean;     // drawn above the player, doesn't block walking (skytrain deck, roofs)
    image?: string;         // real art instead of a grey box (origin = bottom corner of the footprint)
    glow?: boolean;         // warm light spilling from the front
};
export type RoomId = 'plaza' | 'soi' | 'mall' | 'canal';
export type Exit = Rect & { to: RoomId | null; spawn?: { i: number; j: number }; label: string };
export type Room = {
    id: RoomId; name: string; w: number; h: number;
    base: Ground; areas: (Rect & { g: Ground })[];
    boxes: Box[]; exits: Exit[]; lamps: { i: number; j: number }[];
    spawn: { i: number; j: number };
};

export const BLOCKING_GROUND: Ground[] = ['road', 'water'];

const CONCRETE = 0x8a8f8a, SHOP = 0x7d7468, TREE = 0x4d6c55, DARK = 0x51545a, WOOD = 0x6b5440;
const r = (i0: number, j0: number, i1: number, j1: number): Rect => ({ i0, j0, i1, j1 });

// ---------------------------------------------------------------- 1. station plaza
const plaza: Room = {
    id: 'plaza', name: 'ลานสถานีสยาม', w: 32, h: 20, base: 'plaza', spawn: { i: 16, j: 3 },
    areas: [
        { ...r(0, 6, 31, 7), g: 'sidewalk' },
        { ...r(0, 8, 31, 11), g: 'road' },
        { ...r(15, 8, 17, 11), g: 'crosswalk' },
        { ...r(0, 12, 31, 13), g: 'sidewalk' },
        { ...r(0, 14, 31, 19), g: 'sidewalk' },
        { ...r(13, 14, 19, 19), g: 'soi' },
    ],
    boxes: [
        // skytrain: deck over the road, station body over road + both sidewalks
        { ...r(0, 8, 31, 11), z: 104, h: 14, color: CONCRETE, elevated: true, label: 'รางรถไฟฟ้าลอยฟ้า' },
        { ...r(11, 6, 21, 13), z: 104, h: 60, color: 0x9a9f98, elevated: true, label: 'สถานีรถไฟฟ้า (ชั้นชานชาลา)' },
        ...[2, 7, 12, 20, 25, 30].map(i => ({ ...r(i, 9, i, 10), h: 104, color: CONCRETE })),
        { ...r(8, 3, 9, 5), h: 104, color: CONCRETE, label: 'บันไดขึ้นสถานี' },
        { ...r(23, 14, 24, 16), h: 104, color: CONCRETE, label: 'บันไดขึ้นสถานี' },
        // north plaza: meeting point under the station
        { ...r(13, 2, 13, 2), h: 46, color: DARK, label: 'นาฬิกา · จุดนัดเจอ' },
        { ...r(4, 1, 5, 1), h: 8, color: WOOD }, { ...r(24, 1, 25, 1), h: 8, color: WOOD },
        ...[2, 7, 22, 28].map(i => ({ ...r(i, 0, i, 0), h: 56, color: TREE })),
        // south side: kiosks toward the soi
        { ...r(4, 16, 7, 18), h: 70, color: SHOP, label: 'ร้านน้ำ/ขนม' },
        { ...r(25, 16, 29, 18), h: 80, color: SHOP, label: 'ร้านดอกไม้' },
    ],
    exits: [
        { ...r(14, 0, 18, 0), to: 'mall', spawn: { i: 13, j: 17 }, label: '↑ ลานหน้าห้าง' },
        { ...r(14, 19, 18, 19), to: 'soi', spawn: { i: 11, j: 2 }, label: '↓ ซอยสแควร์' },
    ],
    lamps: [{ i: 4, j: 6 }, { i: 27, j: 6 }, { i: 4, j: 13 }, { i: 20, j: 13 }, { i: 28, j: 13 }],
};

// ---------------------------------------------------------------- 2. Siam Square soi grid
const soi: Room = {
    id: 'soi', name: 'ซอยสแควร์', w: 24, h: 24, base: 'soi', spawn: { i: 11, j: 2 },
    areas: [
        { ...r(0, 0, 9, 9), g: 'sidewalk' }, { ...r(14, 0, 23, 9), g: 'sidewalk' },
        { ...r(0, 14, 9, 23), g: 'sidewalk' }, { ...r(14, 14, 23, 23), g: 'sidewalk' },
    ],
    boxes: [
        { ...r(1, 1, 8, 4), h: 120, color: SHOP, label: 'ตึกแถว · โรงเรียนกวดวิชา' },
        { ...r(1, 5, 4, 8), h: 96, color: SHOP, label: 'ร้านเสื้อผ้า (แต่งตัว)' },
        { ...r(5, 5, 8, 8), h: 104, color: SHOP, label: 'คาเฟ่' },
        { ...r(15, 1, 22, 4), h: 130, color: DARK, label: 'โรงหนังเก่า' },
        { ...r(15, 5, 18, 8), h: 96, color: SHOP, label: 'ร้านเกม · ร้านเน็ต' },
        { ...r(19, 5, 22, 8), h: 100, color: SHOP, label: 'ร้านสะดวกซื้อ' },
        { ...r(1, 15, 4, 22), h: 110, color: SHOP, label: 'ร้านกิ๊ฟช็อป' },
        { ...r(5, 15, 8, 22), h: 100, color: SHOP, label: 'ร้านตัดผม' },
        { ...r(15, 15, 18, 17), h: 0, color: SHOP, image: 'noodle_shop', glow: true },
        { ...r(19, 15, 22, 22), h: 116, color: SHOP, label: 'ตึกแถว' },
        { ...r(15, 18, 18, 22), h: 96, color: SHOP, label: 'ร้านหนังสือ' },
    ],
    exits: [
        { ...r(10, 0, 13, 0), to: 'plaza', spawn: { i: 16, j: 17 }, label: '↑ ลานสถานี' },
    ],
    lamps: [{ i: 9, j: 10 }, { i: 14, j: 13 }, { i: 9, j: 19 }, { i: 14, j: 5 }, { i: 20, j: 13 }],
};

// ---------------------------------------------------------------- 3. mall front plaza
const mall: Room = {
    id: 'mall', name: 'ลานหน้าห้าง', w: 28, h: 20, base: 'plaza', spawn: { i: 13, j: 17 },
    areas: [
        { ...r(0, 5, 27, 6), g: 'sidewalk' },
        { ...r(26, 5, 27, 19), g: 'soi' },
    ],
    boxes: [
        { ...r(0, 0, 8, 4), h: 180, color: 0x6f747a, label: 'ห้างใหญ่' },
        { ...r(9, 0, 18, 4), h: 230, color: 0x7b8086, label: 'ห้างใหญ่ · ทางเข้าหลัก' },
        { ...r(19, 0, 25, 4), h: 180, color: 0x6f747a, label: 'ห้างใหญ่' },
        { ...r(12, 9, 15, 12), h: 16, color: 0x285265, label: 'น้ำพุ' },
        { ...r(20, 9, 23, 12), h: 4, color: 0x5a4f55, label: 'ลานจัดกิจกรรม/อีเวนต์' },
        { ...r(9, 14, 10, 14), h: 8, color: WOOD }, { ...r(17, 14, 18, 14), h: 8, color: WOOD },
        ...[3, 7, 20, 24].flatMap(i => [{ ...r(i, 7, i, 7), h: 56, color: TREE }, { ...r(i, 16, i, 16), h: 56, color: TREE }]),
    ],
    exits: [
        { ...r(12, 5, 15, 5), to: null, label: 'ทางเข้าห้าง · เร็ว ๆ นี้' },
        { ...r(12, 19, 15, 19), to: 'plaza', spawn: { i: 16, j: 2 }, label: '↓ ลานสถานี' },
        { ...r(27, 7, 27, 9), to: 'canal', spawn: { i: 2, j: 12 }, label: '→ ทางไปคลอง' },
    ],
    lamps: [{ i: 5, j: 7 }, { i: 11, j: 7 }, { i: 17, j: 7 }, { i: 22, j: 7 }, { i: 5, j: 15 }, { i: 22, j: 15 }],
};

// ---------------------------------------------------------------- 4. canal + pier
const canal: Room = {
    id: 'canal', name: 'ท่าเรือคลอง', w: 24, h: 20, base: 'sidewalk', spawn: { i: 2, j: 12 },
    areas: [
        { ...r(0, 0, 23, 4), g: 'grass' },
        { ...r(0, 5, 23, 10), g: 'water' },
        { ...r(9, 8, 13, 10), g: 'wood' },
        { ...r(0, 15, 23, 19), g: 'grass' },
    ],
    boxes: [
        { ...r(2, 0, 5, 3), h: 70, color: WOOD, label: 'บ้านไม้ริมคลอง' },
        { ...r(8, 0, 11, 2), h: 56, color: WOOD },
        { ...r(15, 0, 19, 3), h: 84, color: SHOP, label: 'ตึกเก่าฝั่งตรงข้าม' },
        { ...r(21, 0, 23, 2), h: 50, color: WOOD },
        { ...r(9, 8, 13, 10), z: 48, h: 8, color: WOOD, elevated: true, label: 'ท่าเรือ' },
        { ...r(15, 9, 18, 10), h: 12, color: 0x8f7068, label: 'เรือ (เร็ว ๆ นี้)' },
        ...[3, 8, 16, 21].map(i => ({ ...r(i, 17, i, 17), h: 48, color: TREE })),
        { ...r(11, 16, 13, 16), h: 8, color: WOOD, label: 'ม้านั่งริมน้ำ' },
    ],
    exits: [
        { ...r(0, 11, 0, 14), to: 'mall', spawn: { i: 25, j: 8 }, label: '← หน้าห้าง' },
    ],
    lamps: [{ i: 4, j: 11 }, { i: 18, j: 11 }, { i: 13, j: 10 }],
};

export const ROOMS: Record<RoomId, Room> = { plaza, soi, mall, canal };
