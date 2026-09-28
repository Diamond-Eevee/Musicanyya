import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel } from './helpers/panels.js';
import { startPracticeOnOpenScore } from './helpers/practice.js';
import { sessionIndex } from './helpers/pressed-keys.js';

const press = (page: import('@playwright/test').Page, key: number) =>
  page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, k, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, k, 0] }));
  }, key);

// contracts/tempo-field.md, quickstart.md "US1 - see the tempo" (feature 012). Chromium-only: this is about DOM
// state and timing of the field, not cross-browser rendering, and every other e2e spec already covers that.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');
const fixturePath = (name: string) => path.join(fixturesDir, name);

const bpmInput = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-bpm"]');
const writtenHint = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-written"]');
const resetBtn = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-reset"]');

test.describe('US1: see the Score written tempo as a number', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the destructuring pattern to introspect fixtures
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM/timing test of the field, not cross-browser rendering');
  });

  test('a library item written at 72 shows "72 BPM", reset disabled, no written hint', async ({ page }) => {
    await page.goto('/');
    const { item } = await revealLibraryItem(page, 'learning/key-changes/a-major-to-a-minor/beginner');
    await item.dblclick();

    await expect(bpmInput(page)).toHaveValue('72');
    await expect(page.locator('[data-id="tempo-unit"]')).toHaveText('BPM');
    await expect(resetBtn(page)).toBeDisabled();
    await expect(writtenHint(page)).toBeHidden();
  });

  test('tempo-dotted-beat-unit.musicxml shows 60 with a beat symbol', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-dotted-beat-unit.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await expect(bpmInput(page)).toHaveValue('60');
    await expect(page.locator('[data-id="tempo-beat"]')).toBeVisible();
  });

  test('tempo-none-default.musicxml shows "default"', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-none-default.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await expect(bpmInput(page)).toHaveValue('100');
    await expect(page.locator('mx-tempo-field')).toHaveAttribute('data-default', '');
    await expect(writtenHint(page)).toContainText(/default/i);
  });

  test('tempo-change-90-60: Listen shows 90 then 60 once the cursor passes m5; stopped, a measure click reseeks the shown tempo (FR-004)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-change-90-60.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('90');

    // Play from the start (4 measures of 4/4 at 90 BPM = 16 beats, ~10.7s, before the cursor reaches m5).
    await page.locator('.play-btn').click();
    await expect(page.locator('.play-btn')).toHaveText('Pause');
    await expect(bpmInput(page)).toHaveValue('60', { timeout: 20_000 });
    await page.keyboard.press('Escape'); // stop

    // Stopped, clicking m1 (0-indexed 0, the 90 section) moves the shown tempo back - proves the click actually
    // seeks, not just that the field still shows whatever the stop left it at (FR-004).
    await page.locator('g.measure').nth(0).click({ force: true });
    await expect(bpmInput(page)).toHaveValue('90');
  });

  test('opening a second Score shows its own written tempo (no carry-over)', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-dotted-beat-unit.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('60');

    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(fixturePath('tempo-sound-vs-metronome.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('140');
  });
});

// quickstart.md "US2 - type the tempo" (feature 012). `__TRANSPORT_STATE__` is the same kind of e2e seam as
// `__PLAY_STATE__`: its `tempoPercent` is exactly the factor the Audio engine is given (session.ts binds it).
type Page = import('@playwright/test').Page;
type TransportSeam = {
  get(): { phase: string; tempoPercent: number };
  subscribe(listener: (state: { phase: string }) => void): void;
};

const transportSnapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as { __TRANSPORT_STATE__: TransportSeam }).__TRANSPORT_STATE__.get());

async function openFixture(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(name));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
}

async function typeTempo(page: Page, text: string): Promise<void> {
  await bpmInput(page).fill(text);
  await bpmInput(page).press('Enter');
}

test.describe('US2: type the tempo to practise at', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the destructuring pattern to introspect fixtures
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM/timing test of the field, not cross-browser rendering');
  });

  test('typing 72 + Enter on a Score written at 90 shows "72 BPM", "written 90" and gives the engine 80 %', async ({
    page,
  }) => {
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await typeTempo(page, '72');

    await expect(bpmInput(page)).toHaveValue('72');
    await expect(writtenHint(page)).toContainText('written 90');
    expect((await transportSnapshot(page)).tempoPercent).toBeCloseTo(80, 10);
    await expect(resetBtn(page)).toBeEnabled();
  });

  test('500 becomes the limit 180 (200 %)', async ({ page }) => {
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await typeTempo(page, '500');
    await expect(bpmInput(page)).toHaveValue('180');
    expect((await transportSnapshot(page)).tempoPercent).toBe(200);
  });

  test('"abc" + Escape restores the previous value, sends nothing and does not stop a running Listen', async ({
    page,
  }) => {
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await typeTempo(page, '72');
    await page.locator('.play-btn').click();
    await expect(page.locator('.play-btn')).toHaveText('Pause');

    await bpmInput(page).fill('abc');
    await bpmInput(page).press('Escape');
    await expect(bpmInput(page)).toHaveValue('72');
    expect((await transportSnapshot(page)).tempoPercent).toBeCloseTo(80, 10);
    // Escape belongs to the field here: the global "stop" must not fire
    await expect(page.locator('.play-btn')).toHaveText('Pause');
    expect((await transportSnapshot(page)).phase).toBe('playing');
  });

  test('SC-003: from a stopped Score one fill + Enter sets 72 and one reset click returns to the written tempo', async ({
    page,
  }) => {
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await typeTempo(page, '72');
    await expect(bpmInput(page)).toHaveValue('72');
    await resetBtn(page).click();
    await expect(bpmInput(page)).toHaveValue('90');
    expect((await transportSnapshot(page)).tempoPercent).toBe(100);
    await expect(resetBtn(page)).toBeDisabled();
    await expect(writtenHint(page)).toBeHidden();
  });

  test('three + presses during Listen playback give 75 and the audible position keeps increasing: no stop, restart or end (SC-006)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await typeTempo(page, '72');
    await page.locator('.play-btn').click();
    await expect(page.locator('g.note.playing').first()).toBeVisible();

    const playingIndex = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('.mx-score-page g.note')).findIndex((n) =>
          n.classList.contains('playing'),
        ),
      );

    // Only once the cursor is well into the Score: a tempo message that jumped the position back to the start (the
    // defect T054 fixed) would then show as a drop, where a sample taken at the very start could not tell.
    await expect.poll(playingIndex).toBeGreaterThanOrEqual(3);

    // Record every transport phase from here on, so a stop or an end between two samples cannot hide.
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __phases: string[] }).__phases = seen;
      (window as unknown as { __TRANSPORT_STATE__: TransportSeam }).__TRANSPORT_STATE__.subscribe((state) => {
        if (seen.at(-1) !== state.phase) seen.push(state.phase);
      });
    });
    const samples: number[] = [];
    const sample = async () => {
      const index = await playingIndex();
      if (index >= 0) samples.push(index);
    };
    await sample();
    for (let press = 0; press < 3; press++) {
      await page.locator('[data-id="tempo-up"]').click();
      await page.waitForTimeout(400);
      await sample();
    }
    await expect(bpmInput(page)).toHaveValue('75');
    expect((await transportSnapshot(page)).tempoPercent).toBeCloseTo((100 * 75) / 90, 10);
    await page.waitForTimeout(600);
    await sample();

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i], `sample ${i} of ${samples.join(',')}`).toBeGreaterThanOrEqual(samples[i - 1] as number);
    }
    expect(samples.at(-1) as number).toBeGreaterThan(samples[0] as number);
    expect(await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases)).toEqual(['playing']);
    await expect(page.locator('.play-btn')).toHaveText('Pause');
  });

  test('with the cursor in the 60 section, typing 45 makes the repeated 90 section show 68 (US2 scenario 9)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await page.locator('.play-btn').click();
    await expect(bpmInput(page)).toHaveValue('60', { timeout: 30_000 });

    await typeTempo(page, '45');
    await expect(bpmInput(page)).toHaveValue('45');
    expect((await transportSnapshot(page)).tempoPercent).toBeCloseTo(75, 10);

    // m6 ends with the repeat: the second pass returns to the 90 section, 67.5 rounds half up to 68.
    await expect(bpmInput(page)).toHaveValue('68', { timeout: 30_000 });
    await expect(writtenHint(page)).toContainText('written 90');
  });

  test('Practice: + changes the tempo while the session keeps waiting at the same expected note (FR-013)', async ({
    page,
  }) => {
    await openFixture(page, 'tempo-change-90-60.musicxml');
    await startPracticeOnOpenScore(page);
    const before = await sessionIndex(page);

    await page.locator('[data-id="tempo-up"]').click();
    await expect(bpmInput(page)).toHaveValue('91');
    await page.locator('[data-id="tempo-up"]').click();
    await expect(bpmInput(page)).toHaveValue('92');

    expect(await sessionIndex(page)).toBe(before);
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop'); // the session is still running
    expect((await transportSnapshot(page)).tempoPercent).toBeCloseTo((100 * 92) / 90, 10);
  });
});

// quickstart.md "US3 - Play mode and the Grade" (feature 012). Play needs Web Audio and Web MIDI, neither of which
// Playwright WebKit provides (same treatment every other Play e2e spec gives it) - Chromium-only besides.
test.describe('US3: the same tempo field in Play mode, and the attempt it grades at', () => {
  test.beforeEach(async ({ browserName }, testInfo) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.skip(testInfo.project.name !== 'chromium', 'DOM/timing test of the field, not cross-browser rendering');
  });

  test('Play setup 75 -> the transport shows 75 too; both lock during the run; the attempt shows "75 BPM (75% of written)"', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(fixturePath('chords/c-major-scale-and-chords.musicxml')); // no tempo mark: written 100, quarter beat
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('#mode-controls mx-mode-switch input[value=play]').check();

    // In Play mode both fields exist at once (the transport's own, and the setup popup's) - scope each locator to
    // its host so a Playwright strict-mode match never sees both.
    const transportInput = page.locator('mx-transport [data-id="tempo-bpm"]');
    await openPanel(page, 'setup');
    const panel = page.locator('mx-play-panel');
    const panelInput = panel.locator('[data-id="tempo-bpm"]');
    await expect(panelInput).toHaveValue('100'); // a first Play setup starts at the written tempo (R-9)
    await panelInput.fill('75');
    await panelInput.press('Enter');
    await expect(panelInput).toHaveValue('75');

    // The transport's own field (the top bar, not the popup) edits the very same value (FR-017).
    await page.keyboard.press('Escape'); // close the setup popup
    await expect(transportInput).toHaveValue('75');

    await page.locator('.play-btn').click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__PLAY_STATE__.get().run?.phase), { timeout: 15_000 })
      .toMatch(/^(countIn|running)$/);
    await expect(transportInput).toHaveAttribute('readonly', ''); // locked during count-in/running (FR-017)

    await press(page, 60);
    await expect
      .poll(() => page.evaluate(() => (window as any).__PLAY_STATE__.get().grade?.complete), { timeout: 20_000 })
      .toBe(true);
    await expect(transportInput).not.toHaveAttribute('readonly'); // unlocked once the run ends

    await openPanel(page, 'attempts');
    await expect(page.locator('mx-attempts-list')).toContainText('75 BPM (75% of written)');
  });
});

// quickstart.md "Phone width" (feature 012, SC-004, T049). Chromium-only, same reasoning as the describes above.
test.describe('Phone width (SC-004, T049)', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the destructuring pattern to introspect fixtures
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM/timing test of the field, not cross-browser rendering');
  });

  async function openAt375(page: Page): Promise<void> {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const { item } = await revealLibraryItem(page, 'learning/key-changes/a-major-to-a-minor/beginner');
    await item.dblclick();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  }

  /** Every named element's box is inside [0, 375) horizontally - no overflow, nothing truncated off-screen. */
  async function expectOnScreen(page: Page, selectors: readonly string[]): Promise<void> {
    const bar = page.locator('#mx-bar');
    await expect.poll(() => bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const selector of selectors) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box?.x, selector).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), selector).toBeLessThanOrEqual(375);
    }
  }

  const TEMPO_FIELD_ELEMENTS = [
    '.play-btn',
    '.stop-btn',
    '[data-id="tempo-down"]',
    'input[data-id="tempo-bpm"]',
    '[data-id="tempo-unit"]',
    '[data-id="tempo-up"]',
    '[data-id="tempo-reset"]',
  ];

  test('the tempo field and the play buttons stay fully on screen, no overflow', async ({ page }) => {
    await openAt375(page);
    await expectOnScreen(page, TEMPO_FIELD_ELEMENTS);
  });

  test('with the Play setup open, the same field stays fully visible', async ({ page }) => {
    await openAt375(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    // The bar's own mode-switch is hidden at this width (this spec's other test); switch mode through the View
    // popup's instance instead, exactly as a musician would have to on a real phone this narrow.
    await openPanel(page, 'view');
    await page.locator('mx-view-panel mx-mode-switch input[value=play]').check();
    await page.keyboard.press('Escape');
    await openPanel(page, 'setup');
    await expect(page.locator('mx-play-panel input[data-id="tempo-bpm"]')).toBeVisible();
    // Both the transport's own field and the Play setup's are on screen at once now - scope to the transport's,
    // the one that must never move or overflow regardless of what else is open (FR-017).
    await expectOnScreen(
      page,
      TEMPO_FIELD_ELEMENTS.map((selector) => (selector.startsWith('.') ? selector : `mx-transport ${selector}`)),
    );
  });

  test('mode-switch and Score size, hidden from the bar at this width, are reachable through the View popup', async ({
    page,
  }) => {
    await openAt375(page);
    await expect(page.locator('#mode-controls')).toBeHidden();
    await expect(page.locator('#size-controls')).toBeHidden();

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await openPanel(page, 'view');
    const panel = page.locator('mx-view-panel');
    await expect(panel.locator('mx-mode-switch input[value=play]')).toBeVisible();
    await expect(panel.locator('mx-size-controls button[data-action="larger"]')).toBeVisible();
    await panel.locator('mx-mode-switch input[value=play]').check();
    await expect.poll(() => page.evaluate(() => (window as any).__PRACTICE_STATE__.get().mode)).toBe('play');
  });

  test('FR-006: the number and unit are at least as large as another transport label', async ({ page }) => {
    const fontSize = (selector: string) =>
      page.locator(selector).evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    // Desktop: Volume is on the bar, still a fair "other transport label" comparison.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    const wide = await revealLibraryItem(page, 'learning/key-changes/a-major-to-a-minor/beginner');
    await wide.item.dblclick();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    const volumeSize = await fontSize('.volume-label');
    expect(await fontSize('input[data-id="tempo-bpm"]')).toBeGreaterThanOrEqual(volumeSize);
    expect(await fontSize('[data-id="tempo-unit"]')).toBeGreaterThanOrEqual(volumeSize);

    // Phone width: Volume itself is hidden here (this spec's own choice), so compare against Play/Stop instead -
    // still "another transport label" in the same bar.
    await openAt375(page);
    const playSize = await fontSize('.play-btn');
    expect(await fontSize('input[data-id="tempo-bpm"]')).toBeGreaterThanOrEqual(playSize);
    expect(await fontSize('[data-id="tempo-unit"]')).toBeGreaterThanOrEqual(playSize);
  });
});
