import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import { browserDialog, closeBrowser, openBrowser, seedProgress } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Electron smoke test', () => {
  let electronApp: ElectronApplication;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;

    // Launch electron app using the built dist-electron
    const mainPath = path.join(__dirname, '../../dist-electron/main.js');
    // A user-data directory of our own: the shell takes a single-instance lock keyed on it, so a launch beside another
    // Electron instance (a spec still closing, the previous run) would quit at once
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-smoke-'));
    electronApp = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] });
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
    // FR-001: the score browser opens at start-up with no Score loaded; close it before reaching the menu bar
    // behind it (unrelated to this test, which checks the desktop shell's own name in the environment panel).
    await closeBrowser(window);

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
  // Feature 011 FR-023 (T088): the packaged shelf is the same tree, and its first exercise opens from the library panel.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('the packaged shelf opens Learning > Keys > C major > 1 Introduction', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run electron smoke test on electron project only');

    const window = await electronApp.firstWindow();
    const { item } = await revealLibraryItem(window, 'learning/keys/c-major/introduction');
    await expect(item).toContainText('Introduction');
    await item.dblclick();
    await expect(window.locator('dialog.browser')).toBeHidden();
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(window.locator('.mx-title-block')).toContainText('C major - introduction');
    await expect(window.locator('.notice')).toHaveCount(0);
  });
  // Feature 013 FR-031 (T088): the score browser is the same code in the desktop shell - it opens from the bar, takes
  // seeded progress through the ordinary store (IndexedDB under app://), opens a library item and records that it
  // was opened.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('the score browser opens, shows seeded progress, opens an item and records it (013 T088)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run electron smoke test on electron project only');

    const window = await electronApp.firstWindow();
    await openBrowser(window);
    await seedProgress(window, 'c-major-intro-mastered.json');

    // The seeded mastering result is a progress record written and read back through the shell's own storage.
    const first = window.locator('.continue-recent .continue-card').first();
    await expect(first).toHaveAttribute('data-ref', 'library:learning/keys/c-major/introduction');
    await expect(first).toHaveAttribute('data-status', 'mastered');

    // One click on the suggestion opens the next step; opening it is itself recorded as progress.
    const suggested = window.locator('[data-testid="browser-suggested"] .continue-card');
    await expect(suggested).toHaveAttribute('data-ref', 'library:learning/keys/c-major/beginner');
    await suggested.click();
    await expect(browserDialog(window)).toBeHidden();
    await expect(window.locator('.mx-title-block')).toContainText('C major - beginner');

    await openBrowser(window);
    await expect(window.locator('.continue-recent .continue-card').first()).toHaveAttribute(
      'data-ref',
      'library:learning/keys/c-major/beginner',
    );
    await closeBrowser(window);
  });
  // Feature 014 FR-015 (T059): a key-change item rewritten with a right-hand melody loads in the desktop shell and
  // engraves both staves - the melody above, the left hand's chords below.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('a key change with a right-hand melody (C major -> A minor, Introduction) loads with two staves', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run electron smoke test on electron project only');

    const window = await electronApp.firstWindow();
    const { item } = await revealLibraryItem(window, 'learning/key-changes/c-major-to-a-minor/introduction');
    await item.dblclick();
    await expect(browserDialog(window)).toBeHidden();
    await expect(window.locator('.mx-title-block')).toContainText('C major to A minor - introduction');
    await expect(window.locator('.notice')).toHaveCount(0);
    await expect.poll(() => window.locator('.mx-score-page g.measure').first().locator('g.staff').count()).toBe(2);
  });
});
