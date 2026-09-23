import * as fs from 'node:fs';
import * as path from 'node:path';
import verovio from 'verovio';
import { beforeAll, describe, expect, it } from 'vitest';
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
      // This is why a dictated (screenful) page must set adjustPageHeight to 0 - contract rule 4.
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

    /** T030: the worker must ask for a dictated height (`adjustPageHeight: 0`), on both messages that lay out. */
    it.each(['load', 'relayout'] as const)(
      'a %s gives every page exactly the requested screenful height',
      async (kind) => {
        const messages: Array<Record<string, unknown>> = [];
        const post = (message: Record<string, unknown>) => messages.push(message);
        const send = (data: Record<string, unknown>) =>
          handleMessage({ data } as MessageEvent, post as typeof postMessage);
        await send({ type: 'init', requestId: 1 });
        await send({ type: 'load', requestId: 2, renderXml: LARGE, options: fittedLayout(1600, 800, 100) });
        if (kind === 'relayout') await send({ type: 'relayout', requestId: 3, options: fittedLayout(1920, 1000, 100) });
        await send({ type: 'page', requestId: 4, page: 2 });

        const svg = messages.filter((message) => message.type === 'svg').at(-1)?.svg;
        if (typeof svg !== 'string') throw new Error(`no svg message: ${JSON.stringify(messages)}`);
        const wanted = kind === 'load' ? 800 : 1000;
        expect(geometryOf(svg).outerHeight).toBeCloseTo(wanted, 0);
      },
    );
  });
});
