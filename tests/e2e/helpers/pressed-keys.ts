import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/**
 * Helpers shared by tests/e2e/pressed-keys.spec.ts (browser) and electron-pressed-keys.spec.ts (desktop shell): what the
 * Score really shows for feature 008 - computed colours, note classes, the discs on the overlay canvas and its pixels.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
export const generatedDir = path.join(__dirname, '../../.generated/008');
export const FUR_ELISE = 'repertoire/intermediate/fur-elise-theme';
export const GREEN = 'rgb(0, 158, 115)'; // --practice-correct-color, Okabe-Ito bluish-green

export async function screenshot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(generatedDir, { recursive: true });
  await page.screenshot({ path: path.join(generatedDir, name) });
}

/** Records every non-empty `setLineDash` pattern any canvas is given: a dashed outline of any kind shows up here (SC-003). */
export async function spyOnDashes(page: Page): Promise<void> {
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

export const dashesSeen = (page: Page) => page.evaluate(() => (window as unknown as { __dashes: number[][] }).__dashes);

export interface KeyNotes {
  key: number;
  noteIds: string[];
}

/** The required keys (with the Note IDs each key stands for) of every event of the running session. */
export const eventKeys = (page: Page): Promise<KeyNotes[][]> =>
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

export const sessionIndex = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (window as unknown as { __PRACTICE_STATE__: { get(): { session: { index: number } } } }).__PRACTICE_STATE__.get()
        .session.index,
  );

/** The `mx-mark-*` class of every note carrying one, by Note ID. */
export const markClasses = (page: Page): Promise<Record<string, string>> =>
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
export const fillOf = (page: Page, noteId: string, part: 'notehead' | 'stem'): Promise<string | null> =>
  page.evaluate(
    ([id, selector]) => {
      const el = document.getElementById(id as string)?.querySelector(`:scope > g.${selector}`);
      return el ? getComputedStyle(el).fill : null;
    },
    [noteId, part] as const,
  );

/** The rectangle of a note's `g.notehead`, in viewport coordinates. */
export const headRect = (page: Page, noteId: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id)?.querySelector(':scope > g.notehead');
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  }, noteId);

export const bandRect = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('.mx-practice-band');
    if (!band || band.hidden) return null;
    const r = band.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });

export const clickSize = async (page: Page, action: 'larger' | 'smaller') => {
  await page.locator(`mx-size-controls button[data-action="${action}"]`).first().click();
};

/** One red disc as the overlay reports it (the `data-discs` seam on the overlay canvas, a debugging aid like
 *  `__PRACTICE_STATE__`): viewport CSS pixels. */
export interface DiscInfo {
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

export const OVERLAY = 'canvas.mx-score-cursor';

export const discs = (page: Page): Promise<DiscInfo[]> =>
  page.evaluate(
    (selector) => JSON.parse(document.querySelector(selector)?.getAttribute('data-discs') ?? '[]'),
    OVERLAY,
  );

/** How many pixels of the disc vermilion (#d55e00) the overlay has in a rectangle of the viewport (CSS pixels). */
export const vermilionIn = (
  page: Page,
  box: { left: number; top: number; right: number; bottom: number },
): Promise<number> =>
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

export const around = (x: number, y: number, r: number) => ({ left: x - r, top: y - r, right: x + r, bottom: y + r });

/** The measured lines of the staff a note is printed on: the y of the bottom line and the space between two lines. */
export const staffGeometryOf = (page: Page, noteId: string): Promise<{ bottomY: number; space: number } | null> =>
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

export const boxOf = (d: DiscInfo) => ({
  left: d.x - d.width / 2,
  right: d.x + d.width / 2,
  top: d.y - d.height / 2,
  bottom: d.y + d.height / 2,
});
export const overlaps = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export const ORANGE = 'rgb(230, 159, 0)'; // --practice-heldover-color
export const GREY = 'rgb(153, 153, 153)'; // --practice-skipped-color

/** How many pixels of a given colour (within a tolerance) the overlay canvas has in a viewport rectangle. */
export const inkIn = (
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

export type Rect = { left: number; right: number; top: number; bottom: number };
export const above = (r: Rect): Rect => ({
  left: r.left - 3,
  right: r.right + 3,
  top: r.top - (r.bottom - r.top) * 1.3,
  bottom: r.top,
});
export const below = (r: Rect): Rect => ({
  left: r.left - 3,
  right: r.right + 3,
  top: r.bottom,
  bottom: r.bottom + (r.bottom - r.top) * 1.3,
});

export const skipForward = (page: Page) => page.locator('mx-transport .skip-forward-btn').click();
