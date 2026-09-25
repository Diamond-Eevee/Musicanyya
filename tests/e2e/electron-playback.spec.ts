// Listen mode under the desktop shell's `app://` origin.
//
// T140 was a desktop-only audio bug: `Cache.put` rejects non-http(s) requests in Chromium, so under
// `app://` the SoundFont downloaded but the cache write threw, and the user got "The built-in sound
// could not be loaded" and silence. Nothing in the suite caught it - `us2-listen.spec.ts` is
// Chromium-only by design (strict SC-005 timing, research.md R-15), the other projects share the
// browser bundle over http://localhost, and `electron-smoke.spec.ts` opened a score without ever
// pressing Play. This test closes that gap: it launches the real shell and plays.
//
// Deliberately no SC-005 timing assertion - that belongs to the Chromium test. What matters here is
// that the sound loads at all under `app://`, that Play sounds and moves the cursor, and that the
// notice tray stays quiet.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

test.describe('Electron: Listen mode plays under the app:// origin (T140, T141)', () => {
  let electronApp: ElectronApplication;
  let userDataDir: string;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    // `electron/main.ts` takes a single-instance lock, which is keyed on the user-data directory, so a
    // second Electron started while `electron-smoke.spec.ts` holds the default one exits immediately.
    // A directory of our own lets the two specs run in parallel, and starts this one against an empty
    // Cache Storage - which is the cold SoundFont path T140 broke.
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-playback-'));
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js'), `--user-data-dir=${userDataDir}`],
    });
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.afterAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    await electronApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('the built-in sound loads, Play sounds and the cursor moves, with no notice', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000); // the first-ever Play downloads and builds the SoundFont

    const window = await electronApp.firstWindow();
    const consoleErrors: string[] = [];
    window.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

    expect(window.url(), 'the shell serves the app from its own origin').toBe('app://musicanyya/');

    await window.locator('mx-open-button input[type=file]').setInputFiles(fixture('scale-c-major-q100.musicxml'));
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });

    // The SoundFont is fetched and built before Play is offered. Under `app://` the cache write is
    // the part that used to throw, so this is where T140 showed itself.
    await expect(window.locator('.play-btn')).not.toBeDisabled({ timeout: 90_000 });
    await expect(window.locator('.notice'), 'no "built-in sound could not be loaded" notice').toHaveCount(0);

    // Play: the button flips to Pause, a note lights up, and the audio clock is actually running.
    await window.locator('.play-btn').click();
    await expect(window.locator('.play-btn')).toHaveText('Pause');
    await expect(window.locator('g.note.playing').first()).toBeVisible({ timeout: 30_000 });

    const audio = await window.evaluate(async () => {
      // A fresh context can start suspended and take a moment to start its clock on a busy machine (four browser
      // projects run in parallel): resume it, then give the clock up to 3 s to move instead of judging it at 300 ms.
      const ctx = new AudioContext();
      await ctx.resume();
      const before = ctx.currentTime;
      const deadline = performance.now() + 3000;
      while (ctx.currentTime <= before && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const after = ctx.currentTime;
      await ctx.close();
      return { before, after, state: after > before ? 'running' : 'stalled' };
    });
    expect(audio.state, 'the audio clock advances under app://').toBe('running');

    // The cursor moves on: a later note takes over from the first.
    const firstPlaying = await window.locator('g.note.playing').first().getAttribute('id');
    await expect
      .poll(async () => window.locator('g.note.playing').first().getAttribute('id'), { timeout: 30_000 })
      .not.toBe(firstPlaying);

    // Stop returns to the start and leaves nothing highlighted.
    await window.keyboard.press('Escape');
    await expect(window.locator('.play-btn')).toHaveText('Play');
    await expect(window.locator('g.note.playing')).toBeHidden();

    expect(consoleErrors, 'no uncaught page error during playback').toEqual([]);
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('a second Play reuses the cached sound rather than failing on the cache write', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000);

    // T140's failure was in the *write* to Cache Storage, which only runs once per SoundFont. Reload
    // the shell so the app starts cold against a cache the previous test may or may not have filled:
    // either way, loading must succeed and Play must sound.
    const window = await electronApp.firstWindow();
    await window.reload();
    expect(window.url()).toBe('app://musicanyya/');

    await window.locator('mx-open-button input[type=file]').setInputFiles(fixture('scale-c-major-q100.musicxml'));
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    await expect(window.locator('.play-btn')).not.toBeDisabled({ timeout: 90_000 });
    await expect(window.locator('.notice')).toHaveCount(0);

    await window.locator('.play-btn').click();
    await expect(window.locator('g.note.playing').first()).toBeVisible({ timeout: 30_000 });
    await window.keyboard.press('Escape');
  });
});
