import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// code shared with the server (room layouts, collision, clock)
const shared = fileURLToPath(new URL('../../shared', import.meta.url));

export default defineConfig({
    base: './',
    resolve: { alias: { '@shared': shared } },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080,
        host: true,  // also serve on the local network so phones on the same Wi-Fi can open the game
        fs: { allow: ['..', shared] }
    }
});
