# Contract: Score layout (fit-to-width and Score size)

**Version**: `1.1.1` (1.1.1: T002 added the measured Verovio unit relation to section 2; no rule
changed) - `1.1.0` was an additive change to
[`001/contracts/worker-messages.md` `1.0.0`](../../001-score-viewer-listen/contracts/worker-messages.md)
(the `LayoutOptions` payload keeps its shape; only how the main thread computes it changes, plus one
new Verovio option). No message is removed or renamed, so the Verovio worker stays backward
compatible.

**Owner**: `src/ui/elements/mx-score-view.ts`, `src/ui/layout/fit.ts`, `src/workers/verovio.worker.ts`

---

## 1. Score size

One integer, `scale`, replaces `zoomPercent` everywhere in the UI (same range, same meaning).

| Constant (`src/engine/config.ts`) | Value | Meaning |
|---|---|---|
| `SCORE_SCALE_MIN` | 50 | smallest Score size |
| `SCORE_SCALE_MAX` | 200 | largest Score size |
| `SCORE_SCALE_DEFAULT` | 100 | fitted size; the reset target |
| `SCORE_SCALE_STEP` | 10 | one press of larger / smaller (FR-014b) |
| `MIN_PAGE_UNITS` | 400 | smallest `pageWidth` / `pageHeight` ever requested; a 1280 px viewport at 200% gives 640, so real windows never reach it |
| `MAX_PAGE_UNITS` | 10000 | largest page ever requested; a 2560 px viewport at 50% gives 5120, so real windows stay under half of it |

Both page-unit bounds sit inside Verovio's accepted range - T001 renders exactly 400 x 400 and
10000 x 10000 and gets those sizes back verbatim - and they are named constants, not magic numbers
(Constitution II).

`ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_DEFAULT` / `ZOOM_STEP` are re-exported as deprecated aliases for one
feature, then removed, so nothing silently keeps two names for one value.

---

## 2. Layout options sent to Verovio

```ts
interface LayoutOptions {
  pageWidth: number;   // Verovio units
  pageHeight: number;  // Verovio units
  scale: number;       // 50..200
}

/** Pure, unit-tested in Node - src/ui/layout/fit.ts */
function fitLayout(viewportWidthPx: number, viewportHeightPx: number, scale: number): LayoutOptions;
```

Rules:

1. `pageWidth = round(viewportWidthPx * 100 / scale)`, `pageHeight = round(viewportHeightPx * 100 / scale)`.
2. Both are clamped to `[MIN_PAGE_UNITS, MAX_PAGE_UNITS]` so a collapsed or absurd viewport can never
   ask Verovio for a degenerate page.
3. A viewport of 0 x 0 (element not yet laid out, or hidden) yields **no** request at all; the last
   good layout stays on screen.
4. `adjustPageHeight` is set to `0` for this mode: the height is dictated, not derived.
5. The unit relation below is pinned by `tests/verovio/page-units.test.ts` (T001, `verovio 6.3.0`);
   a Verovio upgrade that changes it fails that test, and this contract is corrected first.

### Pinned unit relation (measured, T001)

With `svgViewBox: 1` (what the worker sets):

| Quantity | Value |
|---|---|
| outer `<svg viewBox>` width | `pageWidth * scale / 100` |
| outer `<svg viewBox>` height | `pageHeight * scale / 100` when `adjustPageHeight` is `0`; content-derived, and smaller, when `1` |
| inner `svg.definition-scale` viewBox width | `10 * pageWidth`, whatever the `scale` |
| staff interline, inner units | `180`, whatever `pageWidth`, `pageHeight` or `scale` |
| measures per system, page breaks | a function of `pageWidth` and `pageHeight` only |

Consequences that the rules above rely on:

- **Verovio's own `scale` never changes the engraving density**; it only sets the nominal outer size.
  The user's Score size therefore has to be expressed through `pageWidth` - which is exactly what rule 1
  does: a smaller `pageWidth` means fewer interlines across the page, so each is drawn larger.
- With rule 1 the outer viewBox is `viewportWidthPx` by `viewportHeightPx`, so **one outer unit is one
  CSS pixel** and one Verovio page is exactly one screenful. The on-screen interline is
  `18 * scale / 100` CSS px (9 at 50 %, 18 at 100 %, 36 at 200 %).
- `pageWidth` is rounded to an integer, so the outer size is within `scale / 200` px (at most 1 px) of
  the viewport; this is intended and not an error.
- Rule 4 is **required**, not a preference: with `adjustPageHeight: 1` the height is derived from the
  content (929 instead of 1000 in the measured case), so the page would not be one screenful.
- The worker keeps forwarding `scale` unchanged (harmless, and it keeps the outer viewBox in CSS px).

---

## 3. When a relayout happens

| Trigger | Debounce | Anchor |
|---|---|---|
| Score viewport resized (`ResizeObserver`) | `RELAYOUT_DEBOUNCE_MS` (150 ms) | current top measure |
| `scale` changed by the user | `RELAYOUT_DEBOUNCE_MS` | current top measure |
| Panel opened or closed | **never** - the viewport does not change (FR-020) | - |
| A run is active | allowed, but must not exceed a 50 ms main-thread task (Principle I) | cursor measure |

The existing `relayout()` re-anchoring (`pageOf` + scroll restore) is reused unchanged; the cursor
position in ticks is never affected, because layout carries no musical time.

---

## 4. Page geometry

Each page element's height comes from the rendered SVG's `viewBox`:

```text
pageElementHeightPx = pageElementWidthPx * (viewBoxHeight / viewBoxWidth)
```

replacing the hard-coded `DEFAULT_PAGE_HEIGHT = 1600`. `layoutPages()` keeps its signature but is
given the measured height. This corrects an existing mismatch between the placeholder height and the
real rendered height (research R-2, finding 3).

---

## 5. Guarantees

- **G-1**: No horizontal scrollbar is produced at any `scale`, at any viewport in the supported range.
- **G-2**: Changing `scale` never changes which measures exist, their Note IDs, or any musical timing.
- **G-3**: After a relayout, the measure that was at the top of the viewport is still at the top
  (within one system), and an active run's cursor stays on its own measure.
- **G-4**: A relayout while a run is active performs no work on the audio thread and posts no message
  to the audio worklet.
