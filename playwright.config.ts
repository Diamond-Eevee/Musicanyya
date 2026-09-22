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
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
});
