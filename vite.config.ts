import { defineConfig } from 'vite';
import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
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
        minifyLiterals(),
        ViteImageOptimizer({
            includePublic: true,
            logStats: true
        }),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg}']
            }
        }),
    ],
});
