// The desktop app chooses where the sound goes (feature 021 US5, audio-setup.md section 3, FR-024 to FR-026, SC-010): the Latency
// popup lists the system default and the labelled output devices, the choice moves the audio context's sink and survives a
// restart, a vanished device falls back to the system default with one notice, and the desktop app still refuses to capture
// audio while Web MIDI keeps working (research R-6, "Spike result"). Launches the real shell, like electron-live-piano.spec.ts.
// The device list is the machine's own: a machine with fewer than two audio outputs cannot show a choice and skips.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { closeBrowser } from './helpers/browser.js';
import { configNumber } from './helpers/config.js';
import { audioSinkId } from './helpers/live-spy.js';
import { midiControl, openMidiPopover } from './helpers/midi.js';
import { openPanel, panelLocator } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_OUTPUT_FALLBACK_MAX_MS = configNumber('AUDIO_OUTPUT_FALLBACK_MAX_MS');
const LOST_NOTICE = 'The chosen sound output was disconnected; playing through the system default.';
const ASIO_LINE = 'ASIO and other low-latency drivers need the Native audio plugin, which is not available yet.';
const PATH_LINE: Record<string, string> = {
  win32: 'Windows audio (shared mode)',
  darwin: 'macOS audio',
  linux: 'System audio',
};

test.describe('Electron: choosing the sound output (feature 021 US5)', () => {
  // One desktop app at a time: they share the machine's audio devices
  test.describe.configure({ mode: 'default' });
  let userDataDir = '';
  let app: ElectronApplication | null = null;

  /** Starts the desktop app. It does not touch MIDI by itself (owner decision 2026-10-03): only the test that connects does. */
  const launch = async (): Promise<Page> => {
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js'), `--user-data-dir=${userDataDir}`],
    });
    const window = await app.firstWindow();
    await window.waitForFunction(() => 'mxSession' in globalThis);
    await closeBrowser(window);
    return window;
  };
  const quit = async (): Promise<void> => {
    const running = app;
    app = null;
    if (!running) return;
    const pid = running.process().pid;
    const closed = await Promise.race([
      running.close().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15_000)),
    ]);
    // A MIDI or audio driver that hangs at exit must not hang the run (or leave the app behind)
    if (!closed && pid !== undefined) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
      else running.process().kill('SIGKILL');
    }
  };

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-audio-output-'));
  });

  test.afterEach(async () => {
    await quit();
    // best effort: a killed app can still hold a file for a moment
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const select = (window: Page) => panelLocator(window, 'latency').getByLabel('Sound output');

  /** The values and labels of the select's options (the system default first, its value ''). */
  const choices = (window: Page) =>
    select(window)
      .locator('option')
      .evaluateAll((options) =>
        options.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent ?? '' })),
      );

  test('the popup lists the system default and the labelled devices; the path and the ASIO line are shown', async () => {
    test.setTimeout(120_000);
    const window = await launch();
    await expect.poll(() => audioSinkId(window), { timeout: 60_000 }).toBe('');
    await openPanel(window, 'latency');
    await expect(select(window)).toBeVisible();
    const list = await choices(window);
    expect(list[0]).toEqual({ value: '', label: 'System default' });
    for (const choice of list) {
      expect(choice.label.trim().length, `option ${choice.value} has a name`).toBeGreaterThan(0);
    }

    const platform = await window.evaluate(
      () => (window as unknown as { musicanyyaShell?: { platform?: string } }).musicanyyaShell?.platform ?? '',
    );
    await expect(panelLocator(window, 'latency').locator('[data-id="output-path"]')).toHaveText(
      PATH_LINE[platform] ?? 'Browser audio',
    );
    await expect(panelLocator(window, 'latency').locator('[data-id="asio-note"]')).toHaveText(ASIO_LINE);
  });

  test('capture stays refused: getUserMedia is rejected through the real permission handler', async () => {
    test.setTimeout(120_000);
    const window = await launch();
    const mic = await window.evaluate(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return 'granted';
      } catch (err) {
        return (err as Error).name;
      }
    });
    expect(mic).toBe('NotAllowedError');
  });

  const midiAvailability = (window: Page) =>
    window.evaluate(
      () => (window as unknown as { __MIDI_STATE__: { availability: string } }).__MIDI_STATE__.availability,
    );

  test('MIDI is connected by hand only: nothing asks at start-up; Connect then opens Web MIDI through the real handler', async () => {
    test.setTimeout(120_000);
    const window = await launch();
    await expect(midiControl(window)).toContainText('Connect MIDI keyboard');
    await window.waitForTimeout(3000); // time enough for a start-up request to have been made
    expect(await midiAvailability(window)).toBe('notRequested');

    await openMidiPopover(window);
    await panelLocator(window, 'midi').getByRole('button', { name: 'Connect MIDI keyboard' }).click();
    // The handler answers midi and midiSysex for the app origin (research R-6)
    await expect.poll(() => midiAvailability(window), { timeout: 60_000 }).toBe('available');
  });

  test('choosing a device moves the sound, survives a restart, and a vanished device falls back once', async () => {
    test.setTimeout(240_000);
    let window = await launch();
    await expect.poll(() => audioSinkId(window), { timeout: 60_000 }).toBe('');
    await openPanel(window, 'latency');
    await expect(select(window)).toBeVisible();
    const list = await choices(window);
    test.skip(list.length < 3, 'needs the system default and at least two audio outputs on this machine');
    const other = list.find((c) => c.value !== '');
    if (!other) throw new Error('no second output');

    await select(window).selectOption(other.value);
    await expect.poll(() => audioSinkId(window)).toBe(other.value);

    // Restart: the choice is restored at start-up
    await quit();
    window = await launch();
    await expect.poll(() => audioSinkId(window), { timeout: 60_000 }).toBe(other.value);
    await openPanel(window, 'latency');
    await expect(select(window)).toHaveValue(other.value);

    // The device vanishes: the browser would report a devicechange without it
    await window.evaluate((gone) => {
      const original = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async () => (await original()).filter((d) => d.deviceId !== gone);
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    }, other.value);
    await expect.poll(() => audioSinkId(window), { timeout: AUDIO_OUTPUT_FALLBACK_MAX_MS }).toBe('');
    await expect(window.getByText(LOST_NOTICE)).toHaveCount(1);
    await expect(select(window)).toHaveValue('');
    // A further change while it is still gone adds no second notice
    await window.evaluate(() => navigator.mediaDevices.dispatchEvent(new Event('devicechange')));
    await window.waitForTimeout(500);
    await expect(window.getByText(LOST_NOTICE)).toHaveCount(1);
  });
});
