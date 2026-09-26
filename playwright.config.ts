import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The default (half the CPU cores, 16 on this machine) starves the audio-clock tests: 15 of them failed, all
  // passing again at 4. 8 verified safe on this machine (2026-09-26): the audio-clock specs (us1-play, us2-grade,
  // electron-playback, us1-layout's relayout-during-a-run) stayed green even run alongside heavier specs at 8
  // workers. fullyParallel matters as much as the worker count: without it, every test in one file runs on a single
  // worker regardless of `workers` - grade-marks-overlap.spec.ts (one file, 118 generated tests) was silently
  // serialized to 1 worker until this was set, verified 118/118 green on both chromium and electron once parallel.
  workers: 8,
  fullyParallel: true,
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
