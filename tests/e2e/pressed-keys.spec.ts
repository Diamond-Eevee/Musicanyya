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

// ---------------------------------------------------------------------------------------------------------------
// US2: wrong keys appear on the staff as red discs
// ---------------------------------------------------------------------------------------------------------------

/** One red disc as the overlay reports it (the `data-discs` seam on the overlay canvas, a debugging aid like
 *  `__PRACTICE_STATE__`): viewport CSS pixels. */
interface DiscInfo {
  key: number;
  staff: number;
  position: number;
  ledgerLines: number;
  ottava: number;
  alter: number;
  showAccidental: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  accidentalX: number | null;
}

const OVERLAY = 'canvas.mx-score-cursor';

const discs = (page: Page): Promise<DiscInfo[]> =>
  page.evaluate(
    (selector) => JSON.parse(document.querySelector(selector)?.getAttribute('data-discs') ?? '[]'),
    OVERLAY,
  );

/** How many pixels of the disc vermilion (#d55e00) the overlay has in a rectangle of the viewport (CSS pixels). */
const vermilionIn = (page: Page, box: { left: number; top: number; right: number; bottom: number }): Promise<number> =>
  page.evaluate(
    ({ selector, box }) => {
      const canvas = document.querySelector(selector) as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const k = canvas.width / rect.width;
      const x0 = Math.max(0, Math.floor((box.left - rect.left) * k));
      const y0 = Math.max(0, Math.floor((box.top - rect.top) * k));
      const w = Math.min(canvas.width - x0, Math.ceil((box.right - box.left) * k));
      const h = Math.min(canvas.height - y0, Math.ceil((box.bottom - box.top) * k));
      if (w <= 0 || h <= 0) return 0;
      const { data } = (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(x0, y0, w, h);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 0;
        const red = data[i] ?? 0;
        const green = data[i + 1] ?? 0;
        const blue = data[i + 2] ?? 0;
        if (alpha > 180 && Math.abs(red - 213) < 30 && Math.abs(green - 94) < 30 && blue < 40) count++;
      }
      return count;
    },
    { selector: OVERLAY, box },
  );

const around = (x: number, y: number, r: number) => ({ left: x - r, top: y - r, right: x + r, bottom: y + r });

/** The measured lines of the staff a note is printed on: the y of the bottom line and the space between two lines. */
const staffGeometryOf = (page: Page, noteId: string): Promise<{ bottomY: number; space: number } | null> =>
  page.evaluate((id) => {
    const staff = document.getElementById(id)?.closest('g.staff');
    if (!staff) return null;
    const ys = Array.from(staff.querySelectorAll(':scope > path'))
      .slice(0, 5)
      .map((p) => {
        const r = p.getBoundingClientRect();
        return (r.top + r.bottom) / 2;
      });
    if (ys.length < 5) return null;
    return { bottomY: Math.max(...ys), space: (Math.max(...ys) - Math.min(...ys)) / 4 };
  }, noteId);

const boxOf = (d: DiscInfo) => ({
  left: d.x - d.width / 2,
  right: d.x + d.width / 2,
  top: d.y - d.height / 2,
  bottom: d.y + d.height / 2,
});
const overlaps = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test.describe('US2: wrong keys appear on the staff as red discs (feature 008)', () => {
  /** Practice on Fur Elise, waiting at the first E5 (key 76); `pianoKeys` shows the on-screen keyboard too. */
  async function furElise(page: Page, options: { pianoKeys?: boolean; marks?: boolean } = {}) {
    await page.goto('/');
    if (options.pianoKeys || options.marks === false) {
      await openPanel(page, 'view');
      if (options.pianoKeys) await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
      if (options.marks === false) await page.locator('mx-view-panel input[data-layer="marks"]').uncheck();
      await page.keyboard.press('Escape');
    }
    await openPanel(page, 'scores');
    await page.locator(`.library-item-open[data-id="${FUR_ELISE}"]`).click();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await startPracticeOnOpenScore(page);
    const events = await eventKeys(page);
    const first = events[0]?.[0] as KeyNotes;
    expect(first.key).toBe(76);
    const noteId = first.noteIds[0] as string;
    // Measured when asked, not once: the page may scroll or reflow as the run starts (the on-screen keyboard appears)
    const yOf = async (position: number) => {
      const g = (await staffGeometryOf(page, noteId)) as { bottomY: number; space: number };
      return g.bottomY - (position * g.space) / 2;
    };
    return { noteId, yOf };
  }

  test('D5 held at the first E5: a red disc on the D5 line beside the black E5, gone on release', async ({ page }) => {
    const { noteId, yOf } = await furElise(page);
    await pressKeys(page, '+74');
    await expect.poll(async () => (await discs(page)).length).toBe(1);
    const [d] = (await discs(page)) as [DiscInfo];
    expect(d).toMatchObject({ key: 74, staff: 1, position: 6, ledgerLines: 0, ottava: 0 });
    expect(Math.abs(d.y - (await yOf(6)))).toBeLessThan(1); // exactly on the D5 position of the treble staff
    const head = (await headRect(page, noteId)) as { left: number; right: number; top: number; bottom: number };
    expect(overlaps(boxOf(d), head), 'the disc never covers the written head').toBe(false);
    expect(d.x - d.width / 2).toBeGreaterThanOrEqual(head.right - 0.5); // beside it, on the right
    expect(await vermilionIn(page, around(d.x, d.y, 2))).toBeGreaterThan(0); // and really painted
    expect(await fillOf(page, noteId, 'notehead')).not.toBe(GREEN); // the written E5 is not accepted
    expect(await sessionIndex(page)).toBe(0); // the cursor does not move
    await screenshot(page, 'us2-d5.png');

    await pressKeys(page, '-74');
    await expect.poll(async () => (await discs(page)).length).toBe(0);
    expect(await vermilionIn(page, around(d.x, d.y, 6))).toBe(0);
  });

  test('the disc appears and disappears within 50 ms of the key (SC-001, SC-002)', async ({ page }) => {
    await furElise(page);
    const timed = (down: boolean) =>
      page.evaluate(
        async ({ selector, down }) => {
          const canvas = document.querySelector(selector) as HTMLElement;
          const count = () => (JSON.parse(canvas.getAttribute('data-discs') ?? '[]') as unknown[]).length;
          const t0 = performance.now();
          window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [down ? 0x90 : 0x80, 74, down ? 100 : 0] }));
          while (down ? count() === 0 : count() > 0) {
            if (performance.now() - t0 > 1000) return -1;
            await new Promise((done) => requestAnimationFrame(done));
          }
          return performance.now() - t0;
        },
        { selector: OVERLAY, down },
      );
    const appeared = await timed(true);
    expect(appeared, 'the disc appeared').toBeGreaterThanOrEqual(0);
    expect(appeared).toBeLessThanOrEqual(50);
    const gone = await timed(false);
    expect(gone, 'the disc went').toBeGreaterThanOrEqual(0);
    expect(gone).toBeLessThanOrEqual(50);
  });

  test('E4 (a wrong octave): a disc one octave below the E5, and the on-screen keyboard and hint still answer (FR-011)', async ({
    page,
  }) => {
    const { yOf } = await furElise(page, { pianoKeys: true });
    await pressKeys(page, '+64');
    await expect.poll(async () => (await discs(page)).length).toBe(1);
    const [d] = (await discs(page)) as [DiscInfo];
    expect(d).toMatchObject({ key: 64, staff: 1, position: 0, ledgerLines: 0 }); // E4: the bottom line, 7 steps under E5
    expect(Math.abs(d.y - (await yOf(0)))).toBeLessThan(1);
    // the on-screen keyboard marks the key and the octave hint is still shown, as before this feature
    await expect(page.locator('mx-piano-keys .key[data-key="64"]')).toHaveClass(/wrong-octave/);
    await expect(page.locator('mx-piano-keys .key-message')).toContainText('Play one octave higher.');
  });

  test('a black key is drawn with an accidental sign', async ({ page }) => {
    await furElise(page);
    await pressKeys(page, '+70'); // A#4 / Bb4 in A minor with nothing written: a sharp
    await expect.poll(async () => (await discs(page)).length).toBe(1);
    const [d] = (await discs(page)) as [DiscInfo];
    expect(d).toMatchObject({ key: 70, alter: 1, showAccidental: true });
    expect(d.accidentalX).not.toBeNull();
    const ax = d.accidentalX as number;
    expect(ax).toBeLessThan(d.x - d.width / 2);
    // the glyph's ink is on the canvas, left of the disc
    expect(await vermilionIn(page, { left: ax, right: ax + 11, top: d.y - 15, bottom: d.y + 15 })).toBeGreaterThan(15);
    await screenshot(page, 'us2-sharp.png');
  });

  test('two keys held at once are two discs that touch neither each other nor the written head', async ({ page }) => {
    const { noteId } = await furElise(page);
    await pressKeys(page, '+74,+72'); // D5 and C5
    await expect.poll(async () => (await discs(page)).length).toBe(2);
    const [a, b] = (await discs(page)) as [DiscInfo, DiscInfo];
    expect(overlaps(boxOf(a), boxOf(b))).toBe(false);
    const head = (await headRect(page, noteId)) as { left: number; right: number; top: number; bottom: number };
    expect(overlaps(boxOf(a), head)).toBe(false);
    expect(overlaps(boxOf(b), head)).toBe(false);
    await screenshot(page, 'us2-two.png');
  });

  test('a very low key gets an ottava label on the bass staff instead of being parked at the edge', async ({
    page,
  }) => {
    await furElise(page);
    await pressKeys(page, '+21'); // A0
    await expect.poll(async () => (await discs(page)).length).toBe(1);
    const [d] = (await discs(page)) as [DiscInfo];
    expect(d).toMatchObject({ key: 21, staff: 2, ottava: -1 }); // folded one octave up: "8vb"
    expect(Math.abs(d.ledgerLines)).toBeLessThanOrEqual(5);
    // the label's ink is beside the disc
    const label = { left: d.x + d.width / 2, right: d.x + d.width / 2 + 40, top: d.y - 12, bottom: d.y + 12 };
    expect(await vermilionIn(page, label)).toBeGreaterThan(5);
    await screenshot(page, 'us2-a0.png');
  });

  test('with the marks layer off no disc is drawn, and the session goes on', async ({ page }) => {
    await furElise(page, { marks: false });
    await pressKeys(page, '+74,wait,wait');
    expect(await discs(page)).toEqual([]);
    expect(await vermilionIn(page, { left: 0, top: 0, right: 5000, bottom: 5000 })).toBe(0);
    expect(await sessionIndex(page)).toBe(0);
    await pressKeys(page, '-74,+76,-76,wait');
    expect(await sessionIndex(page)).toBe(1); // the correct key still moves on
  });

  test('when the MIDI keyboard is lost every disc goes at once and the green heads stay (edge case)', async ({
    page,
  }) => {
    const { noteId } = await furElise(page);
    await pressKeys(page, '+76,-76,wait'); // E5 accepted: green
    await expect.poll(() => fillOf(page, noteId, 'notehead')).toBe(GREEN);
    await pressKeys(page, '+61,+62');
    await expect.poll(async () => (await discs(page)).length).toBe(2);
    await page.evaluate(() => {
      const session = (globalThis as unknown as { mxSession: { midiInput: { emit(e: unknown): void } } }).mxSession;
      session.midiInput.emit({ type: 'deviceLost', heldKeys: [61, 62] });
    });
    await expect.poll(async () => (await discs(page)).length).toBe(0);
    expect(await fillOf(page, noteId, 'notehead')).toBe(GREEN);
  });

  test('zooming in and out keeps a held disc on its staff position (FR-013)', async ({ page }) => {
    const { noteId } = await furElise(page);
    await pressKeys(page, '+74');
    await expect.poll(async () => (await discs(page)).length).toBe(1);
    const offD5 = async () => {
      const [d] = await discs(page);
      const g = await staffGeometryOf(page, noteId);
      return d && g ? Math.abs(d.y - (g.bottomY - 3 * g.space)) : 999;
    };
    for (const action of ['larger', 'smaller'] as const) {
      const before = await page.evaluate(() => document.querySelector('.mx-score-page svg')?.innerHTML.length ?? 0);
      await clickSize(page, action);
      await expect
        .poll(() => page.evaluate(() => document.querySelector('.mx-score-page svg')?.innerHTML.length ?? 0), {
          timeout: 15_000,
        })
        .not.toBe(before);
      await expect.poll(offD5, { message: `after ${action}` }).toBeLessThan(1.5);
    }
  });

  test('ten wrong keys held at once are ten discs and the overlay keeps 60 frames a second', async ({ page }) => {
    await furElise(page);
    /** Frame-to-frame times of a 2 s stretch of requestAnimationFrame, in ms. */
    const sample = () =>
      page.evaluate(async () => {
        const deltas: number[] = [];
        let last = performance.now();
        const end = last + 2000;
        while (last < end) {
          await new Promise((done) => requestAnimationFrame(done));
          const now = performance.now();
          deltas.push(now - last);
          last = now;
        }
        return deltas;
      });
    const median = (frames: number[]) => [...frames].sort((x, y) => x - y)[Math.floor(frames.length / 2)] as number;
    const idle = await sample();
    await pressKeys(page, '+60,+61,+62,+63,+64,+65,+66,+67,+68,+69');
    await expect.poll(async () => (await discs(page)).length).toBe(10);
    const busy = await sample();
    expect(busy.length).toBeGreaterThan(60);
    // Headless Chromium's frame clock is not exact: even with no disc on the Score single frames take 18-19 ms (measured
    // 2026-09-25), so "no frame over 16.7 ms" cannot hold for any build. What ten discs could change is checked instead:
    // the typical frame stays at 60 Hz, no frame is skipped (a missed frame is about 33 ms), and the worst frame is no
    // worse than the worst frame of the idle sample by more than the clock's own jitter.
    expect(median(busy)).toBeLessThanOrEqual(17.5);
    expect(Math.max(...busy)).toBeLessThan(25);
    expect(Math.max(...busy)).toBeLessThanOrEqual(Math.max(...idle) + 3);
    await screenshot(page, 'us2-ten.png');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// US3: the other Practice states without dashed outlines
// ---------------------------------------------------------------------------------------------------------------

const ORANGE = 'rgb(230, 159, 0)'; // --practice-heldover-color
const GREY = 'rgb(153, 153, 153)'; // --practice-skipped-color

/** How many pixels of a given colour (within a tolerance) the overlay canvas has in a viewport rectangle. */
const inkIn = (
  page: Page,
  box: { left: number; top: number; right: number; bottom: number },
  rgb: [number, number, number],
): Promise<number> =>
  page.evaluate(
    ({ selector, box, rgb }) => {
      const canvas = document.querySelector(selector) as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const k = canvas.width / rect.width;
      const x0 = Math.max(0, Math.floor((box.left - rect.left) * k));
      const y0 = Math.max(0, Math.floor((box.top - rect.top) * k));
      const w = Math.min(canvas.width - x0, Math.ceil((box.right - box.left) * k));
      const h = Math.min(canvas.height - y0, Math.ceil((box.bottom - box.top) * k));
      if (w <= 0 || h <= 0) return 0;
      const { data } = (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(x0, y0, w, h);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const near = (a: number | undefined, b: number) => Math.abs((a ?? 0) - b) < 30;
        if ((data[i + 3] ?? 0) > 180 && near(data[i], rgb[0]) && near(data[i + 1], rgb[1]) && near(data[i + 2], rgb[2]))
          count++;
      }
      return count;
    },
    { selector: OVERLAY, box, rgb },
  );

type Rect = { left: number; right: number; top: number; bottom: number };
const above = (r: Rect): Rect => ({
  left: r.left - 3,
  right: r.right + 3,
  top: r.top - (r.bottom - r.top) * 1.3,
  bottom: r.top,
});
const below = (r: Rect): Rect => ({
  left: r.left - 3,
  right: r.right + 3,
  top: r.bottom,
  bottom: r.bottom + (r.bottom - r.top) * 1.3,
});

const skipForward = (page: Page) => page.locator('mx-transport .skip-forward-btn').click();

test.describe('US3: the other Practice states without dashed outlines (feature 008)', () => {
  test('a grace note played along turns green like a correct note', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'grace-acciaccatura.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await startPracticeOnOpenScore(page);
    const grace = await page.evaluate(
      () =>
        (
          window as unknown as {
            __PRACTICE_STATE__: {
              get(): { session: { events: { accompaniment: { noteId: string; key: number }[] }[] } };
            };
          }
        ).__PRACTICE_STATE__.get().session.events[0]?.accompaniment[0],
    );
    expect(grace?.key).toBe(59); // B3, the acciaccatura before the written C4
    await pressKeys(page, '+59,wait');
    await expect.poll(() => markClasses(page).then((c) => c[grace?.noteId as string])).toBe('mx-mark-correct');
    await expect.poll(() => fillOf(page, grace?.noteId as string, 'notehead')).toBe(GREEN);
    expect(await sessionIndex(page)).toBe(0); // played along: the session still waits for the written note
  });

  test('a key held into the next event that needs it: orange head, a chevron above it, the hint - and all gone on release', async ({
    page,
  }) => {
    await spyOnDashes(page);
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'repeated-pitch-two-presses.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await startPracticeOnOpenScore(page);
    const events = await eventKeys(page);
    const second = (events[1] as KeyNotes[])[0]?.noteIds[0] as string;

    await pressKeys(page, '+60,wait'); // accepted; the key stays down and the second C4 needs it again
    await expect.poll(() => markClasses(page).then((c) => c[second])).toBe('mx-mark-heldover');
    expect(await fillOf(page, second, 'notehead')).toBe(ORANGE);
    const head = (await headRect(page, second)) as Rect;
    await expect.poll(() => inkIn(page, above(head), [230, 159, 0])).toBeGreaterThan(5); // the upward chevron
    expect(await inkIn(page, below(head), [230, 159, 0])).toBe(0); // and nothing under the head
    await expect(page.locator('mx-practice-help')).toContainText('Release the held key.');
    await screenshot(page, 'us3-heldover.png');

    await pressKeys(page, '-60,wait'); // let go: no longer held over, the mark and its hint go
    await expect.poll(() => markClasses(page).then((c) => c[second])).toBeUndefined();
    await expect.poll(() => inkIn(page, above(head), [230, 159, 0])).toBe(0);
    expect(await dashesSeen(page)).toEqual([]);
  });

  test('Skip Forward: the skipped head is grey with a right-pointing chevron below it', async ({ page }) => {
    await spyOnDashes(page);
    const { noteId } = await startedFurElise(page);
    await skipForward(page);
    await expect.poll(() => markClasses(page).then((c) => c[noteId])).toBe('mx-mark-skipped');
    expect(await fillOf(page, noteId, 'notehead')).toBe(GREY);
    const head = (await headRect(page, noteId)) as Rect;
    await expect.poll(() => inkIn(page, below(head), [153, 153, 153])).toBeGreaterThan(5);
    expect(await inkIn(page, above(head), [153, 153, 153])).toBe(0);
    await screenshot(page, 'us3-skipped.png');
    expect(await dashesSeen(page)).toEqual([]); // no dashed square any more
  });

  test('a whole Practice session with every state draws no dashed line (SC-003)', async ({ page }) => {
    await spyOnDashes(page);
    await startedFurElise(page);
    await pressKeys(page, '+74,+61,wait,-74,-61,+76,-76,wait'); // wrong keys, then the right one
    await skipForward(page);
    await pressKeys(page, '+75,-75,wait');
    expect(await dashesSeen(page)).toEqual([]);
  });

  test('Play mode: correct notes turn green during the run, no dashed ring, the Grade marks at the end as before', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await spyOnDashes(page);
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'chords/c-major-scale-and-chords.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('mx-mode-switch input[value=play]').check();
    const playBtn = page.locator('mx-transport .play-btn');
    await playBtn.click();
    // As us1-play.spec.ts: wait for the run and press the written first note (C4) inside the live marker's window
    await page.evaluate(async (key) => {
      const state = (window as unknown as { __PLAY_STATE__: { get(): { run?: { phase: string } } } }).__PLAY_STATE__;
      const deadline = performance.now() + 10_000;
      while (state.get().run?.phase !== 'running' && performance.now() < deadline) {
        await new Promise((done) => setTimeout(done, 5));
      }
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, key, 100] }));
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, key, 0] }));
    }, 60);
    await expect.poll(async () => Object.keys(await markClasses(page)).length, { timeout: 5_000 }).toBeGreaterThan(0);
    const [id] = Object.keys(await markClasses(page));
    expect(await markClasses(page)).toEqual({ [id as string]: 'mx-mark-correct' });
    expect(await fillOf(page, id as string, 'notehead')).toBe(GREEN);
    await screenshot(page, 'us3-play.png');

    // The run ends on its own and is graded: the live marks give way to the Grade's own marks
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as { __PLAY_STATE__: { get(): { grade: { complete: boolean } | null } } }
              ).__PLAY_STATE__.get().grade?.complete,
          ),
        { timeout: 25_000 },
      )
      .toBe(true);
    await expect.poll(() => markClasses(page)).toEqual({});
    expect(await dashesSeen(page)).toEqual([]);
  });

  test('greyscale: accepted, red disc, held-over and skipped stay apart by shape and position (SC-005)', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(path.join(fixturesDir, 'notation/marks-four-states.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await startPracticeOnOpenScore(page);
    const events = await eventKeys(page);
    const id = (i: number) => (events[i] as KeyNotes[])[0]?.noteIds[0] as string;
    expect(events.map((e) => e[0]?.key)).toEqual([60, 62, 64, 64, 65]);

    await pressKeys(page, '+60,-60'); // C4: accepted
    await skipForward(page); // D4: skipped
    await pressKeys(page, '+64'); // E4: accepted and held, so the next E4 arrives held over
    await expect.poll(() => markClasses(page).then((c) => c[id(3)])).toBe('mx-mark-heldover');
    await pressKeys(page, '+67,wait'); // G4 as well: a key that is not written anywhere near: a red disc
    await expect.poll(async () => (await discs(page)).length).toBe(1);

    // The picture first (in greyscale, so a failing assertion below can be looked at), then the same in numbers
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    await screenshot(page, 'greyscale.png');
    const heads = await Promise.all([0, 1, 2, 3].map(async (i) => (await headRect(page, id(i))) as Rect));
    const orangeAbove = await Promise.all(heads.map((h) => inkIn(page, above(h), [230, 159, 0])));
    const greyBelow = await Promise.all(heads.map((h) => inkIn(page, below(h), [153, 153, 153])));
    expect(orangeAbove.map((n) => n > 5)).toEqual([false, false, false, true]); // an upward chevron only on the held-over head
    expect(greyBelow.map((n) => n > 5)).toEqual([false, true, false, false]); // a right-pointing one only under the skipped head
    // the accepted heads (C4, the first E4) carry no chevron at all
    expect(orangeAbove[0]).toBe(0);
    expect(orangeAbove[2]).toBe(0);
    expect(greyBelow[0]).toBe(0);
    expect(greyBelow[2]).toBe(0);
    // the disc lies off every written head
    const [disc] = await discs(page);
    for (const h of heads) expect(overlaps(boxOf(disc as DiscInfo), h)).toBe(false);
  });
});

/** Practice on Fur Elise waiting at its first E5; returns its Note ID. */
async function startedFurElise(page: Page): Promise<{ noteId: string }> {
  await startPractice(page, FUR_ELISE);
  const events = await eventKeys(page);
  return { noteId: (events[0] as KeyNotes[])[0]?.noteIds[0] as string };
}
