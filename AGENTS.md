# Notes for agents working on Be Prepared

An offline PWA toolbox (flashlight, compass, level, timers, and more). TypeScript, [Fudgel](https://github.com/fidian/fudgel) web components, RxJS, built with Vite. See README.md for what each tool does.

## Rules of the project

* Everything works offline. No network requests at runtime, no data leaves the device, no external libraries loaded from a CDN.
* Never cache permission results or hardware probe results. Check the permission when a tool opens; only hide a home screen tile when the hardware is missing (see `hasHardware` in `src/tile-defs.ts`). A denied permission must stay recoverable with "Try Again".
* Release hardware when a screen closes and when the app goes to the background. A camera stream that isn't stopped keeps the camera locked.
* Be honest in the UI about what a web app can't do (accuracy, background limits, permissions). Timers and alarms show `<limits-notice>`.

## Commands

* `npm install`, then `npm start` (dev server on port 8080, exposed on the LAN).
* `npm test` type checks the tests (`tsconfig.test.json`) and runs them with Node's built-in test runner (`node:test` and `node:assert/strict`), loading TypeScript through `tsx`. Tests are `src/**/*.test.ts`. CI runs them before building and deploying `master` to GitHub Pages. Requires Node 22 or newer.
* `npx tsc --noEmit -p .` type checks the app. Test files are excluded there because they use Node's types; `tsconfig.test.json` covers them. `npm run build` type checks and builds.
* `npm run generate-pwa-assets` regenerates launcher icons from `site/public/app-icon.svg`.
* `npm run test:e2e:docker` runs the Playwright browser tests (`e2e/`) in Chromium, Firefox, and WebKit inside Playwright's Docker image, which is what CI uses. Screenshot baselines live in `e2e/__screenshots__/<project>/`; regenerate them with `npm run test:e2e:docker -- --update-snapshots` after an intended visual change, and look at the new images before committing. Keep the image version in `package.json`, `.github/workflows/main.yml`, and `@playwright/test` in step.
* `npm run size` reports the size each feature, library, and static file adds. Check it when adding data files or libraries; the app should stay small.
* Anything needed offline must be precached: see `workbox.globPatterns` in `vite.config.ts`. A file type missing there silently breaks offline use.

## Layout

* `src/<tool>-app/` — one directory per tool: `<tool>-app.component.ts`, `<tool>-app.module.ts` (exports), `<tool>-app.i18n.ts` (strings, keys prefixed with the tool name), plus pure logic modules and their tests.
* `src/shared/` — shared components: `default-layout` (screen with toolbar and back button; `frame` and `overlay` attributes), `icon-button`, `pretty-button`, `access-screen` (permission / unavailable / error states), `limits-notice`, `show-modal`, `load-svg`.
* `src/services/` — hardware and app services:
    * `access/access-controller.ts` — permission-gated resource lifecycle (check, prompt, acquire, release on hidden/pagehide/destroy). Used by `CameraService.controller()`, `MicrophoneService.controller()`, `NfcService.controller()`.
    * `camera.service.ts` — all camera streams go through here; torch helpers act on the open track.
    * `compass.service.ts`, `motion.service.ts` — orientation sensors, including iOS's tap-to-allow permission. Math lives in `compass/` and `motion/` with tests.
    * `reminder.service.ts` — the countdown timer and alarm clock, so they ring from any screen through `<reminder-ringer>`.
    * `geolocation.service.ts`, `wake-lock.service.ts`, `alarm-sound.service.ts`, `preference.service.ts`, `local-storage.service.ts`.
* `src/tile-defs.ts` — home screen tiles and routes. `src/index.ts` exports every module. `src/i18n/en-us.ts` holds shared strings and spreads each tool's i18n file.
* `src/i18n/translations/<tag>.ts` — one file per language, listed in `src/i18n/languages.ts` and loaded on demand. `translations.test.ts` fails if any language is missing a key or changes a `{{placeholder}}` or HTML tag. When you add or change an English string, update every translation (or ask for help); never leave a translation with English text silently.
* `site/public/` — static files, including all icons.

## Adding a tool

1. Create `src/<tool>-app/` with component, module, and i18n files.
2. Export the module from `src/index.ts`, import and spread the strings in `src/i18n/en-us.ts`, add a `tile.<name>` label there, and add a tile to `src/tile-defs.ts`.
3. Draw an icon in `site/public/`.
4. Put math and logic in pure modules (no DOM, no Fudgel imports) and test them.

## Fudgel pitfalls

* Template expressions do NOT support the ternary `?:` operator. It fails at runtime with a parse error. Compute strings and classes in the controller and bind those.
* `attr` names are camelCase in the controller and kebab-case in HTML (`labelId` → `label-id`). Props are bound with `.prop="expr"`.
* Only top-level controller properties trigger updates; reassign objects and arrays.
* `#ref` elements inside `*if` exist a tick later. Attach things like a video `srcObject` in a `setTimeout`.
* Lifecycle hooks: `onInit`, `onViewInit`, `onChange`, `onDestroy`. Clean up timers, animation frames, subscriptions, listeners, audio, and hardware in `onDestroy`.
* Component styles are scoped to elements in the template. HTML injected with `i18n-html` doesn't get them; use inline styles there.
* In RxJS pipes that `switchMap` into a long-lived source (like GPS), put `takeUntil` last, or the inner source keeps running after the screen closes.

## Test pitfalls

* Await asynchronous results (for example `await firstValueFrom(observable)`) before asserting. An assertion inside a `subscribe` callback can run after the test has already passed.
* `assert.deepEqual(array, [])` narrows the array's type to `never[]` for the rest of the test. Check `array.length` instead when you keep using the array.

## Style

* 4-space indent, single quotes, Prettier settings in `.prettierrc`. Comments explain why, not what.
* Use the CSS variables from `site/index.html` (`--bg`, `--surface`, `--fg`, `--fg-muted`, `--accent`, `--border`, `--space-1..5`, `--radius-s/m/l`, and so on). Dark mode is pure black for OLED screens.
* Icons: 24×24 viewBox, `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`, no hard-coded colors, so they follow the theme.
* Every screen must work in portrait, landscape, light, and dark.
* All user-visible text goes through i18n, including unit symbols (`unit.*`), compass points (`direction.*`), and AM/PM. Format dates with `Intl` and `I18nService.locale()`, not `navigator.language`, so they follow the language picked in the app.
* Arabic is right to left. Use logical CSS (`margin-inline-start`, `text-align: start`) for anything that follows reading direction; keep physical `left`/`right` for geometry such as centering and gauges.

## Testing in a browser

* `e2e/helpers.ts` fakes a working or blocked camera for any browser. Use Playwright's `geolocation` and `permissions` options for location.
* Seeding localStorage in tests: set `preferenceVersion` to `[1, 1]` too, or the old preference migration rewraps saved values.

* Headless Chrome can fake a camera and microphone: `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`. `--virtual-time-budget` screenshots hang on camera screens; drive Chrome over the DevTools protocol with a real wait instead.
* Motion sensors can be simulated with `dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha, beta, gamma }))`. Desktop Chrome also fires empty (null) orientation events, which the services treat as "no sensor" after a short grace period.
* Nothing replaces a real phone for sensors, torch, NFC, GPS, and audio levels. Say so when reporting results.
