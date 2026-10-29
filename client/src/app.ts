import { AUTO, Game, Scale, Types } from 'phaser';
import { GameController } from './controller/GameController';
import { HudScene } from './view/HudScene';
import { AvatarEditorController } from './controller/AvatarEditorController';

// Phaser bootstrap. Code layout: model/ (state, no Phaser) · view/ (drawing) · controller/ (input + loop),
// plus ../../shared (room layouts, collision, clock) used by the server too.

// Pixel-perfect scaling: one game pixel is always a whole number of DEVICE pixels (2, 3, ...), never 1.45,
// or pixel art comes out uneven (some pixels doubled, some not). The game is drawn at the screen size divided
// by that number, so it still fills any screen shape (phones, wide monitors) with no black bars.
const TARGET_H = 540;       // about this many game pixels tall

function fit() {
    const box = document.getElementById('game-container')!, dpr = window.devicePixelRatio || 1;
    const w = box.clientWidth * dpr, h = box.clientHeight * dpr;
    const px = Math.max(1, Math.round(h / TARGET_H));     // device pixels per game pixel
    return { width: Math.ceil(w / px), height: Math.ceil(h / px), zoom: px / dpr };
}

const config = (): Types.Core.GameConfig => {
    const { width, height, zoom } = fit();
    return {
        type: AUTO,
        width, height,
        parent: 'game-container',
        backgroundColor: '#0b0f12',
        pixelArt: true,          // nearest-neighbour scaling: keeps pixels crisp
        roundPixels: true,
        scale: { mode: Scale.NONE, zoom, fullscreenTarget: 'app' },
        // ?avatar=1 opens the avatar editor instead of the world
        scene: new URLSearchParams(location.search).get('avatar') === '1' ? [AvatarEditorController] : [GameController, HudScene]
    };
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config(), parent });
    const refit = () => {
        const { width, height, zoom } = fit();
        game.scale.setZoom(zoom);
        game.scale.resize(width, height);
    };
    window.addEventListener('resize', refit);
    document.addEventListener('fullscreenchange', () => setTimeout(refit, 50));
    return game;
};

export default StartGame;
