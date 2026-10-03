// The desktop app plays the piano from the moment its window is shown, with no click at all (feature 021 US1, SC-001,
// FR-001): Electron's autoplay policy lets the audio context run with no user gesture, the SoundFont loads at start-up,
// and a MIDI key then reaches the worklet. Launches the real shell, like electron-playback.spec.ts.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import { audioContextState, engineStateKind, liveMessages, spyOnLiveMessages } from './helpers/live-spy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Electron: the piano plays from start-up with no click (feature 021 US1)', () => {
  let electronApp: ElectronApplication;
  let userDataDir: string;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    // A user-data directory of its own: the single-instance lock is keyed on it, and an empty Cache Storage makes this
    // the cold SoundFont path (the sound must load at start-up, not at the first Play).
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-live-piano-'));
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
  test('no click at all: once the sound is loaded a MIDI key reaches the running worklet (SC-001)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000); // the first-ever start downloads and builds the SoundFont

    const window = await electronApp.firstWindow();
    expect(window.url(), 'the shell serves the app from its own origin').toBe('app://musicanyya/');
    await window.waitForFunction(() => 'mxSession' in globalThis); // the app has started
    await spyOnLiveMessages(window);

    // Nothing is clicked or typed: the context runs and the sound loads by themselves
    await expect.poll(() => audioContextState(window), { timeout: 60_000 }).toBe('running');
    await expect.poll(() => engineStateKind(window), { timeout: 90_000 }).toBe('ready');

    await window.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 90] })));
    await window.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] })));

    const messages = await liveMessages(window);
    expect(messages.filter((m) => m.kind === 'on')).toHaveLength(1);
    expect(messages.filter((m) => m.kind === 'on')[0]?.key).toBe(60);
    expect(messages.filter((m) => m.kind === 'off')).toHaveLength(1);
    expect(await audioContextState(window)).toBe('running');
    // and no locked hint: the desktop app is never locked
    await expect(window.getByText('Click anywhere on the page to turn the sound on')).toHaveCount(0);
  });
});
