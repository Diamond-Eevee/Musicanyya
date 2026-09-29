import { SMUFL_TEXT_ASCENT_PCT, SMUFL_TEXT_DESCENT_PCT } from '../../engine/config.js';

export interface PageLayout {
  page: number; // 1-based
  top: number;
  height: number;
  measured: boolean;
}

export interface PageHeight {
  height: number;
  measured: boolean;
}

/** One entry per page, in page order; page 1 starts at `startOffset` (the title block's drawn height). */
export function layoutPages(heights: readonly PageHeight[], startOffset = 0): PageLayout[] {
  const layouts: PageLayout[] = [];
  let top = startOffset;
  let page = 1;
  for (const entry of heights) {
    layouts.push({ page: page++, top, height: entry.height, measured: entry.measured });
    top += entry.height;
  }
  return layouts;
}

/** Heights for `pageCount` pages: measured ones as given, the rest estimated (score-layout.md rule 2). */
export function pageHeights(
  pageCount: number,
  measured: ReadonlyMap<number, number>, // page -> CSS px, from the rendered viewBox
  fallbackHeight: number, // the requested pageHeight in CSS px
): PageHeight[] {
  let mean = fallbackHeight;
  if (measured.size > 0) {
    let sum = 0;
    for (const h of measured.values()) {
      sum += h;
    }
    mean = sum / measured.size;
  }

  const heights: PageHeight[] = [];
  for (let page = 1; page <= pageCount; page++) {
    const m = measured.get(page);
    if (m !== undefined) {
      heights.push({ height: m, measured: true });
    } else {
      heights.push({ height: mean, measured: false });
    }
  }
  return heights;
}

/** Scroll correction when one page's height changes (score-layout.md rule 3); 0 when nothing on screen would move. */
export function scrollCompensation(before: PageLayout, newHeight: number, scrollTop: number): number {
  if (before.top + before.height <= scrollTop) {
    return newHeight - before.height;
  }
  return 0;
}

/** Pages within +-1 screen of the viewport are mounted; the rest stay unmounted placeholders. */
export function mountedPageNumbers(
  layouts: readonly PageLayout[],
  scrollTop: number,
  viewportHeight: number,
): number[] {
  const margin = viewportHeight;
  const lo = scrollTop - margin;
  const hi = scrollTop + viewportHeight + margin;
  return layouts.filter((l) => l.top + l.height > lo && l.top < hi).map((l) => l.page);
}

export function measureIndexFromElementId(measureIds: readonly string[], elementId: string | null): number | null {
  if (!elementId) return null;
  const idx = measureIds.indexOf(elementId);
  return idx === -1 ? null : idx;
}

/** The line metrics given to the music font of a page (score-layout.md 2.1.0 section 5, research R-9). */
const MUSIC_FONT_METRICS = ` ascent-override: ${SMUFL_TEXT_ASCENT_PCT}%; descent-override: ${SMUFL_TEXT_DESCENT_PCT}%; line-gap-override: 0%;`;

export interface SanitisedPage {
  svg: string;
  measureIds: string[];
  /** Height over width of the page's outer `viewBox`, or null when it has none (contracts/score-layout.md section 4). */
  aspect: number | null;
}

/**
 * Removes <script>/<foreignObject> and any on* attribute (defence against a hostile Verovio-rendered SVG), and
 * collects the ids of top-level `g.measure` elements in document order.
 */
export function sanitiseAndExtractMeasures(svg: string): SanitisedPage {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName === 'parsererror') return { svg: '', measureIds: [], aspect: null };

  for (const tag of ['script', 'foreignObject']) {
    for (const el of Array.from(root.getElementsByTagName(tag))) el.remove();
  }

  const stripEventAttributes = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    }
    for (const child of Array.from(el.children)) stripEventAttributes(child);
  };
  stripEventAttributes(root);

  // score-layout 2.1.0 section 5: the embedded music font's own line metrics make text boxes reach far beyond its ink.
  for (const style of Array.from(root.getElementsByTagName('style'))) {
    const css = style.textContent ?? '';
    if (css.includes('@font-face')) style.textContent = css.replace(/@font-face\s*\{/g, `$&${MUSIC_FONT_METRICS}`);
  }

  const measureIds = Array.from(root.querySelectorAll('g.measure'))
    .map((el) => el.id)
    .filter((id) => id.length > 0);

  return { svg: new XMLSerializer().serializeToString(root), measureIds, aspect: viewBoxAspect(root) };
}

/** Height over width of an SVG element's `viewBox`; null if it has none or it is degenerate. */
export function viewBoxAspect(svg: Element): number | null {
  const parts = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = parts?.[2];
  const height = parts?.[3];
  if (width === undefined || height === undefined || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  return width > 0 && height > 0 ? height / width : null;
}
