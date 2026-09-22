import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Electron smoke test', () => {
  let electronApp: ElectronApplication;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;

    // Launch electron app using the built dist-electron
    const mainPath = path.join(__dirname, '../../dist-electron/main.js');
    electronApp = await electron.launch({ args: [mainPath] });
    electronApp.process().stdout?.on('data', (d) => console.log('STDOUT:', d.toString()));
    electronApp.process().stderr?.on('data', (d) => console.log('STDERR:', d.toString()));
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.afterAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    await electronApp.close();
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('window loads, panel says desktop app, opens fixture', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run electron smoke test on electron project only');

    const window = await electronApp.firstWindow();
    window.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    // It should load app://musicanyya/ by default
    const url = window.url();
    expect(url).toBe('app://musicanyya/');

    await expect(window.locator('.mx-empty-state')).toBeVisible();

    // Environment panel
    await openPanel(window, 'environment');
    await expect(window.locator('mx-environment-panel')).toBeVisible();
    await expect(window.locator('mx-environment-panel')).toContainText('Desktop App');

    // Check if window.musicanyyaShell is frozen
    const isFrozen = await window.evaluate(() => Object.isFrozen((window as any).musicanyyaShell));
    expect(isFrozen).toBe(true);

    // Open a fixture
    const fileInput = window.locator('mx-open-button input[type=file]');
    const fixturePath = path.join(__dirname, '../fixtures/musicxml/scale-c-major-q100.musicxml');
    await fileInput.setInputFiles(fixturePath);

    await expect(window.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(window.locator('.mx-empty-state')).toBeHidden();

    // Feature 004, FR-001: the layout is the browser's, unchanged - the Score view spans the window width, the slim bar
    // is one row of at most 48 px, and no aside reserves space.
    const layout = await window.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      const flow = Array.from(document.querySelector('#mx-main')?.children ?? []).filter(
        (child) =>
          child.tagName !== 'MX-SCORE-VIEW' && !['absolute', 'fixed'].includes(getComputedStyle(child).position),
      );
      return {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        bar: box('#mx-bar')?.height ?? 0,
        view: box('mx-score-view') ?? null,
        reservers: flow.map((child) => child.tagName),
        asides: document.querySelectorAll('aside').length,
      };
    });
    expect(layout.view?.width).toBeGreaterThanOrEqual(layout.windowWidth - 1);
    expect(layout.bar).toBeLessThanOrEqual(48.5); // sub-pixel rounding at fractional display scaling
    expect((layout.view?.height ?? 0) + layout.bar).toBeCloseTo(layout.windowHeight, 0);
    expect(layout.reservers).toEqual([]);
    expect(layout.asides).toBe(0);

    // Check that navigation to another origin is blocked by trying to change window.location
    await window.evaluate(() => {
      window.location.href = 'https://example.com';
    });
    // It shouldn't navigate. Wait a bit and check URL.
    await window.waitForTimeout(1000);
    expect(window.url()).toBe('app://musicanyya/');
  });
});
