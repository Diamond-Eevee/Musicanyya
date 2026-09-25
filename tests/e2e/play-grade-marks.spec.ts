import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';
import { pressInTime, startPlay, waitForGrade } from './helpers/play.js';

// 009 US3 (FR-014 to FR-023): after a Play run the Grade is drawn in Practice's look - green heads for correct notes, grey heads
// with the skip icon for missed and wrong notes, red discs at the pitch played, and no ring or cross anywhere. Real run, fake
// keyboard, keys timed on the run's own clock. "Fur Elise", right hand, its first two measures (a pick-up and one bar):
//   E5 D#5 E5 D#5 E5 . B4 D5 - at 60 quarter notes a minute one beat is one second.
const ITEM = 'repertoire/beginner/fur-elise-theme-16-bar';

test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

interface Seam {
  discs: {
    key: number;
    staff: number;
    column: { measureIndex: number; onsetInMeasure: number };
    x: number;
    y: number;
  }[];
  skipIcons: unknown[];
  carets: unknown[];
  heads: unknown[];
}

const seam = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas.mx-score-cursor');
    const json = canvas?.getAttribute('data-grade-marks');
    return json ? (JSON.parse(json) as Seam) : null;
  });

/** What 003 graded, from the state seam: the Note IDs of the correct results, and of every result that was not. */
const gradedNoteIds = (page: Page) =>
  page.evaluate(() => {
    const grade = (
      window as unknown as { __PLAY_STATE__: { get(): { grade: { results: { pitch: string; noteIds: string[] }[] } } } }
    ).__PLAY_STATE__.get().grade;
    const ids = (wanted: (pitch: string) => boolean) =>
      [...new Set(grade.results.filter((r) => wanted(r.pitch)).flatMap((r) => r.noteIds))].sort();
    return { correct: ids((p) => p === 'correct'), notCorrect: ids((p) => p !== 'correct') };
  });

const classed = (page: Page, cls: string) =>
  page.evaluate((c) => [...document.querySelectorAll(`.mx-score-page g.note.${c}`)].map((n) => n.id).sort(), cls);

test('US3 end-to-end: a graded run - green and grey heads, red discs at the pitch played, no ring or cross, every disc explained', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // count every ring the page's canvas draws (the old missed mark): none may be drawn once the Grade is shown
  await page.addInitScript(() => {
    const w = window as unknown as { __arcCalls: number };
    w.__arcCalls = 0;
    const original = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (...args: Parameters<typeof original>) {
      w.__arcCalls++;
      return original.apply(this, args);
    };
  });

  await startPlay(page, ITEM, { accompaniment: false, hands: 'right', range: { from: 1, to: 2 } });
  await pressInTime(page, [
    { at: 0, key: 76 }, // E5 - correct
    { at: 500, key: 75 }, // D#5 - correct
    { at: 1000, key: 76 }, // E5 - correct
    { at: 1500, key: 63 }, // D#4 for the D#5 - a wrong octave
    // E5 at 2000 - not played: missed
    { at: 3000, key: 71 }, // B4 - correct
    { at: 3500, key: 72 }, // C5 for the D5 - any other wrong note: the D5 is missed and this key is an extra
  ]);
  await waitForGrade(page);
  await page.keyboard.press('Escape'); // the Grade popup over the Score; the marks stay on the notes
  await expect.poll(() => seam(page)).not.toBeNull();

  const graded = await gradedNoteIds(page);
  expect(graded.correct.length).toBe(4);
  expect(graded.notCorrect.length).toBe(3);

  // the green heads are exactly the correct results, the grey heads exactly the others (FR-014, FR-016)
  await expect.poll(() => classed(page, 'mx-mark-correct')).toEqual(graded.correct);
  expect(await classed(page, 'mx-mark-skipped')).toEqual(graded.notCorrect);

  // the discs are exactly the wrong key played for the octave error and the extra key (FR-015, FR-017)
  const marks = await seam(page);
  expect(marks?.discs.map((d) => d.key)).toEqual([63, 72]);
  expect(marks?.skipIcons).toHaveLength(3); // the three grey heads are in three columns
  const canvasEl = page.locator('canvas.mx-score-cursor');
  const discAttribute = JSON.parse((await canvasEl.getAttribute('data-grade-discs')) ?? '[]') as { key: number }[];
  expect(discAttribute.map((d) => d.key)).toEqual([63, 72]);

  // no ring or cross (FR-019): nothing arcs on the canvas any more, and no note has an outline class
  await page.evaluate(() => {
    (window as unknown as { __arcCalls: number }).__arcCalls = 0;
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { __arcCalls: number }).__arcCalls)).toBe(0);

  // selecting a disc explains it (FR-022): a click at the disc, sent to the score as a browser would
  const clickDisc = (index: number) =>
    page.evaluate((i) => {
      const canvas = document.querySelector('canvas.mx-score-cursor');
      const data = JSON.parse(canvas?.getAttribute('data-grade-marks') ?? '{}') as Seam;
      const stack = document.querySelector('.mx-score-stack')?.getBoundingClientRect();
      const disc = data.discs[i];
      if (!disc || !stack) throw new Error('no disc to click');
      document
        .querySelector('.mx-score-scroll')
        ?.dispatchEvent(
          new MouseEvent('click', { clientX: disc.x + stack.left, clientY: disc.y + stack.top, bubbles: true }),
        );
    }, index);
  await clickDisc(0);
  const selected = await page.evaluate(
    () =>
      (window as unknown as { __PLAY_STATE__: { get(): { selectedMark: unknown } } }).__PLAY_STATE__.get().selectedMark,
  );
  expect(selected).toEqual({ kind: 'disc', index: 0 });
  // ...and the panel says in plain words what the disc stands for: the D#4 played where the D#5 was written (an octave low)
  const reason = await page.evaluate(() => document.querySelector('mx-grade-panel .grade-reason')?.textContent ?? '');
  expect(reason).toContain('D#4 played');
  expect(reason).toContain('one octave too low');
});

test('US3 end-to-end: the marks layer switch hides the classes and the discs, and the stepper brings each mistake into view (FR-023, FR-025)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startPlay(page, ITEM, { accompaniment: false, hands: 'right', range: { from: 1, to: 2 } });
  await pressInTime(page, [
    { at: 0, key: 76 },
    { at: 500, key: 75 },
    { at: 1000, key: 76 },
    { at: 1500, key: 63 },
    { at: 3000, key: 71 },
    { at: 3500, key: 72 },
  ]);
  await waitForGrade(page);
  await expect.poll(() => seam(page)).not.toBeNull();
  const graded = await gradedNoteIds(page);

  // the stepper visits every mistake - the octave error, the missed note, the wrong note, the extra key - bringing each into view
  const scrollAway = () =>
    page.evaluate(() => {
      const scroll = document.querySelector('.mx-score-scroll') as HTMLElement;
      scroll.scrollTop = scroll.scrollHeight; // far from the passage
    });
  const inView = (noteId: string) =>
    page.evaluate((id) => {
      const el = document.getElementById(id);
      const scroll = document.querySelector('.mx-score-scroll')?.getBoundingClientRect();
      if (!el || !scroll) return false;
      const rect = el.getBoundingClientRect();
      return rect.top >= scroll.top && rect.bottom <= scroll.bottom;
    }, noteId);
  const next = page.locator('mx-grade-panel [data-id="stepper-next"]');
  await expect(page.locator('mx-grade-panel .grade-stepper')).toContainText('Mistakes (4)');
  const visited: unknown[] = [];
  for (let i = 0; i < 4; i++) {
    await scrollAway();
    await next.click();
    const mark = await page.evaluate(
      () =>
        (
          window as unknown as { __PLAY_STATE__: { get(): { selectedMark: { kind: string; noteId?: string } } } }
        ).__PLAY_STATE__.get().selectedMark,
    );
    visited.push(mark);
    if (mark.kind === 'note' && mark.noteId) await expect.poll(() => inView(mark.noteId as string)).toBe(true);
    await expect(page.locator('mx-grade-panel .grade-reason').first()).not.toHaveText('');
  }
  expect(visited.map((m) => (m as { kind: string }).kind).sort()).toEqual(['extra', 'note', 'note', 'note']);
  expect(
    new Set(
      visited.filter((m) => (m as { kind: string }).kind === 'note').map((m) => (m as { noteId: string }).noteId),
    ),
  ).toEqual(new Set(graded.notCorrect));

  // the marks layer off: no class on any head and no disc, until it is switched on again (FR-025)
  await page.keyboard.press('Escape');
  await openPanel(page, 'view');
  await page.locator('mx-view-panel input[data-layer="marks"]').uncheck();
  await expect.poll(() => classed(page, 'mx-mark-correct')).toEqual([]);
  expect(await classed(page, 'mx-mark-skipped')).toEqual([]);
  await expect.poll(() => seam(page)).toBeNull();
  await page.locator('mx-view-panel input[data-layer="marks"]').check();
  await expect.poll(() => classed(page, 'mx-mark-correct')).toEqual(graded.correct);
  await expect.poll(async () => (await seam(page))?.discs.length).toBe(2);
});
