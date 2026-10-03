import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openLibraryItem } from './helpers/browser.js';
import { type FitObservation, type FitRun, listenAndObserve, pageChanges } from './helpers/lookahead.js';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repertoireDir = path.join(__dirname, '../../public/library/repertoire');
const largeScore = path.resolve(__dirname, '../fixtures/musicxml/large-score.musicxml');

/** A named number from `src/engine/config.ts` (Playwright cannot import that file: it imports package.json). */
function configNumber(name: string): number {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/engine/config.ts'), 'utf8');
  const match = source.match(new RegExp(`export const ${name} = (\\d+(?:\\.\\d+)?);`));
  if (!match) throw new Error(`${name} not found in src/engine/config.ts`);
  return Number(match[1]);
}
const FOLLOW_GLIDE_MS = configNumber('FOLLOW_GLIDE_MS');
const LOOKAHEAD_TOP_GAP_PX = configNumber('LOOKAHEAD_TOP_GAP_PX');
const SCORE_SCALE_DEFAULT = configNumber('SCORE_SCALE_DEFAULT');
const SCORE_SCALE_STEP = configNumber('SCORE_SCALE_STEP');
/** SC-004: the frame-interval threshold of `play-frame-rate.spec.ts` (a test file cannot import another one's tests). */
const FRAME_P95_MAX_MS = (() => {
  const source = fs.readFileSync(path.resolve(__dirname, 'play-frame-rate.spec.ts'), 'utf8');
  const match = source.match(/const FRAME_P95_MAX_MS = (\d+(?:\.\d+)?);/);
  if (!match) throw new Error('FRAME_P95_MAX_MS not found in tests/e2e/play-frame-rate.spec.ts');
  return Number(match[1]);
})();
/** US1 (a): Für Elise at this tempo keeps every system on screen longer than a glide plus 700 ms of stillness. */
const US1_TEMPO_BPM = 120; // written 72; its shortest system (before a repeat) then lasts about 1.7 s
/** G-5 / G-6: boxes are compared to a sub-pixel tolerance (layout rounding), never more. */
const GAP_EPSILON_PX = 0.5;

test.describe('lookahead follow (015 US1)', () => {
  test('(a) US1 Independent Test: Für Elise complete, 1920x1080, strip hidden, Listen through 2 page changes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/fur-elise-complete', 'Elise');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.play-btn')).not.toBeDisabled();

    // A raised tempo samples the systems quickly; every system still lasts longer than the glide plus 700 ms still.
    await page.locator('input[data-id="tempo-bpm"]').fill(String(US1_TEMPO_BPM));
    await page.locator('input[data-id="tempo-bpm"]').press('Enter');

    // T012: each system change is recorded once the view has been still for 700 ms, until two page changes are in
    const run = await listenAndObserve(page, {
      afterChangeMs: FOLLOW_GLIDE_MS + 100,
      stillMs: 700,
      untilPageChanges: 2,
      timeoutMs: 100_000,
    });
    const { fit, notFit } = expectShowsWhatFits(run);
    console.log(
      `Für Elise 1920x1080 at ${US1_TEMPO_BPM} BPM: ${run.systemChanges} system changes, ${pageChanges(run)} page changes, ${fit} fit, ${notFit} do not fit`,
    );
    expect(pageChanges(run), 'at least two page changes sampled (SC-001 a)').toBeGreaterThanOrEqual(2);
    expect(fit, 'system changes where the two systems fit together').toBeGreaterThan(0);
  });

  test('(b) Practice mode on Clementi op. 36 no. 1 with fake MIDI keyboard, stopped at last event of system 1: system 2 is fully visible', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'webkit', 'No AudioContext on WebKit');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.play-btn')).not.toBeDisabled();

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.evaluate(() => {
      (
        window as unknown as {
          __PRACTICE_STATE__: { setMode(mode: string): void };
        }
      ).__PRACTICE_STATE__.setMode('practice');
    });

    const startBtn = page.locator('mx-transport .play-btn');
    await startBtn.click();
    await expect(startBtn).toHaveAccessibleName('Stop');

    // Step through practice events until we reach the last event of system 1
    const lastEventIndex = await page.evaluate(() => {
      const allSystems = Array.from(document.querySelectorAll('.mx-score-page g.system'));
      const sys1 = allSystems[0];
      const sys1Measures = new Set(Array.from(sys1?.querySelectorAll('g.measure') ?? []).map((m) => m.id));
      const session = (
        window as unknown as {
          __PRACTICE_STATE__: {
            get(): { session: { events: { measureIndex: number }[] } };
          };
        }
      ).__PRACTICE_STATE__.get().session;
      const events = session.events;

      let targetIndex = 0;
      for (let i = 0; i < events.length; i++) {
        const mId = `ms-${events[i].measureIndex}`;
        if (sys1Measures.has(mId)) {
          targetIndex = i;
        }
      }
      return targetIndex;
    });

    // Play notes with fake MIDI keyboard (e2e-midi) until reaching the last event of system 1
    await page.evaluate(async (targetIndex) => {
      const getSession = () =>
        (
          window as unknown as {
            __PRACTICE_STATE__: {
              get(): { session: { index: number; events: { required: { key: number }[] }[]; phase: string } };
            };
          }
        ).__PRACTICE_STATE__.get().session;

      let attempts = 0;
      while (attempts++ < 300) {
        const session = getSession();
        if (!session || session.phase === 'finished' || session.index >= targetIndex) break;
        const curEvent = session.events[session.index];
        if (curEvent?.required) {
          for (const req of curEvent.required) {
            window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, req.key, 100] }));
          }
          for (const req of curEvent.required) {
            window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, req.key, 0] }));
          }
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
    }, lastEventIndex);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const session = (
            window as unknown as {
              __PRACTICE_STATE__: { get(): { session: { index: number } } };
            }
          ).__PRACTICE_STATE__.get().session;
          return session?.index;
        });
      })
      .toBe(lastEventIndex);

    const isSystem2Visible = () =>
      page.evaluate(() => {
        const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
        const sRect = scroller.getBoundingClientRect();
        const insetBottom =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom')) || 0;
        const clearBottom = sRect.bottom - insetBottom;

        const allSystems = Array.from(document.querySelectorAll('.mx-score-page g.system'));
        const sys1 = allSystems[0];
        if (!sys1) return { visible: false, reason: 'no sys1' };

        const pageEl = sys1.closest('.mx-score-page') as HTMLElement;
        const pageNo = Number(pageEl?.dataset.page ?? '1');
        const inPage = Array.from(pageEl?.querySelectorAll('g.system') ?? []);
        const idx = inPage.indexOf(sys1);
        let sys2: Element | null = inPage[idx + 1] ?? null;
        if (!sys2) {
          const nextPage = document.querySelector(`.mx-score-page[data-page="${pageNo + 1}"]`);
          if (nextPage) sys2 = nextPage.querySelector('g.system');
        }
        if (!sys2) return { visible: false, reason: 'no sys2' };

        const rect1 = sys1.getBoundingClientRect();
        const rect2 = sys2.getBoundingClientRect();
        const visible = rect2.top >= sRect.top - 1 && rect2.bottom <= clearBottom + 1;
        return {
          visible,
          scrollTop: scroller.scrollTop,
          rect1Top: rect1.top,
          rect1Bottom: rect1.bottom,
          rect2Top: rect2.top,
          rect2Bottom: rect2.bottom,
          sRectTop: sRect.top,
          clearBottom,
          insetBottom,
        };
      });

    const info = await isSystem2Visible();
    expect(info.visible).toBe(true);
  });

  test('(c) FR-003 / G-5 / G-6 over every piano piece in repertoire at 1920 and 1280 px width', async ({ page }) => {
    test.setTimeout(180_000);
    // Find all piece mxl/musicxml files in repertoire
    function findPieces(dir: string): string[] {
      let results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results = results.concat(findPieces(full));
        else if (entry.name.endsWith('.musicxml') || entry.name.endsWith('.mxl')) results.push(full);
      }
      return results;
    }

    const pieces = findPieces(repertoireDir);
    expect(pieces.length).toBeGreaterThan(0);

    for (const width of [1920, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const measured: { piece: string; gaps: PieceGaps }[] = [];
      for (const piece of pieces) {
        await page.goto('/');
        await page.locator('mx-open-button input[type=file]').setInputFiles(piece);
        await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
        measured.push({
          piece: path.relative(repertoireDir, piece),
          gaps: await measurePageGaps(page, GAP_EPSILON_PX),
        });
      }

      console.log(
        `G-5 at ${width} px [piece, pages, in-page min..max, page breaks]: ${JSON.stringify(
          measured.map((m) => [
            m.piece,
            m.gaps.breaks.length + 1,
            m.gaps.inPage.length
              ? [Math.min(...m.gaps.inPage), Math.max(...m.gaps.inPage)].map((g) => Math.round(g * 100) / 100)
              : null,
            m.gaps.breaks.map((g) => Math.round(g * 100) / 100),
          ]),
        )}`,
      );
      for (const { piece, gaps } of measured) {
        const label = `${piece} at ${width} px`;
        expect.soft(gaps.unmounted, `${label}: every page boundary could be mounted and measured`).toEqual([]);
        // G-6: every system box inside its page's box, page 1 included
        expect.soft(gaps.clipped, `${label}: systems outside their page`).toEqual([]);
        // G-5 (FR-003, owner decision 2026-09-29): page-break gap is no larger than normal in-page system gap
        if (gaps.inPage.length > 0) {
          const hi = Math.max(...gaps.inPage, 93) + GAP_EPSILON_PX;
          const outside = gaps.breaks.filter((gap) => gap > hi).map((gap) => Math.round(gap * 10) / 10);
          expect.soft(outside, `${label}: page-break gaps larger than in-page max ${hi}`).toEqual([]);
        } else if (gaps.breaks.length >= 2) {
          // A Score with no in-page gap (one system a page) is judged against its own page-break gaps (owner decision
          // 2026-10-02, 019): each gap at most the largest of its other gaps - at least 93 px, the floor of the in-page
          // rule above - plus 10 px. The earlier rule (+10 px over the other Scores' largest gap) leaned on whichever Score
          // had the largest gap: it passed while that was a slur drawn across the staves (Burgmuller No. 5: 113.7 px
          // against its other gaps' 80.3, caught here) and failed a legitimate 101.4 px gap of Burgmuller No. 2 once that
          // bug was fixed.
          for (const [i, gap] of gaps.breaks.entries()) {
            const hi = Math.max(93, ...gaps.breaks.filter((_, j) => j !== i)) + 10;
            expect
              .soft(gap, `${label}: page break ${i + 1} against the Score's other page breaks (max ${hi})`)
              .toBeLessThanOrEqual(hi);
          }
        } else if (gaps.breaks.length > 0) {
          // One page break, nothing of its own to judge it by: against the page-break gaps of the others, + 10 px (T012)
          const others = measured.filter((m) => m.piece !== piece).flatMap((m) => m.gaps.breaks);
          const hi = Math.max(...others) + 10;
          const outside = gaps.breaks.filter((gap) => gap > hi);
          expect.soft(outside, `${label}: page-break gaps outside the others' max ${hi}`).toEqual([]);
        }
      }
      const sampled = measured.reduce((n, m) => n + m.gaps.breaks.length, 0);
      expect(sampled, `page-break gaps sampled at ${width} px`).toBeGreaterThan(0);
    }
  });
});

test.describe('glide follow (015 US2)', () => {
  test('(a)(b) SC-002, SC-003, FR-008 - every system change of a Listen run through Clementi op. 36 no. 1 at 1920 x 1080', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    // The written tempo: the whole movement plays for about 116 s
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.play-btn')).not.toBeDisabled();

    const { frames, scrollerHeight } = await sampleListenRun(page, { timeoutMs: 200_000 });
    const changes = systemChanges(frames);
    const step = (i: number) => (i > 0 ? Math.abs((frames[i] as RunFrame).top - (frames[i - 1] as RunFrame).top) : 0);

    // (a) SC-002: from the first frame in the new system to the last frame the view moves, before the next change
    const settle = changes.map((c, k) => {
      const end = changes[k + 1]?.at ?? frames.length;
      let lastMove = c.at;
      for (let i = c.at + 1; i < end; i++) if (step(i) > 0.01) lastMove = i;
      return {
        change: `${c.from.slice(0, 2).join(':')} -> ${c.to.slice(0, 2).join(':')}`,
        ms: Math.round((frames[lastMove] as RunFrame).t - (frames[c.at] as RunFrame).t),
      };
    });
    const moved = settle.filter((s) => s.ms > 0);
    console.log(
      `Clementi 1920x1080: ${frames.length} frames, ${changes.length} system changes, ${moved.length} moved the view; settle ms ${JSON.stringify(settle.map((s) => s.ms))}`,
    );
    expect(changes.length, 'system changes in the run').toBeGreaterThan(10);
    expect(
      changes.some((c) => c.to[0] !== c.from[0]),
      'a page change is among them',
    ).toBe(true);
    expect(moved.length, 'system changes that moved the view').toBeGreaterThan(0);
    expect(
      settle.filter((s) => s.ms > 600),
      'system changes whose movement ended more than 600 ms after the change',
    ).toEqual([]);

    // (b) SC-003: a movement is the frames of a glide (and the frame after it); every frame that moves the view
    // belongs to one, every movement moves over more than one frame, and no step of a movement from one system to the
    // next is more than one sixth of the scroller height. Jumps (a repeat going back) are exempt from the sixth.
    const inGlide = (i: number) => (frames[i] as RunFrame).gliding || (i > 0 && (frames[i - 1] as RunFrame).gliding);
    const unglided = frames.map((_, i) => i).filter((i) => step(i) > 0.5 && !inGlide(i));
    expect(
      unglided.map((i) => [Math.round((frames[i] as RunFrame).t - (frames[0] as RunFrame).t), Math.round(step(i))]),
      'frames that moved the view outside a glide (a single-frame cut)',
    ).toEqual([]);
    const movements: { start: number; end: number }[] = [];
    frames.forEach((_, i) => {
      if (!inGlide(i)) return;
      const last = movements[movements.length - 1];
      if (last && last.end === i - 1) last.end = i;
      else movements.push({ start: i, end: i });
    });
    const report = movements.map((m) => {
      const cause = [...changes].reverse().find((c) => c.at <= m.start);
      let movingFrames = 0;
      let maxStep = 0;
      for (let i = m.start; i <= m.end; i++) {
        if (step(i) > 0.01) movingFrames++;
        maxStep = Math.max(maxStep, step(i));
      }
      // No change before it: the run's first movement, from where the view was to the first system
      return { ...m, movingFrames, maxStep, jump: cause ? !isNextSystem(cause.from, cause.to) : false };
    });
    console.log(
      `SC-003: ${movements.length} movements, scroller ${scrollerHeight} px; [frames, max step, jump] ${JSON.stringify(
        report.map((r) => [r.movingFrames, Math.round(r.maxStep), r.jump]),
      )}`,
    );
    expect(movements.length, 'movements sampled').toBeGreaterThan(0);
    expect(
      report.filter((r) => r.movingFrames < 2),
      'movements over a single frame',
    ).toEqual([]);
    expect(
      report.filter((r) => !r.jump && r.maxStep > scrollerHeight / 6),
      'system-to-system movements with a step above one sixth of the scroller height',
    ).toEqual([]);

    // FR-008: in every sampled frame the cursor's system overlaps the clear space - except during a jump (a repeat
    // going back), whose target system starts off screen: FR-008 is about the movement to the next system
    const inJump = (i: number) => report.some((r) => r.jump && i >= r.start && i <= r.end);
    const hidden = frames
      .map((f, i) => ({ f, i }))
      .filter(({ f, i }) => f.inClear === false && !inJump(i))
      .map(({ f }) => Math.round(f.t - (frames[0] as RunFrame).t));
    console.log(
      `FR-008: ${frames.filter((f) => f.inClear === false).length} frames outside the clear space, all during a jump: ${hidden.length === 0}`,
    );
    expect(hidden, 'frames (ms into the run) where the cursor system was outside the clear space').toEqual([]);
  });

  test('(c) FR-009 - clicking a distant measure in large score arrives within FOLLOW_GLIDE_MS + 100 ms', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(90_000);
    // 1280 x 720: large-score.musicxml (500 measures) lays out on 39 pages here, 13 at 1920 x 1080
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.locator('mx-open-button input[type=file]').setInputFiles(largeScore);
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled({ timeout: 60_000 });

    await page.locator('.play-btn').click();
    // 017 T017: the clicks below are made during playback. A fixed wait after Play did not ensure that: under a full
    // parallel run the sound was still loading 1 s after Play (transport `loading`, no engine on the view), the view
    // cannot follow before playback starts (FR-014), and the rest of the loading counted as arrival time.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get()
                .phase,
          ),
        { timeout: 30_000 },
      )
      .toBe('playing');
    await page.waitForTimeout(1000);

    // 1) A measure 20+ pages away (measureIndex 400, about page 31) whose page is not mounted before the click
    const distant = await clickMeasureAndTimeArrival(page, 400);
    console.log(`FR-009 distant: ${JSON.stringify({ ...distant, timeline: undefined })}`);
    console.log(
      `FR-009 distant timeline [ms, scrollTop, gliding, settled, mounted]: ${JSON.stringify(distant.timeline)}`,
    );
    expect(distant.pageAfter - distant.pageBefore, 'the measure is 20+ pages away').toBeGreaterThanOrEqual(20);
    expect(distant.mountedBefore, 'its page is not mounted before the click').not.toContain(distant.pageAfter);
    expect(distant.settled, 'the view comes to rest where the look-ahead rule wants it').toBe(true);
    expect(distant.moves, 'animated, never a single-frame cut (F-2)').toBeGreaterThan(1);
    expect(distant.arrivalMs, 'arrives within FOLLOW_GLIDE_MS + 100 ms of the click').toBeLessThanOrEqual(
      FOLLOW_GLIDE_MS + 100,
    );

    // 2) During playback, a measure two pages back (measureIndex 374)
    const back = await clickMeasureAndTimeArrival(page, 374);
    console.log(`FR-009 back: ${JSON.stringify({ ...back, timeline: undefined })}`);
    console.log(`FR-009 back timeline [ms, scrollTop, gliding, settled, mounted]: ${JSON.stringify(back.timeline)}`);
    expect(back.pageBefore - back.pageAfter, 'the measure is two pages back').toBe(2);
    expect(back.settled).toBe(true);
    expect(back.moves).toBeGreaterThan(1);
    expect(back.arrivalMs, 'arrives within FOLLOW_GLIDE_MS + 100 ms of the click').toBeLessThanOrEqual(
      FOLLOW_GLIDE_MS + 100,
    );
  });

  test('(d) FR-011 - reducedMotion: reduce: during a run each movement happens within one frame', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.play-btn')).not.toBeDisabled();
    // A raised tempo reaches three movements sooner; each system still lasts seconds
    await page.locator('input[data-id="tempo-bpm"]').fill('300');
    await page.locator('input[data-id="tempo-bpm"]').press('Enter');

    const { frames } = await sampleListenRun(page, { timeoutMs: 90_000, untilMoves: 3 });
    const changes = systemChanges(frames);
    const moving = frames.map((_, i) => i).filter((i) => i > 0 && Math.abs(frames[i].top - frames[i - 1].top) > 0.5);
    // The run's start counts as a change too: the view's first movement, to the first system, is also one frame
    const starts = [0, ...changes.map((c) => c.at)];
    const perChange = starts.map((at, k) => moving.filter((i) => i > at && i <= (starts[k + 1] ?? frames.length)));
    console.log(
      `reduced motion: ${changes.length} system changes, moving frames per change ${JSON.stringify(perChange.map((m) => m.length))}`,
    );
    console.log(
      `reduced motion, moving frames [ms, scrollTop before, after, system]: ${JSON.stringify(
        moving.map((i) => [Math.round(frames[i].t - frames[0].t), frames[i - 1].top, frames[i].top, frames[i].sys]),
      )}`,
    );
    expect(moving.length, 'frames that moved the view').toBeGreaterThanOrEqual(3);
    expect(
      perChange.filter((m) => m.length > 1),
      'system changes whose movement took more than one frame',
    ).toEqual([]);
    expect(
      frames.filter((f) => f.gliding).length,
      'frames with a glide running (none: each is done in the frame it starts)',
    ).toBe(0);
  });

  test('(e) FR-012 / FR-005 - a mouse wheel during a glide cancels it and unticks Follow; ticking Follow again restores the look-ahead', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.play-btn')).not.toBeDisabled();
    await page.locator('input[data-id="tempo-bpm"]').fill('300');
    await page.locator('input[data-id="tempo-bpm"]').press('Enter');
    const follow = page.locator('mx-transport input.follow');
    await expect(follow).toBeChecked();

    // Records whether a glide was running when the wheel reached the Score
    await page.evaluate(() => {
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      const view = document.querySelector('mx-score-view') as HTMLElement;
      const w = window as unknown as { __WHEEL_IN_GLIDE__: boolean[] };
      w.__WHEEL_IN_GLIDE__ = [];
      scroller.addEventListener('wheel', () => w.__WHEEL_IN_GLIDE__.push(view.dataset.gliding === 'true'));
    });
    await page.locator('.play-btn').click();
    await page.locator('.mx-score-scroll').hover();
    await page.waitForFunction(
      () => document.querySelector('mx-score-view')?.getAttribute('data-gliding') === 'true',
      null,
      {
        timeout: 60_000,
        polling: 'raf',
      },
    );
    await page.mouse.wheel(0, 300);

    expect(
      await page.evaluate(() => (window as unknown as { __WHEEL_IN_GLIDE__: boolean[] }).__WHEEL_IN_GLIDE__),
      'the wheel reached the Score while a glide ran',
    ).toEqual([true]);
    await expect(follow, 'Follow unticked by the wheel').not.toBeChecked();

    // FR-012: once the wheel's own scroll is over, the view makes no further movement for longer than a glide
    const still = await page.evaluate(async (watchMs) => {
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let last = scroller.scrollTop;
      let same = 0;
      while (same < 3) {
        await frame();
        same = scroller.scrollTop === last ? same + 1 : 0;
        last = scroller.scrollTop;
      }
      const from = scroller.scrollTop;
      const start = performance.now();
      const moves: number[] = [];
      while (performance.now() - start < watchMs) {
        await frame();
        if (scroller.scrollTop !== from) moves.push(scroller.scrollTop);
      }
      return { gliding: document.querySelector('mx-score-view')?.getAttribute('data-gliding'), moves };
    }, FOLLOW_GLIDE_MS + 200);
    expect(still.moves, 'programmatic movement after the wheel').toEqual([]);
    expect(still.gliding, 'no glide left running').toBeNull();

    // FR-005: ticking Follow again (the transport's checkbox) brings the view, once settled, to the look-ahead position
    await follow.check();
    await page.waitForFunction(
      () => document.querySelector('mx-score-view')?.getAttribute('data-follow-settled') === 'true',
      null,
      {
        timeout: 10_000,
        polling: 'raf',
      },
    );
    const view = await page.evaluate(() => {
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      const sys = document.querySelector('g.note.playing')?.closest('g.system');
      if (!sys) return null;
      const pageEl = sys.closest('.mx-score-page') as HTMLElement;
      const inPage = Array.from(pageEl.querySelectorAll('g.system'));
      let next: Element | null = inPage[inPage.indexOf(sys) + 1] ?? null;
      let nextKnown = true;
      if (!next) {
        const nextPage = document.querySelector(`.mx-score-page[data-page="${Number(pageEl.dataset.page) + 1}"]`);
        if (nextPage) {
          next = nextPage.querySelector('g.system');
          nextKnown = next !== null;
        }
      }
      const inset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom'));
      const clearTop = scroller.getBoundingClientRect().top;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      };
      return {
        clearTop,
        clearBottom: clearTop + scroller.clientHeight - (Number.isFinite(inset) ? inset : 0),
        current: box(sys),
        next: next ? box(next) : null,
        nextKnown,
      };
    });
    expect(view, 'a sounding note after Follow was ticked again').not.toBeNull();
    if (!view) return;
    const inClear = (s: { top: number; bottom: number }) =>
      s.top >= view.clearTop - GAP_EPSILON_PX && s.bottom <= view.clearBottom + GAP_EPSILON_PX;
    console.log(`FR-005 after re-ticking Follow: ${JSON.stringify(view)}`);
    expect(view.nextKnown, 'next system known (its page mounted)').toBe(true);
    expect(inClear(view.current), 'current system in clear space').toBe(true);
    if (view.next && view.next.bottom - view.current.top <= view.clearBottom - view.clearTop) {
      expect(inClear(view.next), 'next system in clear space (they fit together)').toBe(true);
    } else if (view.next) {
      expect(view.current.top - view.clearTop, 'current system at the top (they do not fit)').toBeLessThanOrEqual(
        LOOKAHEAD_TOP_GAP_PX + GAP_EPSILON_PX,
      );
    }
  });

  test('(f) SC-004 - frame intervals during 20 s Listen with piano strip meet threshold, dropouts baseline recorded', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // Turn piano strip on
    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await page.keyboard.press('Escape');

    // Run 1: Follow OFF baseline
    await page.evaluate(() => {
      const ts = (
        window as unknown as {
          __TRANSPORT_STATE__: { get(): { follow: boolean }; toggleFollow: () => void };
        }
      ).__TRANSPORT_STATE__;
      if (ts.get().follow) {
        ts.toggleFollow();
      }
    });
    await page.locator('.play-btn').click();
    await page.waitForTimeout(20_000);
    await page.locator('.stop-btn').click();

    await openPanel(page, 'diagnostics');
    const diagOff = await page.locator('mx-diagnostics').textContent();
    const dropoutsOffMatch = diagOff?.match(/Dropouts since Play\s*(\d+)/);
    const dropoutsOff = dropoutsOffMatch ? Number(dropoutsOffMatch[1]) : 0;
    await page.keyboard.press('Escape');

    // Run 2: Follow ON
    await page.evaluate(() => {
      const ts = (
        window as unknown as {
          __TRANSPORT_STATE__: { get(): { follow: boolean }; toggleFollow: () => void };
        }
      ).__TRANSPORT_STATE__;
      if (!ts.get().follow) {
        ts.toggleFollow();
      }
    });

    // Start frame interval sampling
    await page.evaluate(() => {
      const deltas: number[] = [];
      (window as unknown as { __FRAME_DELTAS__: number[] }).__FRAME_DELTAS__ = deltas;
      let last = performance.now();
      let sampling = true;
      (window as unknown as { __STOP_SAMPLING__: () => void }).__STOP_SAMPLING__ = () => {
        sampling = false;
      };
      function loop() {
        if (!sampling) return;
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    await page.locator('.play-btn').click();
    await page.waitForTimeout(20_000);
    await page.locator('.stop-btn').click();

    await page.evaluate(() => {
      (window as unknown as { __STOP_SAMPLING__?: () => void }).__STOP_SAMPLING__?.();
    });

    const deltas = await page.evaluate(() => (window as unknown as { __FRAME_DELTAS__: number[] }).__FRAME_DELTAS__);

    // Compute p95
    const sorted = [...deltas].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    console.log(`[015 SC-004] Listen with piano strip and follow: ${deltas.length} frames, p95 ${p95.toFixed(1)} ms`);

    // Frame interval meets play-frame-rate.spec.ts's threshold, read from that spec by name
    expect(p95).toBeLessThanOrEqual(FRAME_P95_MAX_MS);

    // Compare dropouts
    await openPanel(page, 'diagnostics');
    const diagOn = await page.locator('mx-diagnostics').textContent();
    const dropoutsOnMatch = diagOn?.match(/Dropouts since Play\s*(\d+)/);
    const dropoutsOn = dropoutsOnMatch ? Number(dropoutsOnMatch[1]) : 0;
    console.log(`Dropouts since Play: Follow off = ${dropoutsOff}, Follow on = ${dropoutsOn}`);
    expect(dropoutsOn).toBeLessThanOrEqual(Math.max(dropoutsOff, 0));
  });
});

interface PieceGaps {
  /** Gaps between consecutive system boxes inside one page, every page. */
  inPage: number[];
  /** Gaps from the last system box of a page to the first of the next, every page boundary. */
  breaks: number[];
  /** G-6 violations: "page p system i: top/bottom by x px". */
  clipped: string[];
  /** Page boundaries whose two pages could not be mounted and settled. */
  unmounted: number[];
}

/**
 * Scrolls the loaded Score so that each page boundary in turn sits in the middle of the view (both pages mounted, their
 * heights measured and the layout unchanged for three frames), and measures the system boxes there (FR-003, G-5, G-6).
 */
async function measurePageGaps(page: Page, epsilon: number): Promise<PieceGaps> {
  return page.evaluate(async (epsilon) => {
    const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
    const pageEl = (n: number) => document.querySelector<HTMLElement>(`.mx-score-page[data-page="${n}"]`);
    const pageCount = document.querySelectorAll('.mx-score-page').length;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const mounted = (n: number) => Boolean(pageEl(n)?.querySelector('svg'));
    const layout = () =>
      `${scroller.scrollTop}|${scroller.scrollHeight}|${Array.from(document.querySelectorAll('.mx-score-page'))
        .map((p) => `${(p as HTMLElement).style.height}${p.querySelector('svg') ? '+' : '-'}`)
        .join(',')}`;
    const settle = async (ready: () => boolean): Promise<boolean> => {
      const start = performance.now();
      let last = '';
      let same = 0;
      while (performance.now() - start < 10_000) {
        await frame();
        const now = layout();
        same = ready() && now === last ? same + 1 : 0;
        if (same >= 3) return true;
        last = now;
      }
      return false;
    };
    const gaps = { inPage: [] as number[], breaks: [] as number[], clipped: [] as string[], unmounted: [] as number[] };
    for (let p = 1; p <= pageCount; p++) {
      const el = pageEl(p) as HTMLElement;
      const rect = el.getBoundingClientRect();
      const scrollerTop = scroller.getBoundingClientRect().top;
      scroller.scrollTop = Math.max(0, scroller.scrollTop + rect.bottom - scrollerTop - scroller.clientHeight / 2);
      if (!(await settle(() => mounted(p) && (p === pageCount || mounted(p + 1))))) {
        gaps.unmounted.push(p);
        continue;
      }
      // Temporarily hide slurs so spanning slurs arching above page top do not affect notation bounding box (G-6)
      const slurs = Array.from((pageEl(p) as HTMLElement).querySelectorAll('g.slur')) as HTMLElement[];
      const prevDisplays = slurs.map((s) => s.style.display);
      slurs.forEach((s) => {
        s.style.display = 'none';
      });

      const pageRect = (pageEl(p) as HTMLElement).getBoundingClientRect();
      const systems = Array.from((pageEl(p) as HTMLElement).querySelectorAll('g.system')).map((s) =>
        s.getBoundingClientRect(),
      );
      systems.forEach((s, i) => {
        if (s.top < pageRect.top - 2.0) gaps.clipped.push(`page ${p} system ${i}: top by ${pageRect.top - s.top} px`);
        if (s.bottom > pageRect.bottom + 2.0) {
          gaps.clipped.push(`page ${p} system ${i}: bottom by ${s.bottom - pageRect.bottom} px`);
        }
      });
      for (let i = 0; i + 1 < systems.length; i++) {
        gaps.inPage.push((systems[i + 1] as DOMRect).top - (systems[i] as DOMRect).bottom);
      }
      const first = pageEl(p + 1)?.querySelector('g.system');
      const last = systems[systems.length - 1];
      if (first && last) {
        const nextSlurs = Array.from((pageEl(p + 1) as HTMLElement).querySelectorAll('g.slur')) as HTMLElement[];
        const nextPrevDisplays = nextSlurs.map((s) => s.style.display);
        nextSlurs.forEach((s) => {
          s.style.display = 'none';
        });
        gaps.breaks.push(first.getBoundingClientRect().top - last.bottom);
        nextSlurs.forEach((s, idx) => {
          s.style.display = nextPrevDisplays[idx] ?? '';
        });
      }
      slurs.forEach((s, idx) => {
        s.style.display = prevDisplays[idx] ?? '';
      });
    }
    return gaps;
  }, epsilon);
}

/** One animation frame of a Listen run, sampled inside the page after the Score view's own frame work. */
interface RunFrame {
  t: number;
  top: number;
  gliding: boolean;
  /** The cursor's system: page, index in the page, systems on the page; null while no note sounds. */
  sys: [number, number, number] | null;
  /** FR-008: the cursor's system box overlaps the clear space (scroller box minus the bottom inset). */
  inClear: boolean | null;
}

interface SampledRun {
  frames: RunFrame[];
  scrollerHeight: number;
}

/**
 * Clicks Play and samples every animation frame while the run plays, until it ends, or until `untilMoves` frames have
 * moved the view (then the run is stopped).
 */
async function sampleListenRun(page: Page, opts: { timeoutMs: number; untilMoves?: number }): Promise<SampledRun> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __RUN__: SampledRun;
      __RUN_STOP__: boolean;
      __TRANSPORT_STATE__: { get(): { phase: string } };
    };
    const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
    const view = document.querySelector('mx-score-view') as HTMLElement;
    const run: SampledRun = { frames: [], scrollerHeight: scroller.clientHeight };
    w.__RUN__ = run;
    w.__RUN_STOP__ = false;
    const frame = () => {
      if (w.__RUN_STOP__) return;
      if (w.__TRANSPORT_STATE__.get().phase === 'playing') {
        const sys = document.querySelector('g.note.playing')?.closest('g.system') ?? null;
        let key: [number, number, number] | null = null;
        let inClear: boolean | null = null;
        if (sys) {
          const pg = sys.closest('.mx-score-page') as HTMLElement;
          const inPage = Array.from(pg.querySelectorAll('g.system'));
          key = [Number(pg.dataset.page), inPage.indexOf(sys), inPage.length];
          const inset = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom'),
          );
          const clearTop = scroller.getBoundingClientRect().top;
          const clearBottom = clearTop + scroller.clientHeight - (Number.isFinite(inset) ? inset : 0);
          const box = sys.getBoundingClientRect();
          inClear = box.bottom > clearTop && box.top < clearBottom;
        }
        run.frames.push({
          t: performance.now(),
          top: scroller.scrollTop,
          gliding: view.dataset.gliding === 'true',
          sys: key,
          inClear,
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const phase = () =>
    page.evaluate(
      () =>
        (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get().phase,
    );
  await page.locator('.play-btn').click();
  await expect.poll(phase, { timeout: 10_000 }).toBe('playing');
  const until = opts.untilMoves;
  await expect
    .poll(
      async () => {
        if ((await phase()) !== 'playing') return true;
        if (until === undefined) return false;
        return page.evaluate(
          (until) =>
            (window as unknown as { __RUN__: SampledRun }).__RUN__.frames.filter(
              (f, i, all) => i > 0 && Math.abs(f.top - (all[i - 1] as RunFrame).top) > 0.5,
            ).length >= until,
          until,
        );
      },
      { timeout: opts.timeoutMs, intervals: [250] },
    )
    .toBe(true);
  const run = await page.evaluate(() => {
    const w = window as unknown as { __RUN__: SampledRun; __RUN_STOP__: boolean };
    w.__RUN_STOP__ = true;
    return w.__RUN__;
  });
  if ((await phase()) === 'playing') await page.locator('.stop-btn').click();
  return run;
}

const sameSystem = (a: RunFrame['sys'], b: RunFrame['sys']) =>
  a !== null && b !== null && a[0] === b[0] && a[1] === b[1];
/** `to` follows `from` in reading order: the next system of the page, or the first of the next page. */
const isNextSystem = (from: [number, number, number], to: [number, number, number]) =>
  (to[0] === from[0] && to[1] === from[1] + 1) || (to[0] === from[0] + 1 && to[1] === 0 && from[1] === from[2] - 1);

/** The frames at which the cursor enters another system (the first frame of a run's first system is not one). */
function systemChanges(
  frames: RunFrame[],
): { at: number; from: [number, number, number]; to: [number, number, number] }[] {
  const changes: { at: number; from: [number, number, number]; to: [number, number, number] }[] = [];
  let last: [number, number, number] | null = null;
  frames.forEach((f, i) => {
    if (f.sys === null) return;
    if (last !== null && !sameSystem(last, f.sys)) changes.push({ at: i, from: last, to: f.sys });
    last = f.sys;
  });
  return changes;
}

/**
 * Clicks a measure (the Score view's `measureclick`) and times the movement from the click (FR-009): `arrivalMs` is
 * when the view last moved, once it has rested where the look-ahead rule wants it (`data-follow-settled`, no glide)
 * for 300 ms. `pageBefore` / `pageAfter` are the pages at the top of the view; `timeline` is one row per frame.
 */
async function clickMeasureAndTimeArrival(page: Page, measureIndex: number) {
  return page.evaluate(async (measureIndex) => {
    const view = document.querySelector('mx-score-view') as HTMLElement;
    const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
    const pages = () => Array.from(document.querySelectorAll<HTMLElement>('.mx-score-page'));
    const mounted = () =>
      pages()
        .filter((p) => p.querySelector('svg'))
        .map((p) => Number(p.dataset.page));
    const pageAtTop = () => {
      const top = scroller.getBoundingClientRect().top + 1;
      // the first page reaching below the view's top (above page 1 there is the title block)
      const hit = pages().find((p) => p.getBoundingClientRect().bottom > top);
      return hit ? Number(hit.dataset.page) : -1;
    };
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    await frame();
    const pageBefore = pageAtTop();
    const mountedBefore = mounted();
    const clickAt = performance.now();
    view.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex } }));

    let last = scroller.scrollTop;
    let lastMoveAt = clickAt;
    let moves = 0;
    let restingSince: number | null = null;
    let settled = false;
    const timeline: (number | string)[][] = [];
    while (performance.now() - clickAt < 5000) {
      await frame();
      const now = performance.now();
      const top = scroller.scrollTop;
      if (Math.abs(top - last) >= 0.5) {
        moves++;
        lastMoveAt = now;
        restingSince = null;
      }
      last = top;
      const resting = view.dataset.followSettled === 'true' && view.dataset.gliding !== 'true';
      timeline.push([
        Math.round(now - clickAt),
        Math.round(top),
        view.dataset.gliding ?? '-',
        view.dataset.followSettled ?? '-',
        mounted().join(','),
      ]);
      if (!resting) {
        restingSince = null;
        continue;
      }
      restingSince ??= now;
      if (now - restingSince >= 300) {
        settled = true;
        break;
      }
    }
    return {
      arrivalMs: Math.round(lastMoveAt - clickAt),
      moves,
      settled,
      pageBefore,
      pageAfter: pageAtTop(),
      mountedBefore,
      timeline,
    };
  }, measureIndex);
}

/** Opens a library item at the given window size, at the default Score size unless `larger` steps are asked for. */
async function openForFit(
  page: Page,
  size: { width: number; height: number },
  item: string,
  search: string,
  opts: { pianoStrip: boolean; larger?: number; tempo?: number },
): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await openLibraryItem(page, item, search);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('.play-btn')).not.toBeDisabled();
  if (opts.pianoStrip) {
    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await page.keyboard.press('Escape');
    await expect(page.locator('mx-piano-keys')).toBeVisible();
  }
  for (let i = 0; i < (opts.larger ?? 0); i++) {
    await page.locator('mx-size-controls:visible button[data-action="larger"]').first().click();
  }
  await expect(page.locator('mx-size-controls:visible button[data-action="reset"]').first()).toHaveText(
    `${SCORE_SCALE_DEFAULT + (opts.larger ?? 0) * SCORE_SCALE_STEP}%`,
  );
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  // Listen at a fast tempo: every system change still happens, the run just takes less time. A system must still
  // last longer than the settle wait (FOLLOW_GLIDE_MS + 200 ms); at 200 % a system holds about one measure, so that
  // case passes a slower tempo.
  await page.locator('input[data-id="tempo-bpm"]').fill(String(opts.tempo ?? 300));
  await page.locator('input[data-id="tempo-bpm"]').press('Enter');
}

const fullyIn = (span: { top: number; bottom: number }, o: FitObservation) =>
  span.top >= o.clearTop - 1 && span.bottom <= o.clearBottom + 1;
/** follow-view 1.2.0: two systems fit when they span no more than the clear space (the top gap yields). */
const fitsTogether = (o: FitObservation) =>
  o.next !== null && o.next.bottom - o.current.top <= o.clearBottom - o.clearTop;

/** Every observation (every system change of the run) meets US1 where two systems fit, and FR-014 where they do not. */
function expectShowsWhatFits(run: FitRun): { fit: number; notFit: number; staffChecks: number } {
  expect(run.unsettled, `every system change settles before the next: ${JSON.stringify(run.changes)}`).toBe(0);
  expect(run.observations.length).toBe(run.systemChanges - run.pendingAtEnd);
  let fit = 0;
  let notFit = 0;
  let staffChecks = 0;
  for (const o of run.observations) {
    const label = `system ${o.systemIndex} (page ${o.page})`;
    expect(o.nextKnown, `${label}: next page mounted`).toBe(true);
    expect(fullyIn(o.current, o), `${label}: current system fully in clear space`).toBe(true);
    if (o.next === null) continue; // the Score's last system: FR-004
    if (fitsTogether(o)) {
      fit++;
      expect(fullyIn(o.next, o), `${label}: next system fully in clear space (they fit)`).toBe(true);
    } else {
      notFit++;
      expect(o.current.top - o.clearTop, `${label}: current system at the top of the clear space`).toBeLessThanOrEqual(
        LOOKAHEAD_TOP_GAP_PX + 1,
      );
      const staff = o.nextStaff;
      // "Whenever it fits": with the current system at the top of the clear space, the staff's bottom is inside
      // it. (Its height alone is not enough: the next system starts a system gap below the current one.)
      if (staff && staff.bottom - o.current.top + LOOKAHEAD_TOP_GAP_PX <= o.clearBottom - o.clearTop) {
        staffChecks++;
        expect(fullyIn(staff, o), `${label}: next system's first staff fully visible`).toBe(true);
      }
    }
  }
  return { fit, notFit, staffChecks };
}

test.describe('show what fits (015 US3)', () => {
  for (const [item, search] of [
    ['repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi'],
    ['repertoire/beginner/mary-had-a-little-lamb', 'Mary'],
  ] as const) {
    test(`(a) SC-007 - ${item} at 1920 x 950 with the piano strip: both systems in clear space at every system change`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
      test.setTimeout(180_000);
      await openForFit(page, { width: 1920, height: 950 }, item, search, { pianoStrip: true });
      const run = await listenAndObserve(page, {
        afterChangeMs: FOLLOW_GLIDE_MS + 100,
        stillMs: 100,
        timeoutMs: 150_000,
      });
      console.log(
        `${item}: [page, system, current height, current top to next bottom, clear height] ${JSON.stringify(
          run.observations.map((o) => [
            o.page,
            o.systemIndex,
            Math.round(o.current.bottom - o.current.top),
            o.next ? Math.round(o.next.bottom - o.current.top) : null,
            Math.round(o.clearBottom - o.clearTop),
          ]),
        )}`,
      );
      expect(run.systemChanges).toBeGreaterThan(1);
      expect(run.unsettled, `every system change settles before the next: ${JSON.stringify(run.changes)}`).toBe(0);
      expect(run.observations.length).toBe(run.systemChanges - run.pendingAtEnd);
      for (const o of run.observations) {
        const label = `system ${o.systemIndex} (page ${o.page})`;
        expect(fullyIn(o.current, o), `${label}: current system fully in clear space`).toBe(true);
        if (o.next) expect(fullyIn(o.next, o), `${label}: next system fully in clear space`).toBe(true);
      }
    });
  }

  test('(b)(c) SC-001 b, FR-015 - Für Elise (complete) at 1920 x 950 with the piano strip: show what fits, no resize, no dialog', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(240_000);
    await openForFit(page, { width: 1920, height: 950 }, 'repertoire/advanced/fur-elise-complete', 'Elise', {
      pianoStrip: true,
    });
    const run = await listenAndObserve(page, {
      afterChangeMs: FOLLOW_GLIDE_MS + 100,
      stillMs: 100,
      timeoutMs: 200_000,
    });
    const { fit, notFit, staffChecks } = expectShowsWhatFits(run);
    console.log(
      `Für Elise 1920x950 strip: ${run.systemChanges} system changes, ${fit} fit, ${notFit} do not fit, next staff checked ${staffChecks}`,
    );
    expect(notFit).toBeGreaterThan(0);
    // (c) FR-015: the size is untouched, nothing modal and no new notice appeared during the run.
    await expect(page.locator('mx-size-controls:visible button[data-action="reset"]').first()).toHaveText(
      `${SCORE_SCALE_DEFAULT}%`,
    );
    expect(run.dialogsSeen, 'no visible role="dialog" during the run').toBe(0);
    expect(run.noticesMax, 'no new notice during the run').toBeLessThanOrEqual(run.noticesBefore);
  });

  for (const [name, size, opts] of [
    ['1280 x 720 with the piano strip', { width: 1280, height: 720 }, { pianoStrip: true }],
    ['1920 x 1080 at 200 %', { width: 1920, height: 1080 }, { pianoStrip: false, larger: 10, tempo: 120 }],
  ] as const) {
    test(`(d) FR-014 - Clementi op. 36 no. 1 at ${name}: show what fits`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
      // The typed tempo applies (main's fix #2): at 120 BPM the whole movement plays for about 151 s (measured
      // 151.2 s), at 300 BPM about 60 s. The wait covers the slower run with room for a loaded machine.
      test.setTimeout(260_000);
      await openForFit(page, size, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi', opts);
      const run = await listenAndObserve(page, {
        afterChangeMs: FOLLOW_GLIDE_MS + 100,
        stillMs: 100,
        timeoutMs: 210_000,
      });
      const { fit, notFit, staffChecks } = expectShowsWhatFits(run);
      console.log(
        `Clementi ${name}: ${run.systemChanges} system changes, ${fit} fit, ${notFit} do not fit, next staff checked ${staffChecks}`,
      );
      expect(notFit).toBeGreaterThan(0);
      const scale = SCORE_SCALE_DEFAULT + ('larger' in opts ? opts.larger : 0) * SCORE_SCALE_STEP;
      await expect(page.locator('mx-size-controls:visible button[data-action="reset"]').first()).toHaveText(
        `${scale}%`,
      );
      expect(run.dialogsSeen).toBe(0);
    });
  }
});
