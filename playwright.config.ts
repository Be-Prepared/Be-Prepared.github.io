import { defineConfig, devices } from '@playwright/test';

// Browser tests for the built app. Screenshot baselines depend on fonts and
// rendering, so they're made and compared inside Playwright's Docker image
// (see "npm run test:e2e:docker" and the CI workflow). Running directly on
// another system works for everything except the screenshot comparisons.
export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list']],
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    expect: {
        toHaveScreenshot: {
            animations: 'disabled',
            maxDiffPixelRatio: 0.01,
        },
    },
    use: {
        baseURL: 'http://localhost:4173',
        locale: 'en-US',
        timezoneId: 'America/Chicago',
        // The service worker would cache between tests.
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    ],
});
