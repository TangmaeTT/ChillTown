import { Scene, Math as PMath } from 'phaser';
import type { RoomId } from '@shared/rooms';
import { world, tickClock } from '../model/WorldModel';
import { RoomModel, roomFromUrl } from '../model/RoomModel';
import { PlayerModel } from '../model/PlayerModel';
import { makeSharedTextures } from '../view/art/textures';
import { RoomView } from '../view/RoomView';
import { PlayerView, PLAYER_SHEET } from '../view/PlayerView';
import { LightingView } from '../view/LightingView';
import { Occluders } from '../view/Occluders';
import { InputController } from './InputController';

type RoomData = { room?: RoomId; spawn?: { i: number; j: number }; facing?: number };

// The world scene. Owns this room's models and views, runs the per-frame loop, and handles moving
// between rooms. Restarted (scene.restart) on every room change, so all per-room state is built in create().
export class GameController extends Scene {
    private data0!: RoomData;
    private room!: RoomModel;
    private player!: PlayerModel;
    private playerView!: PlayerView;
    private lighting!: LightingView;
    private occluders!: Occluders;
    private input0!: InputController;
    private leaving = false;

    constructor() { super('Game'); }

    init(data: RoomData) { this.data0 = data; }

    preload() {
        this.load.setPath('assets');
        this.load.image('noodle_shop', 'noodle_shop.png');
        this.load.spritesheet(PLAYER_SHEET.key, PLAYER_SHEET.file, { frameWidth: PLAYER_SHEET.frame, frameHeight: PLAYER_SHEET.frame });
    }

    create() {
        makeSharedTextures(this);
        this.leaving = false;

        // --- models
        this.room = new RoomModel(this.data0.room ?? roomFromUrl());
        world.roomName = this.room.room.name;
        const spawn = this.data0.spawn ?? this.room.room.spawn;
        const p = this.room.grid.toWorld(spawn.i, spawn.j);
        this.player = new PlayerModel(p.x, p.y, this.data0.facing);

        // --- views
        this.lighting = new LightingView(this);
        this.occluders = new Occluders();
        new RoomView(this, this.room, this.lighting, this.occluders);
        this.playerView = new PlayerView(this, this.player, 'คุณ');

        // --- camera
        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.room.grid.worldW, this.room.grid.worldH).setZoom(world.zoom).setRoundPixels(true);
        cam.startFollow(this.playerView.gameObject, true, 0.12, 0.12);
        cam.setFollowOffset(0, 50); // look a bit upward so tall buildings fit
        cam.fadeIn(250, 11, 15, 18);

        this.input0 = new InputController(this, this.player);
        if (!this.scene.isActive('UI')) this.scene.launch('UI');
    }

    update(time: number, delta: number) {
        const dt = delta / 1000;
        tickClock(dt);
        this.input0.update();

        // --- model
        this.player.update(dt, this.input0.moveVector(!this.leaving), (x, y) => this.room.walkable(x, y));
        if (this.player.moving) this.checkExit();

        // --- view
        const t = this.room.tileAt(this.player.x, this.player.y);
        const depth = this.occluders.update(this.player.x, this.player.y, t.i, t.j);
        this.playerView.sync(this.player, depth);
        this.lighting.update(time);
        const cam = this.cameras.main;
        if (Math.abs(cam.zoom - world.zoom) > 0.001) cam.setZoom(PMath.Linear(cam.zoom, world.zoom, 0.25));
    }

    private checkExit() {
        if (this.leaving) return;
        const e = this.room.exitAt(this.player.x, this.player.y);
        if (!e) return;
        this.leaving = true;
        this.player.target = null;
        const cam = this.cameras.main;
        cam.fadeOut(250, 11, 15, 18);
        cam.once('camerafadeoutcomplete', () =>
            this.scene.restart({ room: e.to!, spawn: e.spawn, facing: this.player.facing } satisfies RoomData));
    }
}
