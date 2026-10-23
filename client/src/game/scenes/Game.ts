import { Scene, GameObjects, BlendModes, Math as PMath, Input } from 'phaser';
import { MAP_W, MAP_H, WORLD_W, WORLD_H, setMapSize, tileToWorld, worldToTile } from '../iso';
import { makeGroundTiles, makeLamp, makeGlow, makeHalo, makePuddle } from '../textures';
import { world, nightFactor, zoomBy } from '../world';
import { ROOMS, Room, RoomId, BLOCKING_GROUND } from '../rooms';
import { drawGround, drawBox, drawExit, groundAt, corners, DrawnBox } from '../blockout';

// player.png (PixelLab): 68x68 frames, col 0 = standing, cols 1-8 = walk cycle;
// rows clockwise from screen angle: E, SE, S, SW, W, NW, N, NE
const PLAYER_FRAME = 68, WALK_FRAMES = 8, FEET_Y = 60;

type RoomData = { room?: RoomId; spawn?: { i: number; j: number }; facing?: number };

export class Game extends Scene {
    room!: Room;
    spawn!: { i: number; j: number };
    player!: GameObjects.Sprite;
    nameTag!: GameObjects.Text;
    overlay!: GameObjects.Rectangle;
    glows: { img: GameObjects.Image; base: number; phase: number }[] = [];
    solids: DrawnBox[] = [];      // boxes the player can walk behind / in front of
    roofs: DrawnBox[] = [];       // elevated structures that fade when the player is under them
    keys!: Record<string, Input.Keyboard.Key>;
    target: { x: number; y: number } | null = null;
    facing = 2; // row in player.png (2 = south)
    walkT = 0;
    blocked = new Set<string>();
    leaving = false;
    pinchDist = 0;

    constructor() { super('Game'); }

    init(data: RoomData) {
        // ?room=soi in the URL jumps straight to a room (testing)
        const fromUrl = new URLSearchParams(location.search).get('room') as RoomId | null;
        this.room = ROOMS[data.room ?? (fromUrl && fromUrl in ROOMS ? fromUrl : 'plaza')];
        this.spawn = data.spawn ?? this.room.spawn;
        if (data.facing !== undefined) this.facing = data.facing;
        // a restarted scene keeps its instance, so reset per-room state here
        this.glows = []; this.solids = []; this.roofs = []; this.blocked = new Set(); this.target = null; this.leaving = false;
        setMapSize(this.room.w, this.room.h);
        world.roomName = this.room.name;
    }

    preload() {
        this.load.setPath('assets');
        this.load.image('noodle_shop', 'noodle_shop.png');
        this.load.spritesheet('player', 'player.png', { frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME });
    }

    create() {
        if (!this.textures.exists('lamp')) {
            makeGroundTiles(this); makeLamp(this); makePuddle(this);
            makeGlow(this, 'glowWarm', 160, [255, 196, 110]);
            makeGlow(this, 'glowShop', 220, [255, 170, 80]);
            makeHalo(this, 'haloWarm', 48, [255, 220, 150]);
        }
        const room = this.room;

        // --- ground: road and water block walking (crosswalks and piers are their own ground types)
        drawGround(this, room);
        for (let i = 0; i < room.w; i++) for (let j = 0; j < room.h; j++)
            if (BLOCKING_GROUND.includes(groundAt(room, i, j))) this.blocked.add(`${i},${j}`);

        // --- buildings (grey blockout boxes, or real art where it exists)
        for (const b of room.boxes) {
            const d = drawBox(this, b);
            if (b.elevated) { this.roofs.push(d); continue; }
            this.solids.push(d);
            for (let i = b.i0; i <= b.i1; i++) for (let j = b.j0; j <= b.j1; j++) this.blocked.add(`${i},${j}`);
            if (b.glow) {
                const c = corners(b).S;
                this.addLight('glowShop', c.x - 70, c.y - 10, 0.9);
                this.addLight('haloWarm', c.x - 120, c.y - 205, 0.8, 1.6);
            }
        }
        for (const e of room.exits) drawExit(this, e);

        // --- lamps
        for (const l of room.lamps) {
            const p = tileToWorld(l.i, l.j);
            this.blocked.add(`${l.i},${l.j}`);
            this.add.image(p.x, p.y + 4, 'lamp').setOrigin(0.5, 1).setDepth(p.y + 4);
            this.addLight('glowWarm', p.x, p.y + 4, 1.0);
            this.addLight('haloWarm', p.x, p.y - 72, 1.0);
        }

        // --- player
        const start = tileToWorld(this.spawn.i, this.spawn.j);
        this.player = this.add.sprite(start.x, start.y, 'player', this.facing * (WALK_FRAMES + 1)).setOrigin(0.5, FEET_Y / PLAYER_FRAME);
        this.nameTag = this.add.text(start.x, start.y - 56, 'คุณ', {
            fontFamily: 'Tahoma, sans-serif', fontSize: '8px', color: '#e8f0c8', resolution: 4,
            stroke: '#0e1014', strokeThickness: 2,
        }).setOrigin(0.5, 1);

        // --- night overlay (multiply) — lights are added on top of it
        this.overlay = this.add.rectangle(0, 0, 4000, 4000, 0xffffff).setScrollFactor(0).setDepth(50000)
            .setBlendMode(BlendModes.MULTIPLY);

        // --- camera
        const cam = this.cameras.main;
        cam.setBounds(0, 0, WORLD_W, WORLD_H).setZoom(world.zoom).setRoundPixels(true);
        cam.startFollow(this.player, true, 0.12, 0.12);
        cam.setFollowOffset(0, 50); // look a bit upward so tall buildings fit
        cam.setBackgroundColor('#0b0f12');
        cam.fadeIn(250, 11, 15, 18);

        // --- input
        this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Input.Keyboard.Key>;
        // zoom: mouse wheel, +/- keys, two-finger pinch (the HUD buttons call zoomBy too)
        this.input.on('wheel', (_p: Input.Pointer, _o: unknown, _dx: number, dy: number) => zoomBy(dy > 0 ? 0.9 : 1.1));
        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') zoomBy(1.15);
            if (e.key === '-' || e.key === '_') zoomBy(1 / 1.15);
        });
        this.input.addPointer(1);
        this.pinchDist = 0;
        this.input.on('pointerdown', (p: Input.Pointer) => {
            if (this.input.pointer2.isDown) { this.target = null; return; } // second finger = pinch, not walk
            if (p.x < 320 && p.y < 100) return; // HUD area
            if (p.x > this.scale.width - 120 && p.y > this.scale.height - 70) return; // zoom buttons
            this.target = { x: p.worldX, y: p.worldY };
        });

        if (!this.scene.isActive('UI')) this.scene.launch('UI');
    }

    addLight(key: string, x: number, y: number, base: number, scale = 1) {
        const img = this.add.image(x, y, key).setBlendMode(BlendModes.ADD).setDepth(50001).setScale(scale);
        this.glows.push({ img, base, phase: Math.random() * 10 });
    }

    updateZoom() {
        const a = this.input.pointer1, b = this.input.pointer2;
        if (a.isDown && b.isDown) {
            const d = PMath.Distance.Between(a.x, a.y, b.x, b.y);
            if (this.pinchDist > 0) zoomBy(d / this.pinchDist);
            this.pinchDist = d;
            this.target = null;
        } else this.pinchDist = 0;
        const cam = this.cameras.main;
        if (Math.abs(cam.zoom - world.zoom) > 0.001) cam.setZoom(PMath.Linear(cam.zoom, world.zoom, 0.25));
    }

    fade(d: DrawnBox, on: boolean, to: number) {
        for (const o of d.objects) o.setAlpha(PMath.Linear(o.alpha, on ? to : 1, 0.15));
    }

    walkable(x: number, y: number) {
        const t = worldToTile(x, y);
        const i = Math.round(t.i), j = Math.round(t.j);
        if (t.i < -0.45 || t.j < -0.45 || t.i > MAP_W - 0.55 || t.j > MAP_H - 0.55) return false;
        return !this.blocked.has(`${i},${j}`);
    }

    checkExits() {
        if (this.leaving) return;
        const t = worldToTile(this.player.x, this.player.y);
        const i = Math.round(t.i), j = Math.round(t.j);
        const e = this.room.exits.find(e => e.to && i >= e.i0 && i <= e.i1 && j >= e.j0 && j <= e.j1);
        if (!e) return;
        this.leaving = true;
        this.cameras.main.fadeOut(250, 11, 15, 18);
        this.cameras.main.once('camerafadeoutcomplete', () =>
            this.scene.restart({ room: e.to!, spawn: e.spawn, facing: this.facing } satisfies RoomData));
    }

    update(time: number, delta: number) {
        const dt = delta / 1000;
        this.updateZoom();
        world.minutes += (delta / 120) * world.speed;
        if (world.minutes >= 1440) { world.minutes -= 1440; world.day++; }

        // --- movement (keyboard has priority over click target)
        let vx = 0, vy = 0;
        const k = this.keys;
        if (!this.leaving) {
            if (k.A.isDown || k.LEFT.isDown) vx -= 1;
            if (k.D.isDown || k.RIGHT.isDown) vx += 1;
            if (k.W.isDown || k.UP.isDown) vy -= 1;
            if (k.S.isDown || k.DOWN.isDown) vy += 1;
            if (vx || vy) this.target = null;
            else if (this.target) {
                const dx = this.target.x - this.player.x, dy = this.target.y - this.player.y;
                if (Math.hypot(dx, dy) < 2) this.target = null; else { vx = dx; vy = dy; }
            }
        }
        const len = Math.hypot(vx, vy);
        const moving = len > 0;
        if (moving) {
            const sp = 70 * dt;
            const mx = (vx / len) * sp, my = (vy / len) * sp;
            const p = this.player;
            if (this.walkable(p.x + mx, p.y + my)) { p.x += mx; p.y += my; }
            else if (this.walkable(p.x + mx, p.y)) p.x += mx;
            else if (this.walkable(p.x, p.y + my)) p.y += my;
            else this.target = null;
            this.facing = PMath.Wrap(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)), 0, 8);
            this.walkT += dt;
            this.checkExits();
        } else this.walkT = 0;
        const frame = moving ? 1 + (Math.floor(this.walkT * 10) % WALK_FRAMES) : 0;
        this.player.setFrame(this.facing * (WALK_FRAMES + 1) + frame);

        // --- depth: behind a building while the player's tile isn't past its front faces
        const t = worldToTile(this.player.x, this.player.y);
        const ti = Math.round(t.i), tj = Math.round(t.j);
        let depth = this.player.y, lo = -Infinity, hi = Infinity;
        for (const s of this.solids) {
            const overlaps = this.player.x > s.left - 12 && this.player.x < s.right + 12 && this.player.y < s.bottom + 4;
            const inFront = ti > s.box.i1 || tj > s.box.j1;
            if (overlaps) { if (inFront) lo = Math.max(lo, s.depth + 1); else hi = Math.min(hi, s.depth - 1); }
            // see-through while it hides the player
            this.fade(s, overlaps && !inFront && this.player.y - 40 > s.top, 0.4);
        }
        if (depth < lo) depth = lo;
        if (depth > hi) depth = hi;
        this.player.setDepth(depth);
        this.nameTag.setPosition(Math.round(this.player.x), Math.round(this.player.y - 56)).setDepth(depth + 0.5);

        // --- roofs/skytrain: see-through while drawn over the player (under it, or just behind it on screen)
        for (const r of this.roofs) {
            const covered = this.player.x > r.left - 8 && this.player.x < r.right + 8 && this.player.y - 40 < r.bottom && this.player.y > r.top;
            this.fade(r, covered, 0.3);
        }

        // --- lighting
        const n = nightFactor();
        const dusk = Math.max(0, 1 - Math.abs(n - 0.45) / 0.45); // orange-purple band at sunset
        const day = new PMath.Vector3(255, 255, 255), night = new PMath.Vector3(70, 92, 128), sunset = new PMath.Vector3(205, 150, 150);
        const c = day.clone().lerp(night, n).lerp(sunset, dusk * 0.35);
        this.overlay.setFillStyle((Math.round(c.x) << 16) | (Math.round(c.y) << 8) | Math.round(c.z));
        for (const l of this.glows) {
            const flicker = 0.92 + 0.08 * Math.sin(time / 90 + l.phase) * Math.sin(time / 37 + l.phase * 2);
            l.img.setAlpha(Math.min(1, n * 1.3) * l.base * flicker);
        }
    }

}
