export interface PageLayout {
  page: number; // 1-based
  top: number;
  height: number;
}

export function layoutPages(pageCount: number, pageHeight: number, gap = 0, startOffset = 0): PageLayout[] {
  const layouts: PageLayout[] = [];
  let top = startOffset;
  for (let page = 1; page <= pageCount; page++) {
    layouts.push({ page, top, height: pageHeight });
    top += pageHeight + gap;
  }
  return layouts;
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
