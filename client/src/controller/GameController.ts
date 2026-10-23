import { Scene, Math as PMath } from 'phaser';
import type { RoomId } from '@shared/rooms';
import { world, tickClock } from '../model/WorldModel';
import { RoomModel, roomFromUrl } from '../model/RoomModel';
import { PlayerModel } from '../model/PlayerModel';
import { TrainModel } from '../model/TrainModel';
import { TrafficModel } from '../model/TrafficModel';
import { NpcModel } from '../model/NpcModel';
import { SKYTRAIN } from '@shared/skytrain';
import { makeSharedTextures } from '../view/art/textures';
import { makeGroundTextures } from '../view/art/ground';
import { SkytrainView } from '../view/SkytrainView';
import { TrafficView } from '../view/TrafficView';
import { NpcView, NPC_TINTS } from '../view/NpcView';
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
    // skytrain scenery (station plaza only)
    private trains: TrainModel | null = null;
    private traffic: TrafficModel | null = null;
    private trainView: SkytrainView | null = null;
    private trafficView: TrafficView | null = null;
    private npcs: NpcModel | null = null;
    private npcView: NpcView | null = null;

    constructor() { super('Game'); }

    init(data: RoomData) { this.data0 = data; }

    preload() {
        this.load.setPath('assets');
        this.load.image('noodle_shop', 'noodle_shop.png');
        this.load.spritesheet(PLAYER_SHEET.key, PLAYER_SHEET.file, { frameWidth: PLAYER_SHEET.frame, frameHeight: PLAYER_SHEET.frame });
    }

    create() {
        makeSharedTextures(this);
        makeGroundTextures(this);
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
        if (this.room.room.scenery === 'skytrain') {
            this.trains = new TrainModel();
            this.traffic = new TrafficModel(world.minutes);
            this.trainView = new SkytrainView(this, this.room.grid, this.lighting, this.occluders);
            this.trafficView = new TrafficView(this, this.room.grid, this.lighting);
        } else this.trains = this.traffic = this.trainView = this.trafficView = null;
        const routes = this.room.room.walkways;
        this.npcs = routes ? new NpcModel(routes, world.minutes, NPC_TINTS.length) : null;
        this.npcView = routes ? new NpcView(this, this.room.grid) : null;

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
        this.trains?.update(dt);
        this.npcs?.update(dt, world.minutes);
        this.traffic?.update(dt, world.minutes, this.onCrosswalk());

        // --- view
        const t = this.room.tileAt(this.player.x, this.player.y);
        const depth = this.occluders.update(this.player.x, this.player.y, t.i, t.j);
        this.playerView.sync(this.player, depth);
        this.lighting.update(time);
        if (this.trains) this.trainView!.update(this.trains);
        if (this.traffic) this.trafficView!.update(this.traffic);
        if (this.npcs) this.npcView!.update(this.npcs);
        const cam = this.cameras.main;
        if (Math.abs(cam.zoom - world.zoom) > 0.001) cam.setZoom(PMath.Linear(cam.zoom, world.zoom, 0.25));
    }

    /** someone (the player or a pedestrian) is on the zebra crossing: cars wait */
    private onCrosswalk() {
        const t = this.room.tileAt(this.player.x, this.player.y), cw = SKYTRAIN.crosswalk, d = SKYTRAIN.deck;
        const i0 = cw.i0 - 0.3, i1 = cw.i1 + 0.3, j0 = d.j0 - 0.6, j1 = d.j1 + 0.6;
        return (t.fi > i0 && t.fi < i1 && t.fj > j0 && t.fj < j1) || !!this.npcs?.anyIn(i0, i1, j0, j1);
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
