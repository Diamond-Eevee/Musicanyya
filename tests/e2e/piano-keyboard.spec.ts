import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';
import { pressKeys, startPracticeOnOpenScore } from './helpers/practice.js';

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

// ---------------------------------------------------------------------------------------------------------------
// US2: pressed keys and feedback sit on the right key, inside its uncovered part, readable on white and black keys
// ---------------------------------------------------------------------------------------------------------------

const CMAJOR_ITEM = 'learning/chords/c-major-scale-and-chords';
const OUTSIDE_TOLERANCE_PX = 0.5;
const LIGHT_LUMINANCE = 0.6; // SC-004: a badge or ring on a black key is light
const MIN_PRESSED_CONTRAST = 0.05; // SC-004: a pressed key differs from a free one in greyscale
const MAX_MARKING_SHARE = 0.9; // analyze F3: a badge or dot is at most this share of the key it sits on

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface KeyState {
  key: number;
  black: boolean;
  box: Box;
  classes: string[];
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  boxShadows: string[];
  background: string;
}

interface Marking {
  kind: 'mark' | 'dot' | 'label';
  key: number;
  box: Box;
  background: string;
  borderColor: string;
  borderWidth: number;
}

/** Everything about the keys and their markings, in one round trip from the shadow DOM. */
async function collectStates(page: Page): Promise<{ keys: KeyState[]; markings: Marking[] }> {
  return page.evaluate(() => {
    const shadow = document.querySelector('mx-piano-keys')?.shadowRoot;
    if (!shadow) throw new Error('mx-piano-keys is not in the page');
    const boxOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    // A computed box-shadow lists shadows separated by commas, but colours such as rgb(1, 2, 3) hold commas too
    const splitShadows = (value: string): string[] => {
      if (value === 'none') return [];
      const parts: string[] = [];
      let depth = 0;
      let current = '';
      for (const ch of value) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
        } else current += ch;
      }
      parts.push(current.trim());
      return parts;
    };
    const keys: KeyState[] = [];
    const markings: Marking[] = [];
    for (const el of Array.from(shadow.querySelectorAll<HTMLElement>('.key[data-key]'))) {
      const style = getComputedStyle(el);
      const key = Number(el.dataset.key);
      keys.push({
        key,
        black: el.classList.contains('black'),
        box: boxOf(el),
        classes: Array.from(el.classList),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineOffset: Number.parseFloat(style.outlineOffset),
        boxShadows: splitShadows(style.boxShadow),
        background: style.backgroundColor,
      });
      for (const [selector, kind] of [
        ['.key-mark', 'mark'],
        ['.key-dot', 'dot'],
        ['.key-label', 'label'],
      ] as const) {
        for (const child of Array.from(el.querySelectorAll<HTMLElement>(selector))) {
          const childStyle = getComputedStyle(child);
          markings.push({
            kind,
            key,
            box: boxOf(child),
            background: childStyle.backgroundColor,
            borderColor: childStyle.borderTopColor,
            borderWidth: Number.parseFloat(childStyle.borderTopWidth),
          });
        }
      }
    }
    return { keys, markings };
  });
}

/** "rgb(r, g, b)" or "rgba(r, g, b, a)" as sRGB values 0..1 and alpha. */
function parseColour(value: string): { r: number; g: number; b: number; a: number } {
  const numbers = (value.match(/[\d.]+/g) ?? []).map(Number);
  const [r = 0, g = 0, b = 0, a = 1] = numbers;
  return { r: r / 255, g: g / 255, b: b / 255, a };
}

/** The luminance a greyscale picture would show (the weights of CSS `grayscale(1)` on the encoded values), so "light"
 *  and "differs" mean what the greyscale check of SC-004 means. */
function luminance(value: string): number {
  const { r, g, b } = parseColour(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The keys that carry a marking of this kind, in key order (the DOM lists white keys before black ones). */
const keysWith = (markings: Marking[], kind: Marking['kind']) =>
  markings
    .filter((m) => m.kind === kind)
    .map((m) => m.key)
    .sort((a, b) => a - b);

const inside = (inner: Box, outer: Box) =>
  inner.left >= outer.left - OUTSIDE_TOLERANCE_PX &&
  inner.right <= outer.right + OUTSIDE_TOLERANCE_PX &&
  inner.top >= outer.top - OUTSIDE_TOLERANCE_PX &&
  inner.bottom <= outer.bottom + OUTSIDE_TOLERANCE_PX;

const overlap = (a: Box, b: Box) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > OUTSIDE_TOLERANCE_PX &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OUTSIDE_TOLERANCE_PX;

/** Practice on the C major exercise with the on-screen piano switched on, at the given window size. */
async function practiceWithPiano(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await openPanel(page, 'view');
  await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
  await page.keyboard.press('Escape');
  await openPanel(page, 'scores');
  await page.locator(`.library-item-open[data-id="${CMAJOR_ITEM}"]`).click();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await startPracticeOnOpenScore(page);
  await expect(page.locator('mx-piano-keys')).toBeVisible();
}

type PracticeSeam = {
  clearAllKeyFeedback(): void;
  setKeyFeedback(key: number, feedback: { state: string; messageId?: string }): void;
  setHelpOverlay(overlay: { reason: string; keys: { key: number; noteName: string; fingering: null }[] }): void;
};

/** Every state on white and black keys at once: held keys (white 60 62 64, black 61), a wrong pitch, wrong octave and
 *  extra key of each colour, and help on a white and a black key. Feedback is set after the keys are pressed so that
 *  Practice's own judgement of the presses cannot replace it. */
async function setUpStates(page: Page): Promise<void> {
  await pressKeys(page, '+60,+61,+62,+64,wait');
  await page.evaluate(() => {
    const practice = (window as unknown as { __PRACTICE_STATE__: PracticeSeam }).__PRACTICE_STATE__;
    practice.clearAllKeyFeedback(); // Practice's own judgement of the presses; 64 stays held and unmarked
    practice.setKeyFeedback(60, { state: 'wrongPitch' }); // white, held, labelled C4
    practice.setKeyFeedback(61, { state: 'wrongPitch' }); // black, held
    practice.setKeyFeedback(62, { state: 'extra' }); // white, held
    practice.setKeyFeedback(63, { state: 'extra' }); // black
    practice.setKeyFeedback(65, { state: 'wrongOctave' }); // white
    practice.setKeyFeedback(66, { state: 'wrongOctave', messageId: 'practice.octave.lower' }); // black
    practice.setHelpOverlay({
      reason: 'requested',
      keys: [
        { key: 67, noteName: 'G4', fingering: null }, // white
        { key: 68, noteName: 'G#4', fingering: null }, // black
      ],
    });
  });
  await pressKeys(page, 'wait');
}

// Practice needs Web Audio; Playwright's WebKit has no AudioContext or Web MIDI (as pressed-keys.spec.ts)
test.describe('US2: states on the realistic keys (feature 010)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'Practice needs AudioContext, which Playwright WebKit does not provide');
  });

  for (const size of [
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    test(`at ${size.width} x ${size.height}: markings lie inside their own key, below the black keys on white keys, and states stay inside the key`, async ({
      page,
    }) => {
      await practiceWithPiano(page, size);
      await setUpStates(page);
      const { keys, markings } = await collectStates(page);
      const keyOf = (n: number) => keys.find((k) => k.key === n) as KeyState;
      const blackBoxes = keys.filter((k) => k.black).map((k) => k.box);

      // All the states are showing (else the checks below prove nothing)
      expect(keysWith(markings, 'dot')).toEqual([60, 61, 62, 64]);
      expect(keysWith(markings, 'mark')).toEqual([60, 61, 62, 63, 65, 66, 67, 68]);
      expect(markings.filter((m) => m.kind === 'label')).toHaveLength(8);

      for (const m of markings) {
        const own = keyOf(m.key);
        expect(inside(m.box, own.box), `${m.kind} of key ${m.key} lies inside its own key`).toBe(true);
        if (!own.black) {
          // on a white key: below the bottom of the black keys, so no black key covers it (FR-011, SC-007)
          const blackBottom = own.box.top + 0.64 * own.box.height;
          expect(m.box.top, `${m.kind} of white key ${m.key} starts below the black keys`).toBeGreaterThanOrEqual(
            blackBottom - OUTSIDE_TOLERANCE_PX,
          );
          for (const black of blackBoxes) {
            expect(overlap(m.box, black), `${m.kind} of white key ${m.key} is not under a black key`).toBe(false);
          }
        }
      }

      // Borders and glow stay inside the key: an outline pulled inside it, and only inset shadows (FR-011)
      for (const key of [60, 61, 62, 63, 65, 66, 67, 68]) {
        const state = keyOf(key);
        expect(state.outlineStyle, `key ${key} has an outline`).not.toBe('none');
        expect(state.outlineOffset, `key ${key} outline offset`).toBeLessThanOrEqual(-state.outlineWidth);
        for (const shadow of state.boxShadows) expect(shadow, `key ${key} shadow`).toContain('inset');
      }

      // A pressed key differs in lightness from a free one, on a white and on a black key (SC-004)
      const freeWhite = keyOf(69); // A4, nothing on it
      const freeBlack = keyOf(70); // A#4, nothing on it
      expect(freeWhite.classes).not.toContain('pressed');
      expect(freeBlack.classes).not.toContain('pressed');
      for (const [pressed, free] of [
        [keyOf(64), freeWhite],
        [keyOf(61), freeBlack],
      ] as const) {
        expect(pressed.classes, `key ${pressed.key} is held`).toContain('pressed');
        expect(
          Math.abs(luminance(pressed.background) - luminance(free.background)),
          `pressed key ${pressed.key} against free key ${free.key}`,
        ).toBeGreaterThanOrEqual(MIN_PRESSED_CONTRAST);
      }

      // On a black key the badge behind a glyph and the ring of the dot are light, and neither is wider than 0.9 of it
      for (const m of markings.filter((x) => keyOf(x.key).black && x.kind !== 'label')) {
        const width = keyOf(m.key).box.width;
        expect(m.box.width, `${m.kind} of black key ${m.key} width`).toBeLessThanOrEqual(
          MAX_MARKING_SHARE * width + OUTSIDE_TOLERANCE_PX,
        );
        if (m.kind === 'mark') {
          expect(parseColour(m.background).a, `badge of black key ${m.key} is opaque`).toBeGreaterThanOrEqual(0.9);
          expect(luminance(m.background), `badge of black key ${m.key}`).toBeGreaterThan(LIGHT_LUMINANCE);
        } else {
          expect(luminance(m.borderColor), `ring of the dot on black key ${m.key}`).toBeGreaterThan(LIGHT_LUMINANCE);
        }
      }

      // The hint text and the sustain indicator still show (AS-2.6)
      await expect(page.locator('mx-piano-keys .key-message[data-key="66"]')).toBeVisible();
      await expect(page.locator('mx-piano-keys .key-message[data-key="66"]')).toContainText('Play one octave lower.');
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0xb0, 64, 127] })));
      await expect(page.locator('mx-piano-keys .sustain-indicator.down')).toBeVisible();
    });
  }

  test("with keys 60-69 held (white and black), no marking touches another key's marking or a covered part of another key", async ({
    page,
  }) => {
    await practiceWithPiano(page, { width: 1024, height: 768 });
    await pressKeys(page, '+60,+61,+62,+63,+64,+65,+66,+67,+68,+69,wait');
    const { keys, markings } = await collectStates(page);
    expect(keysWith(markings, 'dot')).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
    for (let i = 0; i < markings.length; i++) {
      for (let j = i + 1; j < markings.length; j++) {
        const a = markings[i] as Marking;
        const b = markings[j] as Marking;
        if (a.key === b.key) continue;
        expect(overlap(a.box, b.box), `${a.kind} of key ${a.key} and ${b.kind} of key ${b.key} do not touch`).toBe(
          false,
        );
      }
    }
    // a marking of a white key never sits under a black key, a marking of a black key stays inside the black key
    for (const m of markings) {
      const own = keys.find((k) => k.key === m.key) as KeyState;
      expect(inside(m.box, own.box), `${m.kind} of key ${m.key} inside its key`).toBe(true);
      if (!own.black) {
        for (const black of keys.filter((k) => k.black)) {
          expect(overlap(m.box, black.box), `${m.kind} of white key ${m.key} against black key ${black.key}`).toBe(
            false,
          );
        }
      }
    }
  });
});

// Reference pictures for the manual checks (T014, T017, SC-003, SC-004): the strip with every state at once, in colour
// and in greyscale, whole and zoomed on the middle octave. Written to tests/.generated/010/ (git-ignored).
test.describe('US2: reference pictures of the states (feature 010)', () => {
  test.use({ deviceScaleFactor: 3 });

  test('pictures of the strip with every state, in colour and in greyscale', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one set of pictures is enough');
    await practiceWithPiano(page, { width: 1280, height: 800 });
    await setUpStates(page);
    const dir = path.join(__dirname, '../.generated/010');
    fs.mkdirSync(dir, { recursive: true });
    const { keys } = await collectStates(page);
    const box = (n: number) => (keys.find((k) => k.key === n) as KeyState).box;
    const zoom = {
      x: box(57).left,
      y: box(60).top - 4,
      width: box(71).right - box(57).left,
      height: box(60).height + 8,
    };
    const strip = page.locator('mx-piano-keys');
    await strip.screenshot({ path: path.join(dir, 't014-states.png') });
    await page.screenshot({ path: path.join(dir, 't014-states-zoom.png'), clip: zoom });
    await page.evaluate(() => {
      document.documentElement.style.filter = 'grayscale(1)';
    });
    await strip.screenshot({ path: path.join(dir, 't014-states-greyscale.png') });
    await page.screenshot({ path: path.join(dir, 't014-states-greyscale-zoom.png'), clip: zoom });
    expect(fs.existsSync(path.join(dir, 't014-states-greyscale-zoom.png'))).toBe(true);
  });
});
