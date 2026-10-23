// What the map editor can place. Footprint di x dj tiles; the rest is copied onto the new box.
import type { Box } from '@shared/rooms';

export type Template = { id: string; name: string; di: number; dj: number; box: Omit<Box, 'i0' | 'j0' | 'i1' | 'j1'> };

const SHOP = 0x7d7468, DARK = 0x51545a, WOOD = 0x6b5440, TREE = 0x4d6c55;

export const CATALOG: Template[] = [
    { id: 'shophouse', name: 'ตึกแถว (2 ห้อง)', di: 2, dj: 4, box: { h: 120, color: SHOP, label: 'ตึกแถว', front: 'left' } },
    { id: 'shop', name: 'ร้านหัวมุม 4×4', di: 4, dj: 4, box: { h: 110, color: SHOP, label: 'ร้าน', front: 'left' } },
    { id: 'bigshop', name: 'ตึกใหญ่ 8×4', di: 8, dj: 4, box: { h: 150, color: DARK, label: 'ตึกใหญ่', front: 'left' } },
    { id: 'house', name: 'บ้านไม้ 4×3', di: 4, dj: 3, box: { h: 70, color: WOOD, label: 'บ้านไม้', front: 'left' } },
    { id: 'noodle', name: 'ร้านก๋วยเตี๋ยว (ภาพจริง)', di: 4, dj: 3, box: { h: 0, color: SHOP, image: 'noodle_shop', glow: true, front: 'left' } },
    { id: 'kiosk', name: 'ซุ้มขายของ 4×3', di: 4, dj: 3, box: { h: 46, color: 0x8f7068, art: 'kiosk', label: 'ซุ้ม', front: 'left' } },
    { id: 'tree', name: 'ต้นไม้', di: 1, dj: 1, box: { h: 56, color: TREE, art: 'tree' } },
    { id: 'bench_i', name: 'ม้านั่ง (แนว ↘)', di: 2, dj: 1, box: { h: 8, color: WOOD, art: 'bench' } },
    { id: 'bench_j', name: 'ม้านั่ง (แนว ↙)', di: 1, dj: 2, box: { h: 8, color: WOOD, art: 'bench' } },
    { id: 'clock', name: 'เสานาฬิกา', di: 1, dj: 1, box: { h: 46, color: DARK, art: 'clock' } },
    { id: 'fountain', name: 'น้ำพุ 4×4', di: 4, dj: 4, box: { h: 16, color: 0x285265, label: 'น้ำพุ' } },
    { id: 'stage', name: 'เวที/ลานกิจกรรม 4×4', di: 4, dj: 4, box: { h: 4, color: 0x5a4f55, label: 'ลานกิจกรรม' } },
    { id: 'small', name: 'ของเล็ก 1×1', di: 1, dj: 1, box: { h: 20, color: SHOP } },
    { id: 'roof', name: 'หลังคาลอย 3×3', di: 3, dj: 3, box: { z: 48, h: 8, color: WOOD, elevated: true, label: 'หลังคา' } },
];
