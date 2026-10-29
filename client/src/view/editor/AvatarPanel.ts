// Avatar editor side panel (plain DOM on top of the canvas). Draws the editor model; every input calls an action.
import { SKIN_TONES, HAIR_COLORS, ITEM_COLORS, CLOTH_COLORS, TOPS, BOTTOMS, VIEWS, MAX_OFFSET } from '@shared/avatar';
import type { AvatarEditorModel } from '../../model/AvatarEditorModel';

export type AvatarActions = {
    select(id: string): void; wear(id: string, on: boolean): void;
    view(v: number): void; offset(x: number, y: number): void; mirror(): void; reset(): void;   // offset/mirror/reset: selected part, current view
    colour(which: 'skin' | 'hair' | 'item', n: number): void;
    garment(field: 'top' | 'bottom', id: string): void; clothColour(field: 'topColor' | 'bottomColor' | 'shoes', n: number): void;
    sway(key: 'stiffness' | 'damping' | 'gain', value: number): void;
    play(on: boolean): void; previewRow(r: number): void;
    undo(): void; redo(): void; save(): void;
};

const SLOT_TH: Record<string, string> = { hairBack: 'ผมหลัง', face: 'หน้า', hairFront: 'ผมหน้า', glasses: 'แว่น', hat: 'หมวก' };
const VIEW_TH = ['↘ SE', '↙ SW', '↖ NW', '↗ NE'];
const SWAY_UI = [
    { key: 'stiffness', name: 'ความแข็ง', min: 5, max: 150, step: 1 },
    { key: 'damping', name: 'ความหน่วง', min: 0.5, max: 25, step: 0.5 },
    { key: 'gain', name: 'แรงขับ', min: 0, max: 2, step: 0.05 },
] as const;
const ROWS_TH = ['→ E', '↘ SE', '↓ S', '↙ SW', '← W', '↖ NW', '↑ N', '↗ NE'];

const CSS = `
#av{position:fixed;top:0;right:0;width:300px;height:100%;overflow-y:auto;background:#0e1014ee;color:#e9eed8;
 font:13px Tahoma,"Leelawadee UI",sans-serif;border-left:2px solid #2c3a2a;z-index:10;box-sizing:border-box;padding:10px 12px 40px}
#av h2{font-size:15px;margin:2px 0 8px} #av h3{font-size:12px;color:#9fb08f;margin:14px 0 6px;font-weight:normal;text-transform:uppercase;letter-spacing:.05em}
#av button{background:#25301f;color:#e9eed8;border:1px solid #3a4a34;border-radius:4px;padding:4px 7px;margin:2px;cursor:pointer;font:inherit}
#av button:hover{background:#34452c} #av button.on{background:#d3ca90;color:#14160f;border-color:#d3ca90}
#av button:disabled{opacity:.4;cursor:default}
#av input,#av select{background:#1a1f1a;color:#e9eed8;border:1px solid #3a4a34;border-radius:3px;padding:3px 5px;font:inherit;box-sizing:border-box}
#av .row{display:flex;align-items:center;gap:6px;margin:4px 0} #av .row input[type=number]{width:56px}
#av .part{display:flex;align-items:center;gap:6px;margin:2px 0} #av .part .slot{color:#9fb08f;font-size:12px;margin-left:auto}
#av .tip{color:#9fb08f;font-size:12px;margin:4px 0} #av .sw{width:22px;height:22px;padding:0;border-radius:4px}
#av .sw.on{outline:2px solid #d3ca90;outline-offset:1px}
#av .status{margin-top:6px;color:#d3ca90;min-height:1em} #av .save{background:#3d5a2c;font-weight:bold;padding:6px 12px}
#av .dirty{color:#e8a86a}
`;

export class AvatarPanel {
    private el: HTMLDivElement;
    status = '';

    constructor(private actions: AvatarActions) {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        this.el = document.createElement('div');
        this.el.id = 'av';
        document.body.appendChild(this.el);
        this.el.addEventListener('click', e => this.click(e));
        this.el.addEventListener('change', e => this.change(e));
    }

    render(m: AvatarEditorModel) {
        const p = m.part;
        const cloth = (field: 'topColor' | 'bottomColor' | 'shoes') => CLOTH_COLORS.map((r, n) =>
            `<button class="sw${m.look[field] === n ? ' on' : ''}" data-cloth="${field}" data-n="${n}" style="background:${r[2]}" title="${n}"></button>`).join('');
        const swatches = (which: 'skin' | 'hair' | 'item', ramps: string[][]) => ramps.map((r, n) =>
            `<button class="sw${m.look[which] === n ? ' on' : ''}" data-colour="${which}" data-n="${n}" style="background:${r[2]}" title="${n}"></button>`).join('');
        this.el.innerHTML = `
<h2>Avatar editor ${m.dirty ? '<span class="dirty">● ยังไม่บันทึก</span>' : ''}</h2>
<div class="row">
  <button data-act="undo" ${m.canUndo ? '' : 'disabled'}>↶ ย้อน</button>
  <button data-act="redo" ${m.canRedo ? '' : 'disabled'}>↷ ทำซ้ำ</button>
  <button class="save" data-act="save">บันทึก</button>
</div>
<div class="status">${this.status}</div>

<h3>ชิ้นส่วน</h3>
${m.parts.map(q => `<div class="part">
  <input type="checkbox" data-wear="${q.id}" ${m.look.parts.includes(q.id) ? 'checked' : ''} title="ใส่/ถอด">
  <button class="${q.id === m.selected ? 'on' : ''}" data-select="${q.id}">${q.id}</button>
  <span class="slot">${SLOT_TH[q.slot] ?? q.slot}${q.tint ? ' · ย้อมสี' + (q.tint === 'hair' ? 'ผม' : 'ของ') : ''}${q.blink ? ' · กะพริบ' : ''}</span>
</div>`).join('')}

<h3>ตำแหน่ง ${p ? `· ${p.id}` : ''}</h3>
${p ? `
<div class="row">${VIEWS.map((_, v) => `<button class="${m.view === v ? 'on' : ''}" data-view="${v}">${VIEW_TH[v]}<br><small>${p.offset[v][0]}, ${p.offset[v][1]}</small></button>`).join('')}</div>
<div class="row">x <input type="number" data-off="x" value="${p.offset[m.view][0]}" min="-${MAX_OFFSET}" max="${MAX_OFFSET}">
 y <input type="number" data-off="y" value="${p.offset[m.view][1]}" min="-${MAX_OFFSET}" max="${MAX_OFFSET}"></div>
<div class="row"><button data-act="mirror">คัดลอกไปทิศกระจก</button><button data-act="reset">รีเซ็ตทุกทิศ</button></div>
<div class="tip">ลากชิ้นบนตัวละคร หรือกดลูกศร (Shift = 4 px) · 1–4 เลือกทิศ</div>` : '<div class="tip">เลือกชิ้นส่วนก่อน</div>'}

${p?.sway ? `<h3>ฟิสิกส์ · ${p.id}</h3>
${SWAY_UI.map(s => `<div class="row"><label style="width:70px">${s.name}</label>
  <input type="range" data-sway="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${p.sway![s.key]}" style="flex:1">
  <span style="width:34px;text-align:right">${p.sway![s.key]}</span></div>`).join('')}
<div class="tip">${p.sway.poses} ท่า · กด ▶ ให้ตัวอย่างวิ่ง แล้ว ❚❚ ให้หยุด ดูหางแกว่งกลับ · เลือกทิศ → หรือ ← จะเห็นชัด</div>` : ''}

<h3>เสื้อผ้า</h3>
<div class="row">เสื้อ</div><div>${TOPS.map(x => `<button class="${m.look.top === x.id ? 'on' : ''}" data-top="${x.id}">${x.name}</button>`).join('')}</div>
<div>${cloth('topColor')}</div>
<div class="row">กางเกง</div><div>${BOTTOMS.map(x => `<button class="${m.look.bottom === x.id ? 'on' : ''}" data-bottom="${x.id}">${x.name}</button>`).join('')}</div>
<div>${cloth('bottomColor')}</div>
<div class="row">รองเท้า</div><div>${cloth('shoes')}</div>

<h3>สี</h3>
<div class="row">ผิว</div><div>${swatches('skin', SKIN_TONES)}</div>
<div class="row">ผม</div><div>${swatches('hair', HAIR_COLORS)}</div>
<div class="row">ของ</div><div>${swatches('item', ITEM_COLORS)}</div>

<h3>ตัวอย่างท่า</h3>
<div class="row">
  <button class="${m.playing ? 'on' : ''}" data-act="play">${m.playing ? '❚❚ หยุด' : '▶ เล่น'}</button>
  <select data-row>${ROWS_TH.map((t, r) => `<option value="${r}" ${m.previewRow === r ? 'selected' : ''}>${t}</option>`).join('')}</select>
</div>
<div class="tip">Space เล่น/หยุด · Ctrl+Z / Ctrl+Y ย้อน/ทำซ้ำ · Ctrl+S บันทึก</div>
<div class="tip">บันทึกลง shared/parts.json (ต้องเปิด server: cd server && npm run dev)</div>`;
    }

    private click(e: Event) {
        const t = (e.target as HTMLElement).closest('button, input[type=checkbox]') as HTMLElement | null;
        if (!t) return;
        const d = t.dataset, a = this.actions;
        if (d.wear) a.wear(d.wear, (t as HTMLInputElement).checked);
        else if (d.select) a.select(d.select);
        else if (d.view) a.view(Number(d.view));
        else if (d.colour) a.colour(d.colour as 'skin' | 'hair' | 'item', Number(d.n));
        else if (d.cloth) a.clothColour(d.cloth as 'topColor' | 'bottomColor' | 'shoes', Number(d.n));
        else if (d.top) a.garment('top', d.top);
        else if (d.bottom) a.garment('bottom', d.bottom);
        else if (d.act === 'undo') a.undo();
        else if (d.act === 'redo') a.redo();
        else if (d.act === 'save') a.save();
        else if (d.act === 'mirror') a.mirror();
        else if (d.act === 'reset') a.reset();
        else if (d.act === 'play') a.play(!t.classList.contains('on'));
    }

    private change(e: Event) {
        const t = e.target as HTMLInputElement | HTMLSelectElement;
        if (t.dataset.row !== undefined) this.actions.previewRow(Number(t.value));
        else if (t.dataset.sway) this.actions.sway(t.dataset.sway as 'stiffness' | 'damping' | 'gain', Number(t.value));
        else if (t.dataset.off) {
            const ins = this.el.querySelectorAll<HTMLInputElement>('input[data-off]');
            this.actions.offset(Number(ins[0].value) || 0, Number(ins[1].value) || 0);
        }
    }
}
