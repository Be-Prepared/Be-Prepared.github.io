import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        emptyOutDir: true,
        outDir: "../dist",
        target: "esnext"
    },
    clearScreen: false,
    root: 'site',
    server: {
        host: true,
        port: 8080,
        strictPort: true
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
        }),
    ],
});
