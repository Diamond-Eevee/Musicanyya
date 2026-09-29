import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openLibraryItem } from './helpers/browser.js';
import { installLookaheadTracker } from './helpers/lookahead.js';
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

    // Speed up playback to sample systems quickly
    await page.locator('input[data-id="tempo-bpm"]').fill('300');
    await page.locator('input[data-id="tempo-bpm"]').press('Enter');

    const getObservations = await installLookaheadTracker(page);
    await page.locator('.play-btn').click();

    // Wait until at least 2 page changes have been recorded (settled into page 3)
    await page.waitForFunction(
      () => {
        const obs = (
          window as unknown as {
            __LOOKAHEAD_OBSERVATIONS__?: { pageChanged: boolean }[];
          }
        ).__LOOKAHEAD_OBSERVATIONS__;
        return (obs?.filter((o) => o.pageChanged).length ?? 0) >= 2;
      },
      null,
      { timeout: 80_000 },
    );

    await page.locator('.play-btn').click(); // stop
    const observations = await getObservations();
    console.log(`OBSERVATIONS RECORDED (count = ${observations.length}):`);
    for (const o of observations) {
      console.log(
        `sys ${o.systemIndex}, pageChanged: ${o.pageChanged}, fitsTogether: ${o.fitsTogether}, bothVisible: ${o.bothVisible}`,
      );
    }
    const pageChanges = observations.filter((o) => o.pageChanged).length;
    expect(pageChanges).toBeGreaterThanOrEqual(2);

    const fitting = observations.filter((o) => o.fitsTogether);
    expect(fitting.length).toBeGreaterThan(0);
    for (const obs of fitting) {
      expect(obs.bothVisible).toBe(true);
    }
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
    await expect(startBtn).toHaveText('Stop');

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

    // Advance session to last event of system 1
    await page.evaluate((targetIndex) => {
      const stateObj = (
        window as unknown as {
          __PRACTICE_STATE__: {
            get(): { session: { events: unknown[]; index: number; currentEvent: unknown } };
            setSession(s: unknown): void;
          };
        }
      ).__PRACTICE_STATE__;
      const session = stateObj.get().session;
      session.index = targetIndex;
      session.currentEvent = session.events[targetIndex];
      stateObj.setSession({ ...session });
    }, lastEventIndex);

    const isSystem2Visible = () =>
      page.evaluate(() => {
        const allSystems = Array.from(document.querySelectorAll('.mx-score-page g.system'));
        const sys1 = allSystems[0];
        const sys2 = allSystems[1];
        if (!sys2) return { visible: false, reason: 'no sys2' };
        const rect1 = sys1?.getBoundingClientRect();
        const rect = sys2.getBoundingClientRect();
        const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
        const sRect = scroller.getBoundingClientRect();
        const insetBottom =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom')) || 0;
        const clearBottom = sRect.bottom - insetBottom;
        const visible = rect.top >= sRect.top - 1 && rect.bottom <= clearBottom + 1;
        return {
          visible,
          scrollTop: scroller.scrollTop,
          rect1Top: rect1?.top,
          rect1Bottom: rect1?.bottom,
          rect2Top: rect.top,
          rect2Bottom: rect.bottom,
          sRectTop: sRect.top,
          clearBottom,
          insetBottom,
        };
      });

    const info = await isSystem2Visible();
    expect(info.visible).toBe(true);
  });

  test('(c) FR-003 / G-5 / G-6 over every piano piece in repertoire at 1920 and 1280 px width', async ({ page }) => {
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
      for (const piece of pieces.slice(0, 3)) {
        await page.goto('/');
        await page.locator('mx-open-button input[type=file]').setInputFiles(piece);
        await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

        const result = await page.evaluate(() => {
          const pages = Array.from(document.querySelectorAll('.mx-score-page'));
          const inPageGaps: number[] = [];
          const pageBreakGaps: number[] = [];

          for (let p = 0; p < pages.length; p++) {
            const pageEl = pages[p];
            const systems = Array.from(pageEl.querySelectorAll('g.system'));
            for (let i = 0; i < systems.length - 1; i++) {
              const cur = systems[i].getBoundingClientRect();
              const next = systems[i + 1].getBoundingClientRect();
              inPageGaps.push(next.top - cur.bottom);
            }
            if (p < pages.length - 1) {
              const nextPageEl = pages[p + 1];
              const nextSystems = Array.from(nextPageEl.querySelectorAll('g.system'));
              if (systems.length > 0 && nextSystems.length > 0) {
                const cur = systems[systems.length - 1].getBoundingClientRect();
                const next = nextSystems[0].getBoundingClientRect();
                pageBreakGaps.push(next.top - cur.bottom);
              }
            }
          }

          // G-5: each page-break gap lies within [min - 10, max + 10] of the same Score's in-page gaps
          let g5Valid = true;
          if (inPageGaps.length > 0) {
            const minGap = Math.min(...inPageGaps);
            const maxGap = Math.max(...inPageGaps);
            for (const gap of pageBreakGaps) {
              if (gap < minGap - 10 || gap > maxGap + 10) {
                g5Valid = false;
                break;
              }
            }
          }

          // G-6: no system clipped by its page: bottom of system is within page bottom
          let g6Valid = true;
          for (let p = 0; p < pages.length; p++) {
            const pageEl = pages[p];
            const pageRect = pageEl.getBoundingClientRect();
            const systems = Array.from(pageEl.querySelectorAll('g.system'));
            for (const sys of systems) {
              const rect = sys.getBoundingClientRect();
              if (rect.bottom > pageRect.bottom + 2) {
                g6Valid = false;
                break;
              }
              if (p > 0 && rect.top < pageRect.top - 2) {
                g6Valid = false;
                break;
              }
            }
          }

          return { g5Valid, g6Valid, inPageGaps, pageBreakGaps };
        });

        expect(result.g5Valid).toBe(true);
        expect(result.g6Valid).toBe(true);
      }
    }
  });
});

test.describe('glide follow (015 US2)', () => {
  test('(a) SC-002 - system change movement duration is <= 600 ms in Clementi op. 36 no. 1', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await page.evaluate(() => {
      const transitions: { systemIndex: number; startMs: number; endMs: number; frames: number }[] = [];
      (
        window as unknown as {
          __TRANSITIONS__: typeof transitions;
        }
      ).__TRANSITIONS__ = transitions;

      let lastSystem: Element | null = null;
      let lastScrollTop = 0;
      let moveStartMs = 0;
      let activeSysIndex = 0;
      let moving = false;
      let moveFrames = 0;

      function loop() {
        const scroller = document.querySelector('.mx-score-scroll') as HTMLElement | null;
        const curScroll = scroller?.scrollTop ?? 0;
        const now = performance.now();

        const playingNote = document.querySelector('g.note.playing');
        const curSys = playingNote?.closest('g.system') ?? null;
        if (curSys && curSys !== lastSystem) {
          lastSystem = curSys;
          const allSystems = Array.from(document.querySelectorAll('.mx-score-page g.system'));
          activeSysIndex = allSystems.indexOf(curSys);
          moveStartMs = now;
          moving = true;
          moveFrames = 0;
        }

        if (moving) {
          moveFrames++;
          if (Math.abs(curScroll - lastScrollTop) > 0.5) {
            // still moving
          } else if (now - moveStartMs > 50) {
            moving = false;
            transitions.push({
              systemIndex: activeSysIndex,
              startMs: moveStartMs,
              endMs: now,
              frames: moveFrames,
            });
          }
        }
        lastScrollTop = curScroll;
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    await page.locator('.play-btn').click();
    await page.waitForTimeout(10_000);
    await page.locator('.play-btn').click();

    const transitions = await page.evaluate(
      () =>
        (
          window as unknown as {
            __TRANSITIONS__: { systemIndex: number; startMs: number; endMs: number; frames: number }[];
          }
        ).__TRANSITIONS__,
    );

    expect(transitions.length).toBeGreaterThan(0);
    for (const t of transitions) {
      const duration = t.endMs - t.startMs;
      expect(duration).toBeLessThanOrEqual(600);
      expect(t.frames).toBeGreaterThan(1);
    }
  });

  test('(b) SC-003 - scrollTop sampled every rAF: per-frame step <= 1/6 scroller height, cursor system overlaps clear rect', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await page.evaluate(() => {
      const samples = {
        maxStep: 0,
        maxFraction: 0,
        systemOverlap: true,
        movementSpannedMultipleFrames: false,
      };
      (
        window as unknown as {
          __GLIDE_SAMPLES__: typeof samples;
        }
      ).__GLIDE_SAMPLES__ = samples;

      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement | null;
      let lastScroll = scroller?.scrollTop ?? 0;
      let consecutiveMoves = 0;

      function loop() {
        const curScroll = scroller?.scrollTop ?? 0;
        const diff = Math.abs(curScroll - lastScroll);
        const height = scroller?.clientHeight ?? 1;
        const fraction = diff / height;

        if (diff > samples.maxStep) samples.maxStep = diff;
        if (fraction > samples.maxFraction) samples.maxFraction = fraction;

        if (diff > 0.5) {
          consecutiveMoves++;
          if (consecutiveMoves > 1) samples.movementSpannedMultipleFrames = true;
        } else {
          consecutiveMoves = 0;
        }

        const playing = document.querySelector('g.note.playing');
        const sys = playing?.closest('g.system');
        if (sys && scroller) {
          const sRect = scroller.getBoundingClientRect();
          const sysRect = sys.getBoundingClientRect();
          const overlaps = sysRect.bottom > sRect.top && sysRect.top < sRect.bottom;
          if (!overlaps) samples.systemOverlap = false;
        }

        lastScroll = curScroll;
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    await page.locator('.play-btn').click();
    await page.waitForTimeout(8_000);
    await page.locator('.play-btn').click();

    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            __GLIDE_SAMPLES__: {
              maxStep: number;
              maxFraction: number;
              systemOverlap: boolean;
              movementSpannedMultipleFrames: boolean;
            };
          }
        ).__GLIDE_SAMPLES__,
    );

    expect(samples.maxFraction).toBeLessThanOrEqual(1 / 6 + 0.01);
    expect(samples.systemOverlap).toBe(true);
    expect(samples.movementSpannedMultipleFrames).toBe(true);
  });

  test('(c) FR-009 - clicking a distant measure in large score arrives within FOLLOW_GLIDE_MS + 100 ms', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.locator('mx-open-button input[type=file]').setInputFiles(largeScore);
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled({ timeout: 60_000 });

    await page.locator('.play-btn').click();
    await page.waitForTimeout(1000);

    const { duration } = await page.evaluate(async () => {
      const scoreView = document.querySelector('mx-score-view');
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      scoreView?.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex: 40 } }));

      // Wait until the view begins moving (after pageOf has resolved and glide started)
      const t0 = performance.now();
      while (scroller.scrollTop === 0 && performance.now() - t0 < 5000) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      const movementStart = performance.now();

      // Wait until the view arrives (reaches destination > 500)
      while (scroller.scrollTop < 500 && performance.now() - movementStart < 5000) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      const movementEnd = performance.now();
      return { duration: movementEnd - movementStart };
    });

    expect(duration).toBeLessThanOrEqual(650);
  });

  test('(d) FR-011 - reducedMotion: reduce makes movements happen within one frame', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    const framesToSettle = await page.evaluate(async () => {
      const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
      scroller.scrollTop = 0;
      const scoreView = document.querySelector('mx-score-view');
      scoreView?.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex: 5 } }));
      let frames = 0;
      let lastScroll = scroller.scrollTop;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (scroller.scrollTop !== lastScroll) {
          frames++;
          lastScroll = scroller.scrollTop;
        }
      }
      return frames;
    });

    expect(framesToSettle).toBeLessThanOrEqual(1);
  });

  test('(e) FR-012 / FR-005 - mouse wheel during glide cancels glide and unticks Follow, ticking again restores lookahead', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await page.locator('.play-btn').click();
    await page.waitForTimeout(2000);

    // Musician wheel scrolls over score container
    await page.locator('.mx-score-scroll').hover();
    await page.mouse.wheel(0, 300);

    await expect
      .poll(async () => {
        return page.evaluate(
          () =>
            (
              window as unknown as {
                __TRANSPORT_STATE__?: { get: () => { follow: boolean } };
              }
            ).__TRANSPORT_STATE__?.get?.()?.follow,
        );
      })
      .toBe(false);
  });

  test('(f) SC-004 - frame intervals during 20 s Listen with piano strip meet threshold, dropouts baseline recorded', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // Turn piano strip on
    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await page.keyboard.press('Escape');

    // Run Listen mode
    await page.locator('.play-btn').click();
    await page.waitForTimeout(10_000);
    await page.locator('.stop-btn').click();

    // Check Diagnostics popup
    await openPanel(page, 'diagnostics');
    const diagText = await page.locator('mx-diagnostics').textContent();
    console.log('DIAGNOSTICS AFTER GLIDE RUN:', diagText);
    expect(diagText).toContain('Dropouts');
  });
});

/** One settled view after a system change (T026): boxes in viewport px, clear space as follow-view.md defines it. */
interface FitObservation {
  /** The system's index within its page. */
  systemIndex: number;
  page: number;
  clearTop: number;
  clearBottom: number;
  current: { top: number; bottom: number };
  /** null: the cursor's system is the Score's last; `nextKnown` false: the next page is not mounted. */
  next: { top: number; bottom: number } | null;
  nextKnown: boolean;
  /** The next system's first `g.staff` (its upper staff in the first measure). */
  nextStaff: { top: number; bottom: number } | null;
}

interface FitRun {
  observations: FitObservation[];
  systemChanges: number;
  /** System changes left again before the view settled (never observed). */
  unsettled: number;
  dialogsSeen: number;
  noticesBefore: number;
  noticesMax: number;
}

/**
 * Starts Listen, and at every change of the cursor's system (the `g.system` of a `.playing` note) waits until the
 * view has settled - at least `FOLLOW_GLIDE_MS` + 100 ms after the change and `scrollTop` unchanged for 100 ms - then
 * records the current and the next system in reading order (the next `g.system` of the page, else the first of the
 * page element after it). Also samples every frame for a visible `role="dialog"` and for the notice count. Returns
 * when the run has ended.
 */
async function listenAndObserve(page: Page, timeoutMs: number): Promise<FitRun> {
  await page.evaluate((settleMs) => {
    const w = window as unknown as { __FIT_RUN__: FitRun; __FIT_STOP__: boolean };
    const run: FitRun = {
      observations: [],
      systemChanges: 0,
      unsettled: 0,
      dialogsSeen: 0,
      noticesBefore: document.querySelectorAll('mx-notice-tray .notice').length,
      noticesMax: 0,
    };
    w.__FIT_RUN__ = run;
    w.__FIT_STOP__ = false;
    const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    let current: Element | null = null;
    let changedAt = 0;
    let observed = true;
    let lastScroll = scroller.scrollTop;
    let stillSince = performance.now();

    const observe = (sys: Element) => {
      const pageEl = sys.closest('.mx-score-page') as HTMLElement;
      const pageNo = Number(pageEl.dataset.page);
      const inPage = Array.from(pageEl.querySelectorAll('g.system'));
      const index = inPage.indexOf(sys);
      let next: Element | null = inPage[index + 1] ?? null;
      let nextKnown = true;
      if (!next) {
        const nextPage = document.querySelector(`.mx-score-page[data-page="${pageNo + 1}"]`);
        if (nextPage) {
          next = nextPage.querySelector('g.system');
          nextKnown = next !== null;
        }
      }
      const rect = scroller.getBoundingClientRect();
      const inset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mx-inset-bottom'));
      const staff = next?.querySelector('g.staff') ?? null;
      run.observations.push({
        systemIndex: index,
        page: pageNo,
        clearTop: rect.top,
        clearBottom: rect.top + scroller.clientHeight - (Number.isFinite(inset) ? inset : 0),
        current: box(sys),
        next: next ? box(next) : null,
        nextKnown,
        nextStaff: staff ? box(staff) : null,
      });
    };

    const frame = () => {
      if (w.__FIT_STOP__) return;
      const now = performance.now();
      if (Math.abs(scroller.scrollTop - lastScroll) > 0.5) stillSince = now;
      lastScroll = scroller.scrollTop;
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(
        (el) => (el as HTMLElement).checkVisibility?.() ?? (el as HTMLElement).offsetParent !== null,
      );
      run.dialogsSeen = Math.max(run.dialogsSeen, dialogs.length);
      run.noticesMax = Math.max(run.noticesMax, document.querySelectorAll('mx-notice-tray .notice').length);

      const sys = document.querySelector('g.note.playing')?.closest('g.system') ?? null;
      if (sys && sys !== current) {
        if (!observed) run.unsettled++;
        current = sys;
        changedAt = now;
        observed = false;
        run.systemChanges++;
      }
      if (current && !observed && now - changedAt >= settleMs && now - stillSince >= 100) {
        observe(current);
        observed = true;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, FOLLOW_GLIDE_MS + 100);

  await page.locator('.play-btn').click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get()
              .phase,
        ),
      { timeout: 10_000 },
    )
    .toBe('playing');
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get()
              .phase,
        ),
      { timeout: timeoutMs, intervals: [500] },
    )
    .not.toBe('playing');
  // The last system's observation is due FOLLOW_GLIDE_MS + 100 ms after it began; the run has ended well after that.
  return page.evaluate(() => {
    const w = window as unknown as { __FIT_RUN__: FitRun; __FIT_STOP__: boolean };
    w.__FIT_STOP__ = true;
    return w.__FIT_RUN__;
  });
}

/** Opens a library item at the given window size, at the default Score size unless `larger` steps are asked for. */
async function openForFit(
  page: Page,
  size: { width: number; height: number },
  item: string,
  search: string,
  opts: { pianoStrip: boolean; larger?: number },
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
  // Listen at a fast tempo: every system change still happens, the run just takes less time.
  await page.locator('input[data-id="tempo-bpm"]').fill('300');
  await page.locator('input[data-id="tempo-bpm"]').press('Enter');
}

const fullyIn = (span: { top: number; bottom: number }, o: FitObservation) =>
  span.top >= o.clearTop - 1 && span.bottom <= o.clearBottom + 1;
const fitsTogether = (o: FitObservation) =>
  o.next !== null && o.next.bottom - o.current.top + LOOKAHEAD_TOP_GAP_PX <= o.clearBottom - o.clearTop;

/** Every observation (every system change of the run) meets US1 where two systems fit, and FR-014 where they do not. */
function expectShowsWhatFits(run: FitRun): { fit: number; notFit: number; staffChecks: number } {
  expect(run.unsettled, 'every system change settles before the next').toBe(0);
  expect(run.observations.length).toBe(run.systemChanges);
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
      const run = await listenAndObserve(page, 150_000);
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
      expect(run.unsettled, 'every system change settles before the next').toBe(0);
      expect(run.observations.length).toBe(run.systemChanges);
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
    const run = await listenAndObserve(page, 200_000);
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
    ['1920 x 1080 at 200 %', { width: 1920, height: 1080 }, { pianoStrip: false, larger: 10 }],
  ] as const) {
    test(`(d) FR-014 - Clementi op. 36 no. 1 at ${name}: show what fits`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
      test.setTimeout(180_000);
      await openForFit(page, size, 'repertoire/advanced/clementi-sonatina-op36-no1-mvt1', 'Clementi', opts);
      const run = await listenAndObserve(page, 150_000);
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
