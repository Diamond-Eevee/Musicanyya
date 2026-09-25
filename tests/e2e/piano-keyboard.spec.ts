import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

/**
 * Feature 010 (the on-screen piano as a real keyboard), end to end. happy-dom lays nothing out, so the real geometry is
 * measured here in the browser: the layout rules themselves are proven in tests/ui/piano/keyboard-layout.test.ts.
 * US1 (look and fit) first; the marking placement of US2 is appended by its own tasks. Reference pictures for the
 * manual checks go to tests/.generated/010/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

/** Windows of FR-012 / SC-002 / SC-006: from the smallest supported width to a large monitor, tall and short. */
const SIZES = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1280, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1600, height: 1080 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

const WHITE_KEY_ASPECT = 4; // spec FR-005: a white key is about four times as long as wide ...
const HEIGHT_CAP_PX = 160; // ... up to this many pixels ...
const HEIGHT_CAP_VH = 20; // ... or this share of the window height, whichever is smaller
const BLACK_LENGTH_RATIO = 0.64; // FR-004
const BLACK_WIDTH_RATIO = 0.58; // FR-004
const ONE_PIXEL = 1;

interface KeyBox {
  key: number;
  black: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface KeyboardMeasure {
  keys: KeyBox[];
  labels: { key: number; text: string }[];
  windowWidth: number;
  windowHeight: number;
  documentScroll: { scrollWidth: number; clientWidth: number };
  hostScroll: { scrollWidth: number; clientWidth: number };
  hostHeight: number;
  insetBottom: number;
}

/** Everything the checks need, read in one round trip from the shadow DOM of the element. */
async function measure(page: Page): Promise<KeyboardMeasure> {
  return page.evaluate(() => {
    const host = document.querySelector('mx-piano-keys');
    const shadow = host?.shadowRoot;
    if (!host || !shadow) throw new Error('mx-piano-keys is not in the page');
    const keys = Array.from(shadow.querySelectorAll<HTMLElement>('.key[data-key]')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        key: Number(el.dataset.key),
        black: el.classList.contains('black'),
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    });
    const labels = Array.from(shadow.querySelectorAll<HTMLElement>('.key-label')).map((el) => ({
      key: Number(el.closest('.key')?.getAttribute('data-key')),
      text: el.textContent ?? '',
    }));
    const doc = document.documentElement;
    return {
      keys,
      labels,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      documentScroll: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth },
      hostScroll: { scrollWidth: host.scrollWidth, clientWidth: host.clientWidth },
      hostHeight: host.getBoundingClientRect().height,
      insetBottom: Number.parseFloat(getComputedStyle(doc).getPropertyValue('--mx-inset-bottom')),
    };
  });
}

/** Waits two drawn frames: resizes are pure CSS, but the ResizeObserver of the strip reports on the next frame. */
const settle = (page: Page) =>
  page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))');

/** Opens the app at the given window size with the on-screen piano switched on through the View menu, and a Score. */
async function openWithPiano(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await openPanel(page, 'view');
  await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
  await page.keyboard.press('Escape');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-piano-keys')).toBeVisible();
  await settle(page);
}

/** No sideways scrolling and every one of the 88 keys inside the window (FR-006, SC-002). */
function expectFitsWindow(m: KeyboardMeasure): void {
  expect(m.keys, 'all 88 keys are drawn').toHaveLength(88);
  expect(m.documentScroll.scrollWidth, 'the document does not scroll sideways').toBeLessThanOrEqual(
    m.documentScroll.clientWidth,
  );
  expect(m.hostScroll.scrollWidth, 'the piano strip does not scroll sideways').toBeLessThanOrEqual(
    m.hostScroll.clientWidth,
  );
  for (const k of m.keys) {
    expect(k.left, `key ${k.key} left edge`).toBeGreaterThanOrEqual(-0.5);
    expect(k.right, `key ${k.key} right edge`).toBeLessThanOrEqual(m.windowWidth + 0.5);
    expect(k.top, `key ${k.key} top edge`).toBeGreaterThanOrEqual(0);
    expect(k.bottom, `key ${k.key} bottom edge`).toBeLessThanOrEqual(m.windowHeight + 0.5);
  }
}

/** The look of a real keyboard and its proportions (FR-001 to FR-008, SC-001, SC-002, SC-006). */
function expectRealKeyboard(m: KeyboardMeasure): void {
  expectFitsWindow(m);
  const byKey = new Map(m.keys.map((k) => [k.key, k]));
  const key = (n: number): KeyBox => {
    const found = byKey.get(n);
    if (!found) throw new Error(`no key ${n}`);
    return found;
  };
  const whites = m.keys.filter((k) => !k.black);
  const blacks = m.keys.filter((k) => k.black);
  expect(whites).toHaveLength(52);
  expect(blacks).toHaveLength(36);

  // Contiguous white keys of equal width, side by side
  const white = whites[0] as KeyBox;
  for (let i = 1; i < whites.length; i++) {
    const previous = whites[i - 1] as KeyBox;
    const current = whites[i] as KeyBox;
    expect(
      Math.abs(current.left - previous.right),
      `white key ${current.key} touches ${previous.key}`,
    ).toBeLessThanOrEqual(ONE_PIXEL);
    expect(Math.abs(current.width - white.width), `white key ${current.key} width`).toBeLessThanOrEqual(ONE_PIXEL);
    expect(Math.abs(current.top - white.top), `white key ${current.key} top`).toBeLessThanOrEqual(ONE_PIXEL);
  }

  // Black keys: on top, between their two white neighbours, from the top edge, shorter and narrower
  for (const black of blacks) {
    const left = key(black.key - 1);
    const right = key(black.key + 1);
    expect(black.left, `black ${black.key} is right of the white ${left.key} start`).toBeGreaterThan(left.left);
    expect(black.right, `black ${black.key} is left of the white ${right.key} end`).toBeLessThan(right.right);
    expect(Math.abs(black.top - white.top), `black ${black.key} starts at the keyboard's top`).toBeLessThanOrEqual(
      ONE_PIXEL,
    );
    expect(Math.abs(black.height / white.height - BLACK_LENGTH_RATIO), `black ${black.key} length`).toBeLessThanOrEqual(
      0.02,
    );
    expect(Math.abs(black.width / white.width - BLACK_WIDTH_RATIO), `black ${black.key} width`).toBeLessThanOrEqual(
      0.03,
    );
  }

  // Proportions of a piano key, capped (SC-006): four times as long as wide, never above the smaller cap
  const cap = Math.min(HEIGHT_CAP_PX, (HEIGHT_CAP_VH / 100) * m.windowHeight);
  expect(
    Math.abs(white.height - Math.min(WHITE_KEY_ASPECT * white.width, cap)),
    `white keys are ${white.height} px tall and ${white.width} px wide (cap ${cap})`,
  ).toBeLessThanOrEqual(ONE_PIXEL);

  // Fills the window's width (SC-002): the last key ends within one white key of the right edge
  const last = key(108);
  expect(m.windowWidth - last.right, 'the last key ends at the right edge').toBeLessThanOrEqual(white.width);
  expect(m.windowWidth - last.right, 'the last key is inside the window').toBeGreaterThanOrEqual(-0.5);
  expect(key(21).left, 'the first key starts at the left edge').toBeLessThanOrEqual(white.width);

  // Labels: the C keys only, C1 ... C8, middle C is C4 (FR-007)
  expect(m.labels.map((l) => l.text)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
  expect(m.labels.find((l) => l.key === 60)?.text).toBe('C4');

  // The Score stays clear of the strip: its bottom inset is the strip's height (004)
  expect(Math.abs(m.insetBottom - m.hostHeight), 'the bottom inset equals the strip height').toBeLessThanOrEqual(
    ONE_PIXEL,
  );
}

test.describe('US1: the on-screen piano looks like a real 88-key keyboard (feature 010)', () => {
  for (const size of SIZES) {
    test(`at ${size.width} x ${size.height}: 52 white and 36 black keys in proportion, filling the width, no sideways scroll`, async ({
      page,
    }) => {
      await openWithPiano(page, size);
      expectRealKeyboard(await measure(page));
    });
  }

  test('after resizing the window from 1920 to 1280 wide the same checks hold', async ({ page }) => {
    await openWithPiano(page, { width: 1920, height: 1080 });
    expectRealKeyboard(await measure(page));
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page);
    const resized = await measure(page);
    expect(resized.windowWidth).toBe(1280);
    expectRealKeyboard(resized);
  });

  test('below the design width (800 x 600) all 88 keys still fit, with no sideways scrolling', async ({ page }) => {
    await openWithPiano(page, { width: 800, height: 600 });
    expectFitsWindow(await measure(page));
  });
});
