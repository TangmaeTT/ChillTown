import { Game as MainGame } from './scenes/Game';
import { UI } from './scenes/UI';
import { AUTO, Game, Scale, Types } from 'phaser';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 960,
    height: 540,
    parent: 'game-container',
    backgroundColor: '#0b0f12',
    pixelArt: true,          // nearest-neighbour scaling: keeps pixels crisp
    roundPixels: true,
    scale: {
        // EXPAND: never smaller than 960x540, and widens/heightens to fill any screen shape (no black bars on phones)
        mode: Scale.EXPAND,
        autoCenter: Scale.CENTER_BOTH,
        fullscreenTarget: 'app'
    },
    scene: [MainGame, UI]
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
