# Contract: Score layout (cropped pages, compact spacing)

**Version**: `2.0.0` - supersedes [`004/contracts/score-layout.md` `1.1.1`](../../004-score-first-layout/contracts/score-layout.md).
**MAJOR** because rule 4 of section 2 is reversed (a page is no longer one screenful) and section 4 changes from one
shared page height to one height per page. Sections 1 (Score size), 2 rules 1-3 and 5, and 3 (when a relayout
happens) are unchanged and still read from the 004 file. The Verovio worker's messages
(`001/contracts/worker-messages.md`) keep their shapes; only the option set the worker applies changes.

**Owner**: `src/workers/verovio.worker.ts`, `src/ui/score/pages.ts`, `src/ui/elements/mx-score-view.ts`,
`src/engine/config.ts`

---

## 1. Verovio options (changed rows only)

Applied by the worker on `load` and on `relayout`, identically:

| Option | 1.1.1 | 2.0.0 | Named constant (`src/engine/config.ts`) |
|---|---|---|---|
| `adjustPageHeight` | `0` | `1` - each page is cropped to its content | - (a mode, not a tolerance) |
| `pageMarginTop` | Verovio default (50) | `18` | `ENGRAVING_PAGE_MARGIN_TOP` |
| `pageMarginBottom` | Verovio default (50) | `18` | `ENGRAVING_PAGE_MARGIN_BOTTOM` |
| `spacingBraceGroup` | Verovio default (12) | `8` - minimum 4 staff spaces between the staves of one braced instrument | `ENGRAVING_SPACING_BRACE_GROUP` |

Unchanged: `breaks: 'auto'`, `header`/`footer: 'none'`, `font: 'Leipzig'`, `svgViewBox: 1`, `svgHtml5: 0`,
`pageWidth`/`pageHeight`/`scale` from `fitLayout()` (004 section 2 rules 1-3), `spacingStaff` and `spacingSystem`
(Verovio defaults). `pageHeight` keeps deciding how many systems go into one page; a page is now only the unit of
lazy mounting, not something the musician sees.

## 2. Pinned relations (verified by `tests/verovio/page-units.test.ts`, verovio 6.3.0)

| Quantity | Value |
|---|---|
| outer `<svg viewBox>` width | `pageWidth * scale / 100` (unchanged) |
| outer `<svg viewBox>` height | the page's content height plus `pageMarginTop + pageMarginBottom`, scaled like the width; never more than `pageHeight * scale / 100` |
| minimum gap between the staves of a braced grand staff | 4 staff spaces = `720` inner units (interline `180`) |
| gap between the staves of two different parts | unchanged by `spacingBraceGroup` |
| page count | ≤ the 1.1.1 page count for the same Score and viewport (smaller margins and staff gaps fit more per page) |

## 3. Page geometry (replaces 004 section 4)

```ts
/** src/ui/score/pages.ts - pure, unit-tested */
export interface PageLayout { page: number; top: number; height: number; measured: boolean }

/** One entry per page, in page order; page 1 starts at `startOffset` (the title block's drawn height). */
export function layoutPages(heights: readonly PageHeight[], startOffset?: number): PageLayout[];

export interface PageHeight { height: number; measured: boolean }

/** Heights for `pageCount` pages: measured ones as given, the rest estimated (rule 2). */
export function pageHeights(
  pageCount: number,
  measured: ReadonlyMap<number, number>, // page -> CSS px, from the rendered viewBox
  fallbackHeight: number,                 // the requested pageHeight in CSS px
): PageHeight[];

/** Scroll correction when one page's height changes (rule 3); 0 when nothing on screen would move. */
export function scrollCompensation(before: PageLayout, newHeight: number, scrollTop: number): number;
```

Rules:

1. A rendered page's element height is `pageElementWidthPx * (its viewBox height / its viewBox width)` - its own
   aspect, not page 1's. The measured height is kept for the whole layout epoch (until the next `load`/`relayout`),
   also after the page is unmounted.
2. An unrendered page's height is the mean of the measured heights so far in this epoch, or `fallbackHeight`
   before any page is measured.
3. When a page's height changes by `Δ = newHeight - before.height` and `before.top + before.height <= scrollTop`
   (the page is wholly above the viewport), the view sets `scrollTop += Δ` through `scrollOwn()` and shifts a running
   glide by `Δ` (`contracts/follow-view.md` section 3). Otherwise no compensation (the change is at or below the
   visible content's anchor, or the page is the one being read and only its blank tail disappears).
4. Pages are stacked with no gap of their own: the space between the last system of one page and the first of the
   next is the two Verovio margins (section 1).

## 4. Guarantees (G-1 to G-4 of 004 still hold)

- **G-5**: The gap between the boxes of the last system of a page and the first system of the next page lies within
  the range of gaps between consecutive systems inside pages of the same Score (spec FR-003); checked over the
  library's piano pieces at 1920 px and 1280 px width.
- **G-6**: No system is clipped by its own page: every `g.system` box lies within its page element's box.
- **G-7**: A page's height changing from estimate to measurement never moves the notation on screen (rule 3).
- **G-8**: The compact spacing is the same in every mode and during a run; starting or stopping a run never changes
  the engraving.
