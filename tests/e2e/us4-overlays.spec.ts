import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

// A Listen run needs Web Audio, which Playwright WebKit does not provide.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'a run needs AudioContext, which Playwright WebKit does not provide');
});

interface Sample {
  covered: string[];
}

/** Samples, 10 times a second inside the page, which chrome overlaps the system that holds the sounding note. */
async function startSampling(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Sample[] = [];
    (window as unknown as { __samples: Sample[] }).__samples = samples;
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const visible = (el: Element | null): el is Element => {
      if (!el || !el.checkVisibility()) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    (window as unknown as { __sampler: number }).__sampler = window.setInterval(() => {
      const note = document.querySelector('mx-score-view g.note.playing');
      // The system holding the sounding note is its staves - the measure's `g.staff` children, joined. (The `g.system` and
      // `g.measure` boxes also take in decoration such as the tempo mark, which sticks out above the page and is
      // clipped there, not covered by anything.)
      const staves = Array.from(note?.closest('g.measure')?.querySelectorAll(':scope > g.staff') ?? []);
      if (staves.length === 0) return;
      const rects = staves.map((staff) => staff.getBoundingClientRect());
      const systemRect = new DOMRect(
        Math.min(...rects.map((r) => r.left)),
        Math.min(...rects.map((r) => r.top)),
        Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
        Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
      );
      const obstacles: Array<[string, Element | null]> = [
        ['bar', document.querySelector('#mx-bar')],
        ['piano keys', document.querySelector('mx-piano-keys')],
        ...Array.from(document.querySelectorAll('mx-notice-tray .notice')).map((el): [string, Element] => [
          'notice',
          el,
        ]),
        ...Array.from(document.querySelectorAll('mx-panel')).map((el): [string, Element] => ['popup', el]),
      ];
      samples.push({
        covered: obstacles
          .filter(([, el]) => visible(el) && overlaps(systemRect, (el as Element).getBoundingClientRect()))
          .map(([name]) => name),
      });
    }, 100);
  });
}

const stopSampling = (page: Page) =>
  page.evaluate(() => {
    window.clearInterval((window as unknown as { __sampler: number }).__sampler);
    return (window as unknown as { __samples: Sample[] }).__samples;
  });

test.describe('US4: overlays never hide the music (SC-005, FR-010)', () => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    test(`at ${size.width}x${size.height}, over a full Listen run of 100 measures, the cursor's system is never covered`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(size);
      await page.goto('/');
      await page
        .locator('mx-open-button input[type=file]')
        .setInputFiles(fixture('large-score-100-measures-fast.musicxml'));
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
      await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();

      // Every chrome layer that can float over the Score is on: the piano strip (opt-in, FR-015) ...
      await openPanel(page, 'view');
      await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
      await page.keyboard.press('Escape');
      await expect(page.locator('mx-piano-keys')).toBeVisible();

      await startSampling(page);
      await page.locator('mx-transport .play-btn').click();
      await expect(page.locator('mx-run-status')).toContainText('Measure');

      // ... and, part-way through, a notice (where device and engine problems are announced). No popup can be open
      // during a run, so these are all the floating chrome there is.
      await expect(page.locator('mx-run-status')).toContainText(/Measure (2|3)\d/, { timeout: 30_000 });

      await page.evaluate(() => {
        const session = (globalThis as unknown as { mxSession: { midiInput: { emit(e: unknown): void } } }).mxSession;
        session.midiInput.emit({ type: 'deviceLost', heldKeys: [] });
      });

      // The run ends on its own; sampling stops with it.
      await expect(page.locator('mx-transport .play-btn')).toHaveText('Play', { timeout: 40_000 });
      const samples = await stopSampling(page);

      expect(samples.length, 'enough frames were sampled to mean something').toBeGreaterThan(40);
      const covered = samples.filter((sample) => sample.covered.length > 0);
      expect(
        covered.map((sample) => sample.covered),
        'frames where chrome covered the cursor system',
      ).toEqual([]);
    });
  }
});
