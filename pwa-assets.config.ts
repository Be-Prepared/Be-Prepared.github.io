import {
    defaultAssetName,
    defineConfig,
    minimalPreset as preset,
} from '@vite-pwa/assets-generator/config';

// app-icon.svg has its own background so the icon is visible on both light
// and dark launchers and browser tabs. The in-app icons use currentColor
// instead and can't be used here.
const background = '#000000';

// Bump this when the artwork changes, and rename the icons in the manifest in
// vite.config.ts to match. Installed apps pick up a new icon by comparing the
// manifest, and a new file name also gets past caches holding the old image.
const iconVersion = 2;

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
        assetName: (type, size) => {
            const name = defaultAssetName(type, size);

            // iPhones never refresh a home screen icon, so the Apple icon
            // keeps the name index.html links to.
            return type === 'apple'
                ? name
                : name.replace('.png', `-v${iconVersion}.png`);
        },
    },
    images: ['site/public/app-icon.svg'],
});
