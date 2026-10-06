import {
    defineConfig,
    minimalPreset as preset,
} from '@vite-pwa/assets-generator/config';

// app-icon.svg has its own colored background so the icon is visible on both
// light and dark launchers and browser tabs. The in-app icons use
// currentColor instead and can't be used here.
const background = '#e8590c';

export default defineConfig({
    preset: {
        ...preset,
        maskable: {
            ...preset.maskable,
            // The artwork already sits inside the maskable safe zone.
            padding: 0,
            resizeOptions: { background, fit: 'contain' },
        },
        apple: {
            ...preset.apple,
            padding: 0,
            resizeOptions: { background, fit: 'contain' },
        },
    },
    images: ['site/public/app-icon.svg'],
});
