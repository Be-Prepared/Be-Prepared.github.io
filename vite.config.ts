import { defineConfig } from 'vite';
import minifyLiterals from 'rollup-plugin-minify-html-literals-v3';
import { resolve } from 'path';
import simpleHtmlPlugin from 'vite-plugin-simple-html';
import { vitePluginVersionMark } from 'vite-plugin-version-mark'
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        emptyOutDir: true,
        outDir: '../dist',
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'site/index.html'),
                404: resolve(__dirname, 'site/404.html')
            }
        },
        target: 'esnext',
    },
    clearScreen: false,
    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
        __NODE_VERSION__: JSON.stringify(process.version),
        __HOST_PLATFORM__: JSON.stringify(process.platform),
        __HOST_ARCH__: JSON.stringify(process.arch),
    },
    plugins: [
        vitePluginVersionMark({
            ifGitSHA: true,
            ifLog: false,
            ifGlobal: true,
            ifMeta: false,
        }),
        minifyLiterals(),
        simpleHtmlPlugin({
            minify: true
        }),
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
                name: "Be Prepared",
                theme_color: "#000000",
            },
            registerType: 'prompt',
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg}'],
            },
        }),
    ],
    root: 'site',
    server: {
        host: true,
        port: 8080,
        strictPort: true,
    },
});
