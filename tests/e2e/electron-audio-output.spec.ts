// The desktop app chooses where the sound goes (feature 021 US5, audio-setup.md section 3, FR-024 to FR-026, SC-010): the Latency
// popup lists the system default and the labelled output devices, the choice moves the audio context's sink and survives a
// restart, a vanished device falls back to the system default with one notice, and the desktop app still refuses to capture
// audio while Web MIDI keeps working (research R-6, "Spike result"). Launches the real shell, like electron-live-piano.spec.ts.
// The device list is the machine's own: a machine with fewer than two audio outputs cannot show a choice and skips.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { closeBrowser } from './helpers/browser.js';
import { configNumber } from './helpers/config.js';
import { audioSinkId } from './helpers/live-spy.js';
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
  let userDataDir = '';
  let app: ElectronApplication | null = null;

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
    await app?.close();
    app = null;
  };

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-audio-output-'));
  });

  test.afterEach(async () => {
    await quit();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
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

  test('capture stays refused, Web MIDI still opens (the permission handlers are really installed)', async () => {
    test.setTimeout(120_000);
    const window = await launch();
    const result = await window.evaluate(async () => {
      const out = { mic: '', midi: '' };
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        out.mic = 'granted';
      } catch (err) {
        out.mic = (err as Error).name;
      }
      try {
        await navigator.requestMIDIAccess();
        out.midi = 'granted';
      } catch (err) {
        out.midi = (err as Error).name;
      }
      return out;
    });
    expect(result.mic).toBe('NotAllowedError');
    expect(result.midi).toBe('granted');
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
