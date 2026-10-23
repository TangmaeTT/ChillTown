import { Scene, GameObjects } from 'phaser';
import { world, timeLabel, phaseLabel } from '../model/WorldModel';
import * as actions from '../controller/actions';

// HUD + rain, drawn at screen resolution (no camera zoom). Buttons only call controller actions.
export class HudScene extends Scene {
    clock!: GameObjects.Text;
    rainBtn!: GameObjects.Text;
    speedBtn!: GameObjects.Text;
    fsBtn!: GameObjects.Text;
    hint!: GameObjects.Text;
    roomLabel!: GameObjects.Text;
    zoomBtns!: GameObjects.Text[];
    rain!: GameObjects.Graphics;
    drops: { x: number; y: number; l: number; s: number }[] = [];
    splashes: { x: number; y: number; t: number }[] = [];

    constructor() { super('UI'); }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.rain = this.add.graphics().setDepth(0);
        for (let k = 0; k < 170; k++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, l: 10 + Math.random() * 10, s: 520 + Math.random() * 260 });

        const font = { fontFamily: 'Tahoma, "Leelawadee UI", sans-serif', fontSize: '16px', color: '#e9eed8', resolution: 2 };
        this.add.rectangle(14, 14, 290, 74, 0x0e1014, 0.78).setOrigin(0).setStrokeStyle(2, 0x2c3a2a).setDepth(10);
        this.clock = this.add.text(26, 22, '', { ...font, fontSize: '18px' }).setDepth(11);
        this.rainBtn = this.add.text(26, 54, '', { ...font, fontSize: '14px', backgroundColor: '#25301f', padding: { x: 8, y: 4 } })
            .setDepth(11).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => { actions.toggleRain(); this.refresh(); });
        this.speedBtn = this.add.text(140, 54, '', { ...font, fontSize: '14px', backgroundColor: '#25301f', padding: { x: 8, y: 4 } })
            .setDepth(11).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => { actions.toggleFastForward(); this.refresh(); });
        // full screen: Android/desktop browsers. iPhone Safari has no Fullscreen API -> install to home screen instead
        this.fsBtn = this.add.text(252, 54, '⛶', { ...font, fontSize: '14px', backgroundColor: '#25301f', padding: { x: 8, y: 4 } })
            .setDepth(11).setInteractive({ useHandCursor: true })
            .on('pointerup', () => actions.toggleFullscreen(this));
        this.fsBtn.setVisible(this.sys.game.device.fullscreen.available);
        this.hint = this.add.text(W / 2, H - 14, 'คลิก/แตะเพื่อเดิน · WASD หรือปุ่มลูกศร', { ...font, fontSize: '13px', color: '#9fb08f' })
            .setOrigin(0.5, 1).setDepth(11);
        this.roomLabel = this.add.text(W / 2, 18, '', { ...font, fontSize: '15px', backgroundColor: '#0e1014cc', padding: { x: 10, y: 4 } })
            .setOrigin(0.5, 0).setDepth(11);
        // zoom buttons, bottom-right (thumb reach on phones)
        const zb = { ...font, fontSize: '20px', backgroundColor: '#0e1014cc', padding: { x: 12, y: 2 }, fixedWidth: 44, align: 'center' };
        this.zoomBtns = [
            this.add.text(0, 0, '－', zb).setInteractive({ useHandCursor: true }).on('pointerdown', () => actions.zoom(1 / 1.25)),
            this.add.text(0, 0, '＋', zb).setInteractive({ useHandCursor: true }).on('pointerdown', () => actions.zoom(1.25)),
        ];
        this.zoomBtns.forEach(b => b.setOrigin(1, 1).setDepth(11));
        const placeZoom = () => this.zoomBtns.forEach((b, k) => b.setPosition(this.scale.width - 14 - (1 - k) * 52, this.scale.height - 14));
        placeZoom();
        this.scale.on('resize', placeZoom);
        this.scale.on('resize', () => {
            this.hint.setPosition(this.scale.width / 2, this.scale.height - 14);
            this.roomLabel.setPosition(this.scale.width / 2, 18);
        });
        this.refresh();
    }

    refresh() {
        this.rainBtn.setText(world.raining ? '☂ ฝน: ตก' : '☀ ฝน: หยุด');
        this.speedBtn.setText(world.speed === 1 ? '⏩ เร่งเวลา' : '▶ เวลาปกติ');
    }

    update(_t: number, delta: number) {
        const dt = delta / 1000, W = this.scale.width, H = this.scale.height;
        this.clock.setText(`วันที่ ${world.day} · ${timeLabel()} · ${phaseLabel()}`);
        this.roomLabel.setText(`📍 ${world.roomName}`);
        const g = this.rain; g.clear();
        if (!world.raining) return;
        g.lineStyle(2, 0xb4c8dc, 0.35);
        for (const d of this.drops) {
            d.y += d.s * dt; d.x -= d.s * 0.18 * dt;
            if (d.y > H) {
                if (Math.random() < 0.5) this.splashes.push({ x: d.x, y: H * (0.25 + Math.random() * 0.75), t: 0 });
                d.y = -20; d.x = Math.random() * (W + 120);
            }
            g.lineBetween(Math.round(d.x), Math.round(d.y), Math.round(d.x - d.l * 0.18), Math.round(d.y - d.l));
        }
        g.fillStyle(0xc8d8e6, 0.45);
        this.splashes = this.splashes.filter(s => (s.t += dt) < 0.25);
        for (const s of this.splashes) { const r = 2 + s.t * 16; g.fillRect(s.x - r, s.y, 2, 2); g.fillRect(s.x + r, s.y, 2, 2); g.fillRect(s.x, s.y - r * 0.4, 2, 2); }
    }
}
