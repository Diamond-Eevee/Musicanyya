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

    // Check that navigation to another origin is blocked by trying to change window.location
    await window.evaluate(() => {
      window.location.href = 'https://example.com';
    });
    // It shouldn't navigate. Wait a bit and check URL.
    await window.waitForTimeout(1000);
    expect(window.url()).toBe('app://musicanyya/');
  });
});
