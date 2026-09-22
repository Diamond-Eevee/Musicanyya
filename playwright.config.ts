import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The default (half the CPU cores) starves the audio-clock tests: with 16 workers 15 of them failed, all passing
  // again at 4. Playwright runs them in parallel across four browser projects, and a run's length is real time.
  workers: 4,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'electron' },
  ],
  webServer: {
    // Build first: `vite preview` only serves whatever is already in dist/, so without this the whole
    // suite can pass against a bundle built before the change under test. Found on 2026-09-22, when
    // every real-repertoire fixture was rejected by a dist/ that predated the depth-guard fix (5bcb932).
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
});
