import { defineConfig } from 'vite';
import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { ViteFaviconsPlugin } from 'vite-plugin-favicon';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
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
        ViteFaviconsPlugin({
            logo: 'site/public/toolbox.svg',
            favicons: {
                appName: 'Be Prepared',
                appDescription: 'Collection of offline utilities',
                background: '#dddddd',
                developerName: 'Tyler Akins',
                developerURL:
                    'https://github.com/Be-Prepared/Be-Prepared.github.io/',
                icons: {
                    appleStartup: false, // TOO SLOW
                    yandex: false // It's now Chromium based
                },
                theme_color: '#dddddd',
                version: new Date().toISOString()
            },
        }),
        ViteImageOptimizer({
            includePublic: true,
            logStats: true,
        }),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg}'],
            },
        }),
    ],
});
