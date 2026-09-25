import { expect, type Page, test } from '@playwright/test';
import { playPhase, startPlay, waitForGrade } from './helpers/play.js';

// 009 US1: during a Play run the Score shows Listen's cursor - the highlighted notes are what the run is at. The bar
// itself is canvas, so these tests read what the DOM shows: `.playing` on the notes due, and the run status.
const ITEM = 'repertoire/beginner/fur-elise-theme-16-bar';

test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

interface NoteAt {
  measure: number;
  onset: number;
}

/** A Note ID is `n-p<part>-s<staff>-m<measure>-v<voice>-o<onset>-k<key>` (Constitution III). */
function noteAt(id: string): NoteAt {
  const match = /-m(\d+)-v\d+-o(\d+)-k/.exec(id);
  if (!match) throw new Error(`Not a Note ID: ${id}`);
  return { measure: Number(match[1]), onset: Number(match[2]) };
}

/** Records the first highlighted note (by written position) at every animation frame for `ms`, in the page. */
async function recordHighlights(page: Page, ms: number): Promise<{ id: string; inView: boolean }[]> {
  return page.evaluate(
    (durationMs) =>
      new Promise<{ id: string; inView: boolean }[]>((done) => {
        const seen: { id: string; inView: boolean }[] = [];
        const end = performance.now() + durationMs;
        const step = () => {
          const first = document.querySelector('.mx-score-page g.note.playing');
          if (first) {
            const rect = first.getBoundingClientRect();
            const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
            if (seen[seen.length - 1]?.id !== first.id) seen.push({ id: first.id, inView });
          }
          if (performance.now() < end) requestAnimationFrame(step);
          else done(seen);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );
}

test('US1 end-to-end: nothing is highlighted in the count-in, then the cursor moves note by note in order and stays in view', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await startPlay(page, ITEM, { accompaniment: true });

  // The count-in (FR-002): the status names the first measure and no note is highlighted.
  await expect.poll(() => playPhase(page)).toBe('countIn');
  await expect(page.locator('mx-run-status')).toContainText('Measure 1');
  expect(await page.locator('.mx-score-page g.note.playing').count()).toBe(0);

  // Then the notes due are highlighted, one moment after the other, in the written order.
  const seen = await recordHighlights(page, 9_000);
  expect(seen.length).toBeGreaterThanOrEqual(4);
  const positions = seen.map((s) => noteAt(s.id));
  expect(positions[0]).toEqual({ measure: 0, onset: 0 });
  for (let i = 1; i < positions.length; i++) {
    const before = positions[i - 1] as NoteAt;
    const after = positions[i] as NoteAt;
    const forward = after.measure > before.measure || (after.measure === before.measure && after.onset > before.onset);
    expect(forward, `${JSON.stringify(before)} then ${JSON.stringify(after)}`).toBe(true);
  }
  // the view follows the cursor: every highlighted note was on screen when it was highlighted
  expect(seen.every((s) => s.inView)).toBe(true);
});

test('US1 end-to-end: at 60 % and measures 5-8 the cursor starts in measure 5 (acceptance scenario 4)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await startPlay(page, ITEM, { accompaniment: true, tempoPercent: 60, range: { from: 5, to: 8 } });

  const seen = await recordHighlights(page, 14_000);
  expect(seen.length).toBeGreaterThan(0);
  expect(noteAt((seen[0] as { id: string }).id).measure).toBe(4); // measure 5, zero-based
  // and it never leaves the passage
  expect(Math.max(...seen.map((s) => noteAt(s.id).measure))).toBeLessThanOrEqual(7);
});

test('US1 end-to-end: the cursor is gone once the Grade is shown (FR-006)', async ({ page }) => {
  test.setTimeout(90_000);
  await startPlay(page, ITEM, { accompaniment: true, range: { from: 1, to: 1 } });
  await waitForGrade(page);
  await expect.poll(() => page.locator('.mx-score-page g.note.playing').count()).toBe(0);
});

test('US1 end-to-end: a correct key at the first note gives a green head that stays green under the highlight (FR-008, R-05)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await startPlay(page, ITEM, { accompaniment: false });

  // Press E5 (76), the piece's first note, as soon as the count-in is over: wait and press in one page call, as
  // us1-play.spec.ts does, because a Playwright poll can be a whole second late.
  await page.evaluate(async (key) => {
    const state = (window as unknown as { __PLAY_STATE__: { get(): { run: { phase: string } | null } } })
      .__PLAY_STATE__;
    const deadline = performance.now() + 15_000;
    while (state.get().run?.phase !== 'running' && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, key, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, key, 0] }));
  }, 76);

  // while the first note is highlighted, its head is filled with the Practice green: one atomic read in the page, so
  // the highlight cannot move on between two reads
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const head = document.querySelector('.mx-score-page g.note.playing.mx-mark-correct > g.notehead');
          if (!head) return null;
          const probe = document.createElement('span');
          probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--practice-correct-color');
          document.body.appendChild(probe);
          const green = getComputedStyle(probe).color;
          probe.remove();
          return getComputedStyle(head).fill === green;
        }),
      { timeout: 10_000 },
    )
    .toBe(true);
});
