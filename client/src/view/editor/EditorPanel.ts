// Map editor side panel (plain DOM on top of the canvas). Draws the editor model; every input calls an action.
import { ROOM_IDS, ROOMS, type Ground, type RoomId, type Art } from '@shared/rooms';
import type { EditorModel, Tool } from '../../model/EditorModel';
import { CATALOG } from '../../model/editorCatalog';

export type PanelActions = {
    tool(t: Tool): void; template(id: string): void; ground(g: Ground): void; brush(n: number): void;
    update(patch: Record<string, unknown>): void; resize(di: number, dj: number): void; rotate(): void; remove(): void;
    undo(): void; redo(): void; save(): void; switchRoom(id: RoomId): void;
    time(hours: number): void; rain(on: boolean): void; roomSize(w: number, h: number): void; roomName(n: string): void;
    finishPath(): void; focus(i: number, j: number): void; exit(): void;
};

const TOOLS: { id: Tool; name: string; key: string; tip: string }[] = [
    { id: 'select', name: 'เลือก/ย้าย', key: '1', tip: 'คลิกของเพื่อเลือก ลากเพื่อย้าย · Del ลบ · R หมุน' },
    { id: 'place', name: 'วางของ', key: '2', tip: 'เลือกของจากรายการ แล้วคลิกบนแผนที่' },
    { id: 'paint', name: 'ระบายพื้น', key: '3', tip: 'เลือกชนิดพื้น แล้วคลิกหรือลาก' },
    { id: 'lamp', name: 'ไฟถนน', key: '4', tip: 'คลิกเพื่อวาง / คลิกซ้ำเพื่อเอาออก' },
    { id: 'exit', name: 'ทางออก', key: '5', tip: 'ลากเป็นสี่เหลี่ยมบนขอบห้อง แล้วตั้งปลายทางในแผงนี้' },
    { id: 'spawn', name: 'จุดเกิด', key: '6', tip: 'คลิกตรงที่ผู้เล่นจะเริ่มในห้องนี้' },
    { id: 'walkway', name: 'ทางคนเดิน', key: '7', tip: 'คลิกทีละจุด (เริ่ม/จบนอกขอบ) · Enter = จบเส้น · Esc = ยกเลิก' },
];
const GROUNDS: { g: Ground; name: string; color: string }[] = [
    { g: 'plaza', name: 'ลาน', color: '#a8a294' }, { g: 'sidewalk', name: 'ทางเท้า', color: '#9e9888' },
    { g: 'road', name: 'ถนน', color: '#46484c' }, { g: 'crosswalk', name: 'ทางม้าลาย', color: '#c9c7bc' },
    { g: 'soi', name: 'ซอย', color: '#4e4e50' }, { g: 'grass', name: 'หญ้า', color: '#4e6e42' },
    { g: 'water', name: 'น้ำ', color: '#264e62' }, { g: 'wood', name: 'ไม้', color: '#806246' },
    { g: 'tile', name: 'พื้นสถานี', color: '#c4c0b6' }, { g: 'rail', name: 'ราง', color: '#3e3a36' },
];
const ARTS: (Art | '')[] = ['', 'tree', 'bench', 'clock', 'kiosk'];

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const hexColor = (n: number) => '#' + n.toString(16).padStart(6, '0');

const CSS = `
#ed{position:fixed;top:0;right:0;width:300px;height:100%;overflow-y:auto;background:#0e1014ee;color:#e9eed8;
 font:13px Tahoma,"Leelawadee UI",sans-serif;border-left:2px solid #2c3a2a;z-index:10;box-sizing:border-box;padding:10px 12px 40px}
#ed h2{font-size:15px;margin:2px 0 8px} #ed h3{font-size:12px;color:#9fb08f;margin:14px 0 6px;font-weight:normal;text-transform:uppercase;letter-spacing:.05em}
#ed button{background:#25301f;color:#e9eed8;border:1px solid #3a4a34;border-radius:4px;padding:4px 7px;margin:2px;cursor:pointer;font:inherit}
#ed button:hover{background:#34452c} #ed button.on{background:#d3ca90;color:#14160f;border-color:#d3ca90}
#ed button:disabled{opacity:.4;cursor:default}
#ed input,#ed select{background:#1a1f1a;color:#e9eed8;border:1px solid #3a4a34;border-radius:3px;padding:3px 5px;font:inherit;box-sizing:border-box}
#ed .row{display:flex;align-items:center;gap:6px;margin:4px 0} #ed .row label{width:76px;color:#b8c2a8;flex:none}
#ed .row input[type=number]{width:64px} #ed .row input[type=text],#ed .row select{flex:1;min-width:0}
#ed .tip{color:#9fb08f;font-size:12px;margin:4px 0} #ed .grid{display:flex;flex-wrap:wrap}
#ed .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
#ed .prob{padding:4px 6px;margin:3px 0;border-radius:3px;cursor:pointer} #ed .prob.error{background:#5a1f22} #ed .prob.warning{background:#4a3d1a}
#ed .status{margin-top:6px;color:#d3ca90;min-height:1em} #ed .save{background:#3d5a2c;font-weight:bold;padding:6px 12px}
#ed .dirty{color:#e8a86a}
`;

export class EditorPanel {
    private el: HTMLDivElement;
    status = '';

    constructor(private actions: PanelActions) {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        this.el = document.createElement('div');
        this.el.id = 'ed';
        document.body.appendChild(this.el);
        // one delegated listener for clicks, one for committed input changes
        this.el.addEventListener('click', e => this.onClick(e));
        this.el.addEventListener('change', e => this.onChange(e));
    }

    private onClick(e: Event) {
        const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
        if (!t) return;
        const a = this.actions, v = t.dataset.v ?? '';
        switch (t.dataset.a) {
            case 'tool': a.tool(v as Tool); break;
            case 'tpl': a.template(v); break;
            case 'ground': a.ground(v as Ground); break;
            case 'brush': a.brush(Number(v)); break;
            case 'rotate': a.rotate(); break;
            case 'remove': a.remove(); break;
            case 'undo': a.undo(); break;
            case 'redo': a.redo(); break;
            case 'save': a.save(); break;
            case 'finish': a.finishPath(); break;
            case 'focus': { const [i, j] = v.split(',').map(Number); a.focus(i, j); break; }
            case 'exitEditor': a.exit(); break;
        }
    }

    private onChange(e: Event) {
        const t = e.target as HTMLInputElement;
        const f = t.dataset.f, a = this.actions;
        if (!f) return;
        const num = Number(t.value);
        switch (f) {
            case 'room': a.switchRoom(t.value as RoomId); break;
            case 'time': a.time(num); break;
            case 'rain': a.rain(t.checked); break;
            case 'w': case 'h': {
                const w = Number((this.el.querySelector('[data-f=w]') as HTMLInputElement).value);
                const h = Number((this.el.querySelector('[data-f=h]') as HTMLInputElement).value);
                a.roomSize(w, h); break;
            }
            case 'name': a.roomName(t.value); break;
            case 'h_px': a.update({ h: Math.max(0, num) }); break;
            case 'z': a.update({ z: num > 0 ? num : undefined }); break;
            case 'color': a.update({ color: parseInt(t.value.slice(1), 16) }); break;
            case 'label': a.update({ label: t.value.trim() || undefined }); break;
            case 'art': a.update({ art: t.value || undefined }); break;
            case 'front': a.update({ front: t.value || undefined }); break;
            case 'elevated': a.update({ elevated: t.checked || undefined }); break;
            case 'glow': a.update({ glow: t.checked || undefined }); break;
            case 'to': a.update({ to: t.value || null }); break;
            case 'si': case 'sj': {
                const si = Number((this.el.querySelector('[data-f=si]') as HTMLInputElement).value);
                const sj = Number((this.el.querySelector('[data-f=sj]') as HTMLInputElement).value);
                a.update({ spawn: { i: si, j: sj } }); break;
            }
            case 'di': case 'dj': {
                const di = Number((this.el.querySelector('[data-f=di]') as HTMLInputElement).value);
                const dj = Number((this.el.querySelector('[data-f=dj]') as HTMLInputElement).value);
                a.resize(di, dj); break;
            }
        }
    }

    render(m: EditorModel, hours: number, raining: boolean) {
        const r = m.room, tool = TOOLS.find(t => t.id === m.tool)!;
        const btn = (a: string, v: string, label: string, on = false, extra = '') =>
            `<button data-a="${a}" data-v="${esc(v)}" class="${on ? 'on' : ''}" ${extra}>${label}</button>`;
        let h = `<h2>🛠 Map editor ${m.dirty ? '<span class="dirty">● ยังไม่บันทึก</span>' : ''}</h2>
<div class="row"><label>ห้อง</label><select data-f="room">${ROOM_IDS.map(id =>
            `<option value="${id}" ${id === r.id ? 'selected' : ''}>${esc(id === r.id ? r.name : ROOMS[id].name)} (${id})</option>`).join('')}</select></div>
<div>${btn('undo', '', '↶ ย้อน', false, m.canUndo ? '' : 'disabled')}${btn('redo', '', '↷ ทำซ้ำ', false, m.canRedo ? '' : 'disabled')}
<button data-a="save" class="save" ${m.hasErrors || !m.dirty ? 'disabled' : ''}>💾 บันทึก</button></div>
<div class="status">${esc(this.status)}</div>
<h3>เครื่องมือ</h3><div class="grid">${TOOLS.map(t => btn('tool', t.id, `${t.key} ${t.name}`, t.id === m.tool)).join('')}</div>
<div class="tip">${tool.tip}</div>`;

        if (m.tool === 'place') h += `<h3>ของที่วางได้</h3><div class="grid">${CATALOG.map(t =>
            btn('tpl', t.id, `${esc(t.name)}`, m.template?.id === t.id)).join('')}</div>`;
        if (m.tool === 'paint') h += `<h3>ชนิดพื้น</h3><div class="grid">${GROUNDS.map(g =>
            btn('ground', g.g, `<span class="sw" style="background:${g.color}"></span>${g.name}`, m.paintGround === g.g)).join('')}</div>
<div class="row"><label>แปรง</label>${[1, 3, 5].map(n => btn('brush', String(n), `${n}×${n}`, m.brush === n)).join('')}</div>`;
        if (m.tool === 'walkway') h += `<div class="tip">จุดที่วางแล้ว: ${m.path?.length ?? 0}</div>${btn('finish', '', '✔ จบเส้นนี้ (Enter)', false, (m.path?.length ?? 0) >= 2 ? '' : 'disabled')}`;

        const b = m.selectedBox, e = m.selectedExit;
        if (b) {
            h += `<h3>ของที่เลือก</h3>
<div class="row"><label>ชื่อ/ป้าย</label><input type="text" data-f="label" value="${esc(b.label ?? '')}" placeholder="(ไม่มี)"></div>
<div class="row"><label>ขนาด (ช่อง)</label><input type="number" data-f="di" min="1" value="${b.i1 - b.i0 + 1}"> × <input type="number" data-f="dj" min="1" value="${b.j1 - b.j0 + 1}"></div>
<div class="row"><label>สูง (px)</label><input type="number" data-f="h_px" min="0" value="${b.h}"></div>
<div class="row"><label>ลอยจากพื้น</label><input type="number" data-f="z" min="0" value="${b.z ?? 0}"></div>
<div class="row"><label>สี</label><input type="color" data-f="color" value="${hexColor(b.color)}"></div>
<div class="row"><label>ภาพ</label><select data-f="art">${ARTS.map(a => `<option value="${a}" ${(b.art ?? '') === a ? 'selected' : ''}>${a || '(กล่องเทา)'}</option>`).join('')}</select></div>
<div class="row"><label>หน้าร้าน</label><select data-f="front">
<option value="" ${!b.front ? 'selected' : ''}>(ไม่มี)</option><option value="left" ${b.front === 'left' ? 'selected' : ''}>ซ้ายล่าง ↙</option><option value="right" ${b.front === 'right' ? 'selected' : ''}>ขวาล่าง ↘</option></select></div>
<div class="row"><label>ลอยฟ้า</label><input type="checkbox" data-f="elevated" ${b.elevated ? 'checked' : ''}> <span class="tip">ไม่กั้นทางเดิน วาดทับผู้เล่น</span></div>
<div class="row"><label>ไฟหน้าร้าน</label><input type="checkbox" data-f="glow" ${b.glow ? 'checked' : ''}></div>
<div>${btn('rotate', '', '⟳ หมุน (R)')}${btn('remove', '', '🗑 ลบ (Del)')}</div>`;
        } else if (e) {
            h += `<h3>ทางออกที่เลือก</h3>
<div class="row"><label>ป้าย</label><input type="text" data-f="label" value="${esc(e.label)}"></div>
<div class="row"><label>ไปห้อง</label><select data-f="to"><option value="" ${!e.to ? 'selected' : ''}>(ปิด · เร็ว ๆ นี้)</option>${ROOM_IDS.filter(id => id !== r.id).map(id =>
                `<option value="${id}" ${e.to === id ? 'selected' : ''}>${esc(ROOMS[id].name)}</option>`).join('')}</select></div>
<div class="row"><label>เกิดที่ i, j</label><input type="number" data-f="si" value="${e.spawn?.i ?? 0}"> <input type="number" data-f="sj" value="${e.spawn?.j ?? 0}"></div>
<div class="tip">ตำแหน่งที่ผู้เล่นโผล่ในห้องปลายทาง</div>
<div class="row"><label>ขนาด (ช่อง)</label><input type="number" data-f="di" min="1" value="${e.i1 - e.i0 + 1}"> × <input type="number" data-f="dj" min="1" value="${e.j1 - e.j0 + 1}"></div>
<div>${btn('remove', '', '🗑 ลบทางออก')}</div>`;
        } else if (m.selection?.kind === 'walkway') {
            h += `<h3>ทางคนเดินที่เลือก</h3><div>${btn('remove', '', '🗑 ลบเส้นนี้')}</div>`;
        }

        const problems = m.problems;
        h += `<h3>ตรวจห้อง ${problems.length ? `(${problems.length})` : '✓'}</h3>` + (problems.length
            ? problems.map(p => `<div class="prob ${p.level}" ${p.at ? `data-a="focus" data-v="${p.at.i},${p.at.j}"` : ''}>${p.level === 'error' ? '⛔' : '⚠'} ${esc(p.message)}</div>`).join('')
            : '<div class="tip">ไม่มีปัญหา</div>');

        h += `<h3>ห้อง</h3>
<div class="row"><label>ชื่อ</label><input type="text" data-f="name" value="${esc(r.name)}"></div>
<div class="row"><label>ขนาด</label><input type="number" data-f="w" min="4" max="64" value="${r.w}"> × <input type="number" data-f="h" min="4" max="64" value="${r.h}"></div>
<h3>ดูตามเวลา</h3>
<div class="row"><label>${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}</label><input type="range" data-f="time" min="0" max="23.75" step="0.25" value="${hours}" style="flex:1"></div>
<div class="row"><label>ฝน</label><input type="checkbox" data-f="rain" ${raining ? 'checked' : ''}></div>
<h3>ปุ่มลัด</h3><div class="tip">1–7 เครื่องมือ · Ctrl+Z / Ctrl+Y · Ctrl+S บันทึก · WASD / ลากเมาส์ขวา เลื่อนกล้อง · ล้อเมาส์ ซูม</div>
<div style="margin-top:10px">${btn('exitEditor', '', '▶ ออกไปเล่น')}</div>`;
        this.el.innerHTML = h;
    }

    destroy() { this.el.remove(); }
}
