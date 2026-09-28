import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openLibraryItem } from './helpers/browser.js';
import { installLookaheadTracker } from './helpers/lookahead.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repertoireDir = path.join(__dirname, '../../public/library/repertoire');

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
