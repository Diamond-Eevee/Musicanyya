import * as fs from 'node:fs';
import * as path from 'node:path';
import verovio from 'verovio';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { handleMessage } from '../../src/workers/verovio.worker.js';

/**
 * Feature 004, T001 - pins how Verovio 6.3.0 turns `pageWidth` / `pageHeight` / `scale` into the rendered
 * SVG, because `contracts/score-layout.md` section 2 builds the whole fit-to-window rule on that relation.
 *
 * Measured facts (with `svgViewBox: 1`, which is what the worker sets):
 *  - the OUTER `<svg viewBox>` is `pageWidth * scale / 100` by `pageHeight * scale / 100` (height only when
 *    `adjustPageHeight` is 0; with 1 it shrinks to the content);
 *  - the INNER `svg.definition-scale` viewBox is `10 * pageWidth` wide and the staff interline is always 180
 *    inner units, so the layout (measures per system) depends on `pageWidth` alone - Verovio's own `scale`
 *    only changes the outer, nominal size;
 *  - so the staff size on screen is `interline * outerWidth-in-CSS-px / innerWidth`, which is proportional to
 *    `scale` exactly when `pageWidth = viewportWidth * 100 / scale` (contract rule 1).
 */

const FIXTURES = path.join(__dirname, '../fixtures/musicxml');
const SMALL = fs.readFileSync(path.join(FIXTURES, 'eight-measure-melody.musicxml'), 'utf8');
/** 500 measures, two staves: several pages at any size, so page heights can be compared. */
const LARGE = fs.readFileSync(path.join(FIXTURES, 'large-score.musicxml'), 'utf8');

/** The option set `src/workers/verovio.worker.ts` uses, minus the three layout numbers and `adjustPageHeight`. */
const WORKER_OPTIONS = {
  breaks: 'auto',
  header: 'none',
  footer: 'none',
  font: 'Leipzig',
  svgViewBox: 1,
  svgHtml5: 0,
} as const;

/** The interline of the rendered engraving in inner (definition-scale) units - a property of the font/engraver. */
const INNER_INTERLINE = 180;
/** Inner units per outer unit at scale 100. */
const INNER_PER_OUTER = 10;

interface Layout {
  pageWidth: number;
  pageHeight: number;
  scale: number;
  adjustPageHeight: 0 | 1;
  pageMarginTop?: number;
  pageMarginBottom?: number;
}

interface PageGeometry {
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  interline: number;
}

function newToolkit(): Promise<InstanceType<typeof verovio.toolkit>> {
  return new Promise((resolve) => {
    if (verovio.module._vrvToolkit_constructor) {
      resolve(new verovio.toolkit());
    } else {
      verovio.module.onRuntimeInitialized = () => resolve(new verovio.toolkit());
    }
  });
}

function parseViewBox(tag: string | undefined): [number, number] {
  const numbers = tag?.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!numbers) throw new Error(`no viewBox in ${tag}`);
  return [Number(numbers[1]), Number(numbers[2])];
}

function geometryOf(svg: string): PageGeometry {
  const tags = [...svg.matchAll(/<svg[^>]*>/g)].map((match) => match[0]);
  const [outerWidth, outerHeight] = parseViewBox(tags[0]);
  const [innerWidth, innerHeight] = parseViewBox(tags.find((tag) => tag.includes('definition-scale')));
  const staffLineYs = [...svg.matchAll(/<path d="M\d+ (\d+) L\d+ \1"/g)].map((match) => Number(match[1]));
  const [first, second] = staffLineYs;
  if (first === undefined || second === undefined) throw new Error('no staff lines in the SVG');
  return { outerWidth, outerHeight, innerWidth, innerHeight, interline: second - first };
}

async function render(
  xml: string,
  layout: Layout,
  pages: number[],
): Promise<{ pageCount: number; pages: PageGeometry[] }> {
  const toolkit = await newToolkit();
  toolkit.setOptions({ ...WORKER_OPTIONS, ...layout });
  toolkit.loadData(xml);
  const pageCount = toolkit.getPageCount();
  return { pageCount, pages: pages.map((page) => geometryOf(toolkit.renderToSVG(page === -1 ? pageCount : page))) };
}

/** Contract rule 1, written out here so the test states the relation it pins rather than importing it. */
function fittedLayout(viewportWidth: number, viewportHeight: number, scale: number): Layout {
  return {
    pageWidth: Math.round((viewportWidth * 100) / scale),
    pageHeight: Math.round((viewportHeight * 100) / scale),
    scale,
    adjustPageHeight: 0,
  };
}

describe('Verovio page-unit relation (score-layout.md section 2)', () => {
  beforeAll(async () => {
    await newToolkit();
  });

  describe('outer size', () => {
    it.each([
      [1200, 1600, 100],
      [1200, 1600, 200],
      [1200, 1600, 50],
      [1920, 1000, 130],
      [960, 500, 200],
    ])('outer viewBox width is pageWidth * scale / 100 (%i x %i at %i)', async (pageWidth, pageHeight, scale) => {
      const { pages } = await render(SMALL, { pageWidth, pageHeight, scale, adjustPageHeight: 1 }, [1]);
      expect(pages[0]?.outerWidth).toBeCloseTo((pageWidth * scale) / 100, 6);
    });

    it('with adjustPageHeight 0 every page is exactly pageHeight * scale / 100 tall', async () => {
      for (const [pageWidth, pageHeight, scale] of [
        [1920, 1000, 100],
        [960, 500, 200],
        [3840, 2000, 50],
      ] as const) {
        const { pageCount, pages } = await render(
          LARGE,
          { pageWidth, pageHeight, scale, adjustPageHeight: 0 },
          [1, 2, -1],
        );
        expect(pageCount).toBeGreaterThan(2);
        for (const page of pages) {
          expect(page.outerHeight).toBeCloseTo((pageHeight * scale) / 100, 6);
          expect(page.outerWidth).toBeCloseTo((pageWidth * scale) / 100, 6);
        }
      }
    });

    it('with adjustPageHeight 1 the page height is derived from the content, not the requested one', async () => {
      const { pages } = await render(
        LARGE,
        { pageWidth: 1920, pageHeight: 1000, scale: 100, adjustPageHeight: 1 },
        [1],
      );
      // 015 score-layout 2.0.0: adjustPageHeight 1 crops each page to its content.
      expect(pages[0]?.outerHeight).toBeLessThan(1000);
    });
  });

  describe('layout is a function of pageWidth alone', () => {
    it('inner width is 10 * pageWidth and the interline is constant, whatever the scale', async () => {
      for (const scale of [50, 100, 150, 200]) {
        const { pages } = await render(SMALL, { pageWidth: 1200, pageHeight: 1600, scale, adjustPageHeight: 0 }, [1]);
        expect(pages[0]?.innerWidth).toBe(1200 * INNER_PER_OUTER);
        expect(pages[0]?.interline).toBe(INNER_INTERLINE);
      }
    });

    it('a different scale at the same pageWidth gives the same page count (same line breaks)', async () => {
      const counts = new Set<number>();
      for (const scale of [50, 100, 200]) {
        counts.add(
          (await render(LARGE, { pageWidth: 1600, pageHeight: 900, scale, adjustPageHeight: 0 }, [1])).pageCount,
        );
      }
      expect(counts.size).toBe(1);
    });

    it('a narrower pageWidth re-flows the music onto more pages', async () => {
      const wide = await render(LARGE, { pageWidth: 3200, pageHeight: 900, scale: 100, adjustPageHeight: 0 }, [1]);
      const narrow = await render(LARGE, { pageWidth: 800, pageHeight: 900, scale: 100, adjustPageHeight: 0 }, [1]);
      expect(narrow.pageCount).toBeGreaterThan(wide.pageCount);
    });
  });

  describe('rule 1: pageWidth = viewportWidth * 100 / scale', () => {
    it.each([
      [1280, 720],
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
    ])(
      'one Verovio page is exactly one screenful at %i x %i for every scale',
      async (viewportWidth, viewportHeight) => {
        for (const scale of [50, 100, 150, 200]) {
          const layout = fittedLayout(viewportWidth, viewportHeight, scale);
          const { pages } = await render(LARGE, layout, [1]);
          const page = pages[0];
          // The outer viewBox is in CSS pixels of the viewport, off by at most 1 px: pageWidth is rounded to an
          // integer, which is worth up to scale / 200 px (0.5 px at 100%, 1 px at 200%).
          expect(Math.abs((page?.outerWidth ?? 0) - viewportWidth)).toBeLessThanOrEqual(1);
          expect(Math.abs((page?.outerHeight ?? 0) - viewportHeight)).toBeLessThanOrEqual(1);
        }
      },
    );

    it('the interline on screen is proportional to scale (about 18 CSS px at 100)', async () => {
      const viewportWidth = 1920;
      for (const scale of [50, 100, 150, 200]) {
        const { pages } = await render(SMALL, fittedLayout(viewportWidth, 1080, scale), [1]);
        const page = pages[0];
        if (!page) throw new Error('no page rendered');
        // The page element is `viewportWidth` CSS px wide, showing `innerWidth` inner units.
        const interlinePx = (page.interline * viewportWidth) / page.innerWidth;
        expect(interlinePx).toBeCloseTo((INNER_INTERLINE * scale) / (INNER_PER_OUTER * 100), 1);
      }
    });
  });

  describe('page-unit bounds (MIN_PAGE_UNITS = 200, MAX_PAGE_UNITS = 10000)', () => {
    it.each([
      [200, 200],
      [10000, 10000],
    ])('Verovio accepts %i x %i verbatim', async (pageWidth, pageHeight) => {
      const { pages } = await render(SMALL, { pageWidth, pageHeight, scale: 100, adjustPageHeight: 0 }, [1]);
      expect(pages[0]?.outerWidth).toBe(pageWidth);
      expect(pages[0]?.outerHeight).toBe(pageHeight);
    });
  });

  describe('through the real worker path', () => {
    it('the worker honours the width relation for a fitted layout', async () => {
      const messages: Array<Record<string, unknown>> = [];
      const post = (message: Record<string, unknown>) => messages.push(message);
      await handleMessage({ data: { type: 'init', requestId: 1 } } as MessageEvent, post as typeof postMessage);
      const layout = fittedLayout(1920, 1080, 150);
      await handleMessage(
        { data: { type: 'load', requestId: 2, renderXml: SMALL, options: layout } } as MessageEvent,
        post as typeof postMessage,
      );
      await handleMessage(
        { data: { type: 'page', requestId: 3, page: 1 } } as MessageEvent,
        post as typeof postMessage,
      );
      const svg = messages.find((message) => message.type === 'svg')?.svg;
      if (typeof svg !== 'string') throw new Error(`no svg message: ${JSON.stringify(messages)}`);
      const { outerWidth } = geometryOf(svg);
      expect(Math.abs(outerWidth - 1920)).toBeLessThanOrEqual(1);
    });
  });

  interface StaffBounds {
    top: number;
    bottom: number;
  }

  /**
   * The staves of every system, in the order Verovio writes them (the first measure's staves first). A staff's
   * five lines are the `<path>`s that open its `g.staff`, before its first child group; ledger lines are
   * horizontal paths too, but they sit inside `g.ledgerLines`, so they are not counted as staff lines.
   */
  function systemStaves(svg: string): StaffBounds[][] {
    const systemSections = svg.split(/<g [^>]*class="system"/).slice(1);
    return systemSections.map((sys) => {
      const staffBlocks = sys.split(/<g [^>]*class="staff"/).slice(1);
      return staffBlocks.map((sBlock) => {
        const firstGroup = sBlock.search(/<g[\s>]/);
        const staffLines = firstGroup === -1 ? sBlock : sBlock.slice(0, firstGroup);
        const lines = [...staffLines.matchAll(/<path d="M\d+ (\d+) L\d+ \1"/g)].map((m) => Number(m[1]));
        if (lines.length !== 5) throw new Error(`expected 5 staff lines, found ${lines.length}`);
        return { top: Math.min(...lines), bottom: Math.max(...lines) };
      });
    });
  }

  /** The gap (inner units) between the first two staves of every system of every page the worker renders. */
  async function grandStaffGaps(
    send: (data: Record<string, unknown>) => Promise<Record<string, unknown>[]>,
    pageCount: number,
  ): Promise<number[]> {
    const gaps: number[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const pageMsgs = await send({ type: 'page', page: p });
      const svg = pageMsgs.find((m) => m.type === 'svg')?.svg;
      if (typeof svg !== 'string') throw new Error(`no svg message for page ${p}: ${JSON.stringify(pageMsgs)}`);
      for (const [upper, lower] of systemStaves(svg)) {
        if (upper && lower) gaps.push(lower.top - upper.bottom);
      }
    }
    return gaps;
  }

  describe('worker options (score-layout 2.0.0)', () => {
    let reqId = 100;
    const send = async (data: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
      const responses: Record<string, unknown>[] = [];
      await handleMessage(
        { data: { requestId: ++reqId, ...data } } as MessageEvent,
        ((msg: Record<string, unknown>) => responses.push(msg)) as typeof postMessage,
      );
      return responses;
    };

    beforeAll(async () => {
      await send({ type: 'init' });
    });

    it('(a) a page of eight-measure-melody.musicxml at 1920 x 1000 has a cropped viewBox height equal to content + margins', async () => {
      await send({
        type: 'load',
        renderXml: SMALL,
        options: { pageWidth: 1920, pageHeight: 1000, scale: 100 },
      });
      const pageMsgs = await send({ type: 'page', page: 1 });
      const svg = pageMsgs.find((m) => m.type === 'svg')?.svg as string;
      const geom = geometryOf(svg);
      expect(geom.outerHeight).toBeLessThan(1000);
      const contentOnly = await render(
        SMALL,
        { pageWidth: 1920, pageHeight: 1000, scale: 100, adjustPageHeight: 1, pageMarginTop: 0, pageMarginBottom: 0 },
        [1],
      );
      const contentHeight = contentOnly.pages[0]?.outerHeight ?? 0;
      const expectedHeight = contentHeight + (18 + 18);
      expect(Math.abs(geom.outerHeight - expectedHeight)).toBeLessThanOrEqual(1);
    });

    it('(b) large-score.musicxml pages have differing viewBox heights', async () => {
      await send({
        type: 'load',
        renderXml: LARGE,
        options: { pageWidth: 1600, pageHeight: 1300, scale: 100 },
      });
      const p1Msgs = await send({ type: 'page', page: 1 });
      const pLastMsgs = await send({ type: 'page', page: 11 });
      const svg1 = p1Msgs.find((m) => m.type === 'svg')?.svg as string;
      const svgLast = pLastMsgs.find((m) => m.type === 'svg')?.svg as string;
      const h1 = geometryOf(svg1).outerHeight;
      const hLast = geometryOf(svgLast).outerHeight;
      expect(h1).not.toBeCloseTo(hLast, 0);
    });

    it('(c) the page count of large-score.musicxml at 1600 x 900 is <= the count with 1.1.1 options', async () => {
      const loadMsgs = await send({
        type: 'load',
        renderXml: LARGE,
        options: { pageWidth: 1600, pageHeight: 900, scale: 100 },
      });
      const workerCount = (loadMsgs.find((m) => m.type === 'laidOut')?.pageCount as number) ?? 0;
      // 1.1.1 baseline: default margins (50), adjustPageHeight 0
      const baseline111 = await render(
        LARGE,
        { pageWidth: 1600, pageHeight: 900, scale: 100, adjustPageHeight: 0 },
        [1],
      );
      expect(workerCount).toBeLessThanOrEqual(baseline111.pageCount);
      // And with adjustPageHeight 1 and smaller margins (18 vs 50), the worker pages must be cropped
      const p1 = await send({ type: 'page', page: 1 });
      const svg = p1.find((m) => m.type === 'svg')?.svg as string;
      expect(geometryOf(svg).outerHeight).toBeLessThan(900);
    });

    it('(a) in sparse two-staff piano fixture fur-elise-bare.musicxml the smallest gap between treble bottom and bass top is 720 inner units', async () => {
      const FUR_ELISE_BARE = fs.readFileSync(path.join(FIXTURES, 'engraving/fur-elise-bare.musicxml'), 'utf8');
      const loadMsgs = await send({
        type: 'load',
        renderXml: FUR_ELISE_BARE,
        options: { pageWidth: 1920, pageHeight: 1000, scale: 100 },
      });
      const pageCount = (loadMsgs.find((m) => m.type === 'laidOut')?.pageCount as number) ?? 1;
      const gaps = await grandStaffGaps(send, pageCount);
      expect(Math.abs(Math.min(...gaps) - 720)).toBeLessThanOrEqual(1);
    });

    /**
     * T025: the Scores the compact spacing must engrave without a Verovio error. Verovio reports on the console
     * (`[Error] ...`, `[Warning] ...`); a warning counts too, because Verovio drops content it cannot place (a
     * pedal line, a hairpin) with a warning only. In each, the grand-staff gap never falls below the minimum.
     */
    it.each(['engraving/fur-elise-bare.musicxml', 'engraving/grand-staff-between-staves.musicxml'])(
      '(a) %s renders through the worker without a Verovio error or warning',
      async (fixture) => {
        const xml = fs.readFileSync(path.join(FIXTURES, fixture), 'utf8');
        const warn = vi.spyOn(console, 'warn');
        const error = vi.spyOn(console, 'error');
        try {
          const loadMsgs = await send({
            type: 'load',
            renderXml: xml,
            options: { pageWidth: 1920, pageHeight: 1000, scale: 100 },
          });
          expect(loadMsgs.map((m) => m.type)).toEqual(['laidOut']);
          const pageCount = loadMsgs[0]?.pageCount;
          if (typeof pageCount !== 'number') throw new Error(`no page count: ${JSON.stringify(loadMsgs)}`);
          const gaps = await grandStaffGaps(send, pageCount);
          expect(gaps.length).toBeGreaterThan(0);
          expect(Math.min(...gaps)).toBeGreaterThanOrEqual(720 - 1);
          const verovioLines = [...warn.mock.calls, ...error.mock.calls]
            .map((args) => args.join(' '))
            .filter((line) => /\[(Error|Warning)\]/.test(line));
          expect(verovioLines).toEqual([]);
        } finally {
          warn.mockRestore();
          error.mockRestore();
        }
      },
    );

    it('(a) grand-staff-between-staves.musicxml: its content pushes the staves further apart than the minimum', async () => {
      const xml = fs.readFileSync(path.join(FIXTURES, 'engraving/grand-staff-between-staves.musicxml'), 'utf8');
      const loadMsgs = await send({
        type: 'load',
        renderXml: xml,
        options: { pageWidth: 1920, pageHeight: 1000, scale: 100 },
      });
      const pageCount = loadMsgs[0]?.pageCount;
      if (typeof pageCount !== 'number') throw new Error(`no page count: ${JSON.stringify(loadMsgs)}`);
      // Every system carries a cross-staff beam, a hairpin or ledger lines of both hands between the staves.
      for (const gap of await grandStaffGaps(send, pageCount)) expect(gap).toBeGreaterThan(720 + INNER_INTERLINE);
    });

    it('(b) in voice-and-piano.musicxml the gap between voice and piano treble is unchanged with spacingBraceGroup while piano gap shrinks', async () => {
      const VOICE_AND_PIANO = fs.readFileSync(path.join(FIXTURES, 'voice-and-piano.musicxml'), 'utf8');
      const tk = await newToolkit();
      const baseOptions = {
        ...WORKER_OPTIONS,
        pageWidth: 1920,
        pageHeight: 1000,
        scale: 100,
        adjustPageHeight: 1,
        pageMarginTop: 18,
        pageMarginBottom: 18,
      };
      tk.setOptions(baseOptions);
      tk.loadData(VOICE_AND_PIANO);
      const svgDefault = tk.renderToSVG(1);
      const sysDefault = systemStaves(svgDefault)[0]!;

      tk.setOptions({ ...baseOptions, spacingBraceGroup: 8 });
      tk.loadData(VOICE_AND_PIANO);
      const svgCompact = tk.renderToSVG(1);
      const sysCompact = systemStaves(svgCompact)[0]!;

      const defaultVoiceToPiano = sysDefault[1]!.top - sysDefault[0]!.bottom;
      const compactVoiceToPiano = sysCompact[1]!.top - sysCompact[0]!.bottom;
      expect(compactVoiceToPiano).toBe(defaultVoiceToPiano);

      const defaultPianoGap = sysDefault[2]!.top - sysDefault[1]!.bottom;
      const compactPianoGap = sysCompact[2]!.top - sysCompact[1]!.bottom;
      expect(compactPianoGap).toBeLessThan(defaultPianoGap);
      expect(Math.abs(compactPianoGap - 720)).toBeLessThanOrEqual(1);
    });
  });
});
