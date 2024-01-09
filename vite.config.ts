import { defineConfig } from 'vite';
import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        emptyOutDir: true,
        outDir: '../dist',
        target: 'esnext',
    },
    clearScreen: false,
    root: 'site',
    server: {
        host: true,
        port: 8080,
        strictPort: true,
    },
    plugins: [
        minifyLiterals(),
        VitePWA({
            manifest: {
                icons: [
                    {
                        src: 'pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'maskable-icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                name: "Be Prepared"
            },
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg}'],
            },
        }),
    ],
});
