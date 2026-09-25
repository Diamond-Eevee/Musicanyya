import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';
import { pressKeys, startPractice, startPracticeOnOpenScore } from './helpers/practice.js';

/**
 * Feature 008 (pressed keys on the Score), end to end: US1 here, US2 and US3 appended by their own tasks. Practice is
 * driven through the `e2e-midi` event (helpers/practice.ts); every check reads what the page really shows (computed
 * colours, classes, canvas calls), and reference pictures go to tests/.generated/008/ for the manual checks.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');
const generatedDir = path.join(__dirname, '../.generated/008');
const FUR_ELISE = 'repertoire/intermediate/fur-elise-theme';
const GREEN = 'rgb(0, 158, 115)'; // --practice-correct-color, Okabe-Ito bluish-green

// Practice needs Web Audio for the musician's own sound; Playwright's WebKit has no AudioContext (Safari-class
// browsers are view and Listen only), so these run on Chromium, Firefox and Electron (the same skip as us1-practice).
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Practice needs AudioContext, which Playwright WebKit does not provide');
});

async function screenshot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(generatedDir, { recursive: true });
  await page.screenshot({ path: path.join(generatedDir, name) });
}

/** Records every non-empty `setLineDash` pattern any canvas is given: a dashed outline of any kind shows up here (SC-003). */
async function spyOnDashes(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: number[][] = [];
    (window as unknown as { __dashes: number[][] }).__dashes = seen;
    const original = CanvasRenderingContext2D.prototype.setLineDash;
    CanvasRenderingContext2D.prototype.setLineDash = function (pattern: Iterable<number>) {
      const list = Array.from(pattern);
      if (list.length > 0) seen.push(list);
      return original.call(this, list);
    };
  });
}

const dashesSeen = (page: Page) => page.evaluate(() => (window as unknown as { __dashes: number[][] }).__dashes);

interface KeyNotes {
  key: number;
  noteIds: string[];
}

/** The required keys (with the Note IDs each key stands for) of every event of the running session. */
const eventKeys = (page: Page): Promise<KeyNotes[][]> =>
  page.evaluate(() => {
    const session = (
      window as unknown as {
        __PRACTICE_STATE__: {
          get(): { session: { events: { required: { key: number; noteIds: string[] }[] }[] } };
        };
      }
    ).__PRACTICE_STATE__.get().session;
    return session.events.map((event) => event.required.map((r) => ({ key: r.key, noteIds: [...r.noteIds] })));
  });

const sessionIndex = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (window as unknown as { __PRACTICE_STATE__: { get(): { session: { index: number } } } }).__PRACTICE_STATE__.get()
        .session.index,
  );

/** The `mx-mark-*` class of every note carrying one, by Note ID. */
const markClasses = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const found: Record<string, string> = {};
    for (const el of document.querySelectorAll('.mx-score-page g.note[class*="mx-mark-"]')) {
      found[el.id] = Array.from(el.classList)
        .filter((c) => c.startsWith('mx-mark-'))
        .join(' ');
    }
    return found;
  });

/** Computed fill of the notehead or the stem of a note. */
const fillOf = (page: Page, noteId: string, part: 'notehead' | 'stem'): Promise<string | null> =>
  page.evaluate(
    ([id, selector]) => {
      const el = document.getElementById(id as string)?.querySelector(`:scope > g.${selector}`);
      return el ? getComputedStyle(el).fill : null;
    },
    [noteId, part] as const,
  );

/** The rectangle of a note's `g.notehead`, in viewport coordinates. */
const headRect = (page: Page, noteId: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id)?.querySelector(':scope > g.notehead');
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  }, noteId);

const bandRect = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('.mx-practice-band');
    if (!band || band.hidden) return null;
    const r = band.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });

const clickSize = async (page: Page, action: 'larger' | 'smaller') => {
  await page.locator(`mx-size-controls button[data-action="${action}"]`).first().click();
};

test.describe('US1: correct notes turn green (feature 008)', () => {
  test('Fur Elise: four correct notes turn green, stems stay black, the band stands behind the next E5, nothing is dashed', async ({
    page,
  }) => {
    await spyOnDashes(page);
    await startPractice(page, FUR_ELISE);
    const events = await eventKeys(page);
    const firstFour = events.slice(0, 4).flatMap((event) => event.flatMap((r) => r.noteIds));
    expect(firstFour).toHaveLength(4);

    // What the stems look like before anything is played (the note is drawn as the score prints it)
    const stemsBefore = await Promise.all(firstFour.map((id) => fillOf(page, id, 'stem')));
    const headBefore = await fillOf(page, firstFour[0] as string, 'notehead');
    expect(headBefore).not.toBe(GREEN);

    await pressKeys(page, '+76,-76,+75,-75,+76,-76,+75,-75,wait');
    expect(await sessionIndex(page)).toBe(4);

    // (a) the four noteheads are green, the stems are as printed
    for (const id of firstFour) {
      await expect.poll(() => fillOf(page, id, 'notehead'), { message: `notehead of ${id}` }).toBe(GREEN);
    }
    expect(await Promise.all(firstFour.map((id) => fillOf(page, id, 'stem')))).toEqual(stemsBefore);
    const classes = await markClasses(page);
    expect(Object.keys(classes).sort()).toEqual([...firstFour].sort()); // exactly those four, nothing else marked

    // (b) the next E5 stands inside the band's box
    const nextHead = await headRect(page, events[4]?.[0]?.noteIds[0] as string);
    const band = await bandRect(page);
    expect(band, 'the band is shown').not.toBeNull();
    expect(nextHead).not.toBeNull();
    if (band && nextHead) {
      expect(band.left).toBeLessThanOrEqual(nextHead.left);
      expect(band.right).toBeGreaterThanOrEqual(nextHead.right);
      expect(band.top).toBeLessThanOrEqual(nextHead.top);
      expect(band.bottom).toBeGreaterThanOrEqual(nextHead.bottom);
    }

    // (c) no canvas call draws a dashed line, and no dashed square or ring is left anywhere
    expect(await dashesSeen(page)).toEqual([]);
    await screenshot(page, 'us1.png');
  });

  test('(d) the notehead is green within 50 ms of the key going down (SC-001)', async ({ page }) => {
    await startPractice(page, FUR_ELISE);
    const events = await eventKeys(page);
    const first = events[0]?.[0] as KeyNotes;
    const elapsed = await page.evaluate(
      async ({ key, id }) => {
        const el = document.getElementById(id);
        const t0 = performance.now();
        window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, key, 100] }));
        while (!el?.classList.contains('mx-mark-correct')) {
          if (performance.now() - t0 > 1000) return -1;
          await new Promise((done) => requestAnimationFrame(done));
        }
        return performance.now() - t0;
      },
      { key: first.key, id: first.noteIds[0] as string },
    );
    expect(elapsed, 'the class appeared').toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThanOrEqual(50);
  });

  test('(e) the marks layer off shows no green head, (f) a new session clears every class', async ({ page }) => {
    await startPractice(page, FUR_ELISE);
    const events = await eventKeys(page);
    const first = events[0]?.[0]?.noteIds[0] as string;
    await pressKeys(page, '+76,-76,wait');
    await expect.poll(() => markClasses(page)).toHaveProperty([first]);

    // (f) Stop, then Start again: a new session, every note back in its printed colour
    const start = page.locator('mx-transport .play-btn');
    await start.click();
    await expect(start).toHaveText('Start');
    await start.click();
    await expect(start).toHaveText('Stop');
    await pressKeys(page, 'wait');
    await expect.poll(() => markClasses(page)).toEqual({});
    expect(await fillOf(page, first, 'notehead')).not.toBe(GREEN);

    // (e) with the layer off (set while no run is active: popups close during a run), nothing turns green
    await start.click();
    await expect(start).toHaveText('Start');
    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="marks"]').uncheck();
    await page.keyboard.press('Escape');
    await start.click();
    await expect(start).toHaveText('Stop');
    await pressKeys(page, '+76,-76,+75,-75,wait,wait');
    expect(await sessionIndex(page)).toBe(2); // the session itself is unaffected
    expect(await markClasses(page)).toEqual({});
    expect(await fillOf(page, first, 'notehead')).not.toBe(GREEN);
  });

  test('(g) zoom in and out keeps every green head green and the band behind the next note (FR-013)', async ({
    page,
  }) => {
    await startPractice(page, FUR_ELISE);
    const events = await eventKeys(page);
    const played = events.slice(0, 2).flatMap((event) => event.flatMap((r) => r.noteIds));
    await pressKeys(page, '+76,-76,+75,-75,wait');
    await expect.poll(async () => Object.keys(await markClasses(page)).length).toBe(played.length);

    for (const action of ['larger', 'smaller'] as const) {
      const before = await page.evaluate(() => document.querySelector('.mx-score-page svg')?.innerHTML.length ?? 0);
      await clickSize(page, action);
      // The page is engraved again at the new size (a new svg), then every class and the band are back
      await expect
        .poll(async () => page.evaluate(() => document.querySelector('.mx-score-page svg')?.innerHTML.length ?? 0), {
          timeout: 15_000,
        })
        .not.toBe(before);
      for (const id of played) {
        await expect.poll(() => fillOf(page, id, 'notehead'), { message: `after ${action}: ${id}` }).toBe(GREEN);
      }
      const next = await headRect(page, events[2]?.[0]?.noteIds[0] as string);
      await expect
        .poll(async () => {
          const band = await bandRect(page);
          const head = await headRect(page, events[2]?.[0]?.noteIds[0] as string);
          return Boolean(
            band &&
              head &&
              band.left <= head.left &&
              band.right >= head.right &&
              band.top <= head.top &&
              band.bottom >= head.bottom,
          );
        })
        .toBe(true);
      expect(next).not.toBeNull();
    }
    await screenshot(page, 'us1-zoom.png');
  });

  test('(h) in a looped passage each green head clears exactly when the cursor reaches it again (FR-012)', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'chords/c-major-scale-and-chords.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await openPanel(page, 'setup');
    const panel = page.locator('mx-practice-panel');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.evaluate(() =>
      (window as unknown as { __PRACTICE_STATE__: { setMode(m: string): void } }).__PRACTICE_STATE__.setMode(
        'practice',
      ),
    );
    await panel.getByLabel('From measure').fill('1');
    await panel.getByLabel('From measure').press('Tab');
    await panel.getByLabel('To measure').fill('2');
    await panel.getByLabel('To measure').press('Tab');
    await expect(panel).toContainText('Looping measures 1-2');
    await startPracticeOnOpenScore(page);

    const events = await eventKeys(page);
    const noteOf = (index: number) => events[index]?.flatMap((r) => r.noteIds) ?? [];
    expect(events.length).toBe(8); // C D E F, the C-E-G chord, F E D

    // First pass through everything: 60 62 64 65, chord 60+64+67, 65 64 62 -> the cursor wraps to the start
    await pressKeys(page, '+60,-60,+62,-62,+64,-64,+65,-65,+60,+64,+67,-60,-64,-67,+65,-65,+64,-64,+62,-62,wait');
    expect(await sessionIndex(page)).toBe(0); // the last D4 was played: the loop wrapped to its first event
    await expect
      .poll(() => markClasses(page).then((c) => Object.keys(c).length))
      .toBe(events.flatMap((_e, i) => noteOf(i)).length - noteOf(0).length);

    // At the wrap only event 0 has been reached again: its note is clear, every other note is still green
    let classes = await markClasses(page);
    for (const id of noteOf(0)) expect(classes[id], `event 0 note ${id} cleared on arrival`).toBeUndefined();
    for (let i = 1; i < events.length; i++)
      for (const id of noteOf(i)) expect(classes[id], `event ${i}`).toBe('mx-mark-correct');

    // Play event 0 again: the cursor reaches event 1 and clears only its note; event 2 onward are still green
    await pressKeys(page, '+60,-60,wait');
    expect(await sessionIndex(page)).toBe(1);
    await expect.poll(() => markClasses(page).then((c) => c[noteOf(0)[0] as string])).toBe('mx-mark-correct');
    classes = await markClasses(page);
    for (const id of noteOf(1)) expect(classes[id], 'event 1 cleared on arrival').toBeUndefined();
    for (let i = 2; i < events.length; i++)
      for (const id of noteOf(i)) expect(classes[id], `event ${i}`).toBe('mx-mark-correct');
  });

  test('chord: two held keys are two green heads, releasing one takes its green away (FR-003)', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'chords/c-major-scale-and-chords.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await startPracticeOnOpenScore(page);
    const events = await eventKeys(page);
    const chord = events[4] as KeyNotes[];
    expect(chord.map((r) => r.key)).toEqual([60, 64, 67]);
    const noteOf = (key: number) => chord.find((r) => r.key === key)?.noteIds[0] as string;

    await pressKeys(page, '+60,-60,+62,-62,+64,-64,+65,-65,+60,+64,wait');
    expect(await sessionIndex(page)).toBe(4); // the chord is not complete
    await expect.poll(() => markClasses(page).then((c) => Object.keys(c).length)).toBe(6); // four notes + two chord heads
    let classes = await markClasses(page);
    expect(classes[noteOf(60)]).toBe('mx-mark-correct');
    expect(classes[noteOf(64)]).toBe('mx-mark-correct');
    expect(classes[noteOf(67)]).toBeUndefined();
    expect(await fillOf(page, noteOf(67), 'notehead')).not.toBe(GREEN);
    await screenshot(page, 'us1-chord.png');

    await pressKeys(page, '-64,wait');
    await expect.poll(() => markClasses(page).then((c) => c[noteOf(64)])).toBeUndefined();
    classes = await markClasses(page);
    expect(classes[noteOf(60)]).toBe('mx-mark-correct'); // the one still held stays green
  });
});
