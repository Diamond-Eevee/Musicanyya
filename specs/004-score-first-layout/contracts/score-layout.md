# Contract: Score layout (fit-to-width and Score size)

**Version**: `1.1.0` - additive change to
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

Both page-unit bounds sit well inside Verovio's accepted range and are **provisional until T001
pins the unit relation** (section 2, rule 5); they are named constants, not magic numbers
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
5. The exact unit relation is pinned by a spike test against `verovio 6.3.0` before implementation
   (research R-2); if the measured relation differs from rule 1, this contract is corrected **first**.

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
