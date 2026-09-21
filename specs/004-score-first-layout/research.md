# Phase 0 Research: Score-First Application Window

Feature `004-score-first-layout`. Every decision below is a UI-layer decision; no core, engine or
real-time behaviour is touched.

---

## R-1: What actually costs the Score its space today

**Finding** (read from the code, not assumed): `src/ui/elements/mx-app.ts` builds a fixed grid -
a 60 px header plus, inside `.mx-main`, `.mx-side-panel` (300 px), the Score area, `.mx-help-panel`
(360 px) and `.mx-diagnostics-panel` (280 px). The three asides are always in the layout, so on a
1920 px screen the Score gets `1920 - 940 = 980` px at best, and less once scrollbars are counted -
matching the owner's screenshot where the Score is an unreadable sliver.

`src/app/session.ts` mounts eleven elements into those asides
(`#side-panel`: recent list, MIDI panel, Practice panel, Play panel, Grade panel, attempts list,
latency panel; `#help-panel`; `#diagnostics-panel`; `#score-area`: piano keys, practice help).

**Decision**: remove the three asides from the layout entirely. `.mx-main` contains the Score view
plus absolutely-positioned overlay hosts. Everything else is mounted into a popover host.

**Rationale**: no amount of styling fixes a layout that reserves 940 px; the elements themselves must
leave the flow.

**Alternatives considered**: collapsible asides (still reserve a rail, and the user asked for hidden,
not narrow); a resizable splitter (adds state and still steals space by default).

---

## R-2: Fit-to-width and the "larger / smaller" control (FR-014, FR-014a/b)

**Finding**: `mx-score-view` asks Verovio for a fixed page of `1200 x 1600` with
`scale = zoomPercent`, while `.mx-score-page` is `width: 100%; max-width: 1200px` and the SVG is
`width: 100%; height: auto` with `svgViewBox: 1`. Consequences:

1. The Score is capped at 1200 px however wide the window is.
2. Because CSS already stretches the SVG to the container, `scale` today has **no visible effect at
   all**. *(Corrected 2026-09-21 by T001: the first draft of this finding said `scale` changed engraving
   density. Measured with `verovio 6.3.0` and `svgViewBox: 1`, `scale` only sets the nominal outer size
   of the SVG; measures per system depend on `pageWidth` alone. The existing zoom keys therefore change
   a stored number and nothing on screen - a defect in feature 001 that this feature fixes.)*
3. `adjustPageHeight: 1` makes the real page height content-dependent, but `applyPageCount()` sets
   every page element to a hard `1600 px`. Page mounting and follow-scroll therefore work against a
   height that is usually wrong. This is an existing defect that fit-to-width makes obvious.

**Decision**:

- Ask Verovio for a page whose size follows the Score viewport: `pageWidth = round(viewportWidth *
  100 / scale)`, `pageHeight = round(viewportHeight * 100 / scale)`, both in Verovio's own units, so
  one Verovio page renders as exactly one screenful at the chosen size. `scale` (50-200, step 10)
  stays the user's "larger / smaller" control; `100` is the default and the reset target.
- Drive it from a `ResizeObserver` on the scroll container, debounced by the existing
  `RELAYOUT_DEBOUNCE_MS` (150 ms), re-anchored on the current measure exactly as `relayout()` already
  does for zoom.
- Take each page element's height from the rendered SVG's `viewBox` aspect ratio instead of the
  hard-coded constant (fixes 3).

**Consequence for the spec**: enlarging re-flows the music into fewer measures per system rather than
overflowing sideways, so horizontal scrolling is never needed. FR-014a was amended accordingly.

**Rationale**: it uses the engraver the constitution already mandates (Principle III) to do the
scaling, keeps the page a whole number of screenfuls for paging and follow-scroll, and needs no new
maths in the UI beyond one division.

**Verified (spike T001, 2026-09-21, `tests/verovio/page-units.test.ts`, kept as a regression test)**:
with `svgViewBox: 1` the outer viewBox is `pageWidth * scale / 100` by `pageHeight * scale / 100` (height
only with `adjustPageHeight: 0`), the inner viewBox is `10 * pageWidth` wide with a constant interline of
180 inner units, so the derivation above holds and the on-screen interline is `18 * scale / 100` CSS px.
`adjustPageHeight` **must** be `0` for a dictated height (with `1` the page came out 929 tall instead of
1000). The full table is in `contracts/score-layout.md` section 2.

**Alternatives considered**: CSS `transform: scale()` on a fixed-size SVG (blurs nothing but breaks
the canvas overlay's coordinate maths and gives horizontal overflow); leaving `pageWidth` fixed and
only raising the CSS `max-width` (staves stretch, but line breaks stay computed for 1200 px, so
spacing quality degrades - unacceptable under Principle III).

---

## R-3: How popups are built without a UI framework (FR-003 - FR-006)

**Decision**: the native **Popover API** (`popover="auto"`, `showPopover()`, `hidePopover()`), one
generic `mx-panel` wrapper element per panel, all mounted in a single `#panel-host` overlay container.

**Verified facts**:

- The Popover API gives light dismiss (click outside), Escape dismiss, focus return to the invoker and
  a top-layer stacking context without any library. `popover="auto"` is explicitly **non-modal**, and
  auto popovers close each other - which is exactly FR-004 ("at most one open").
- It is Baseline widely available (Chrome/Edge 114, Safari 17, Firefox 125); all browsers in the
  constitution's support table have it.
- **`happy-dom@20` does not implement it.** Checked in `node_modules`: `HTMLElement` reflects the
  `popover` attribute but has no `showPopover` / `hidePopover` / `togglePopover`. Unit tests therefore
  cannot exercise native popover behaviour.

**Decision that follows**: `viewState.openPanel` (a `PanelId | null` in our own store) is the **source
of truth**; the native API is applied as an enhancement (`el.showPopover?.()`), and `mx-panel` also
sets `hidden`/`aria-hidden` itself. Unit tests assert the store and the DOM attributes; Playwright
e2e asserts real Escape / click-outside / focus-return behaviour.

**Alternatives considered**: `<dialog>.showModal()` - rejected outright, it is modal and Principle VI
forbids anything modal during a session; a hand-written overlay with our own focus trap and key
handling - more code, worse accessibility, and duplicates a platform feature (Principle VIII).

**Positioning**: CSS Anchor Positioning is **not** used - its Firefox support is too recent to rely on.
Menus and panels are positioned with `getBoundingClientRect()` in a tiny pure helper
(`src/ui/layout/anchor.ts`), which is unit-testable in Node.

---

## R-4: Escape already means "stop" (FR-005 vs. existing shortcut)

**Finding**: `src/ui/shortcuts.ts` binds Escape to `transportState.stop()` at document level. FR-005
binds Escape to "close the popup". Native popover dismissal would fire *as well*, so pressing Escape
to close the diagnostics panel would also stop a run.

**Decision**: precedence - if any panel is open (`viewState.openPanel !== null`), Escape closes the
panel and does nothing else; otherwise Escape stops. Implemented by an early return in the document
handler, so the rule is one testable branch. Documented in `contracts/ui-shell.md` and in the Help
panel's shortcut list.

**Rationale**: closing the thing on top is what every application does; a run can still be stopped by
pressing Escape a second time, or with the always-visible Stop control (FR-008).

**Alternatives considered**: a different key for panels (surprising, and native popover would still
consume Escape); disabling native Escape dismissal (fights the platform).

---

## R-5: Keeping the cursor in clear space (FR-010)

**Finding**: `followScrollTo()` already keeps the cursor's measure inside the middle 60 % of the
viewport (`FOLLOW_MARGIN = 0.2`). With the asides gone, the remaining floating elements are the notice
tray, the optional piano-keys strip and the practice-help bubble.

**Decision**: no new scrolling logic. The slim bar is opaque and **reserves** its height (it is the one
piece of chrome that does), so it can never cover a note. The floating elements get a declared inset:
the scroll container carries `padding-bottom` equal to the piano strip's height when it is shown, and
the notice tray sits in the bottom-right corner, bounded to 3 stacked notices. The middle-band rule
then keeps the cursor clear by construction, which an e2e test samples at 10 Hz (SC-005).

**Rationale**: reusing the existing, already-tested follow rule beats adding a second layout
negotiation; "reserve, don't overlap" for the one always-visible element is the simplest thing that
cannot fail.

**Alternatives considered**: auto-hiding the bar on cursor approach (janky, and hides Stop);
`scroll-margin` (does not apply - we scroll programmatically, not via `scrollIntoView`).

---

## R-6: Where the panel state and the view preferences live

**Decision**: extend `ViewState` (`src/ui/state/viewState.ts`) with `scale`, `openPanel`, and an
`overlays` record; persist `scale` and `overlays` through the existing `SettingsStore` /
`musicanyya.settings.v1`, bumping the settings contract to **version 2** with per-field validation and
fall-back to defaults (the file's existing rule). `openPanel` is session-only and never persisted.

**Rationale**: `zoomPercent` is already stored there and validated field by field, so this is an
additive change to a format that already tolerates unknown and missing fields. The constitution's
storage rule ("`localStorage` only for tiny UI preferences") fits exactly.

**Migration**: a stored `zoomPercent` is read as the new `scale` (same 50-200 range and meaning),
so returning users keep their size. `version: 1` files load without a warning.

**Alternatives considered**: a new `musicanyya.view.v1` key (a fourth key for three integers and four
booleans - unjustified).

---

## R-7: Testing measurable layout claims (SC-001, SC-002, SC-006)

**Decision**: the numeric layout criteria are verified in Playwright, not in happy-dom: a
`tests/e2e/us1-layout.spec.ts` sets the viewport to each listed size, loads a fixture Score, and
asserts the Score view's bounding box against the window (>= 90 % height, full width), that no
horizontal document scrollbar exists, and that the toolbar is <= 48 px. happy-dom reports zero-sized
boxes, so it cannot answer these questions at all.

Unit tests (Vitest + happy-dom) cover what is logic rather than geometry: panel open/close state
machine, Escape precedence, the fit-to-width arithmetic (a pure function), settings validation and
migration, and that starting a run clears `openPanel`.

**Rationale**: Principle IV wants the *logic* testable in Node; geometry is genuinely a browser
question and already has an e2e harness.

---

## R-8: Risk - unfinished work in features 001 and 003

**Finding**: `001-score-viewer-listen` shows 138/141 tasks and `003-play-mode-grading` 107/109; both
were merged into `main`. The open tasks touch `src/ui` and `src/app/session.ts`, the same files this
feature restructures.

**Decision**: this feature does not adopt those tasks. Before implementation starts, the open tasks are
read and any that would be invalidated by the restructure are listed in `tasks.md` as an explicit
note, so they are re-checked against the new layout rather than silently lost.

**Rationale**: silently inheriting another feature's unfinished work breaks the task ledger that
`AGENTS.md` relies on.

---

## R-9: New runtime dependencies

**Decision**: **none.** Everything above is DOM, CSS and the Popover API, plus code that already
exists. `Complexity Tracking` in `plan.md` is therefore empty.

---

## R-10: No popup and no setup change during a run (FR-006, FR-007; owner decision 2026-09-21)

**Decision**: while a Listen, Practice or Play run can be stopped, every menu entry is disabled, so no popup can be
opened; changing Practice/Play setup (hand, accompaniment, loop) means stopping first. The Practice session's
live-change code and its e2e test stay, unreachable from the UI.

**Rationale**: SC-004 wants nothing but the Score, the bar and notices on screen during a run, and a short score is
one page, so a popup could never scroll clear of the music.

**Alternatives considered**: (a) keep Diagnostics reachable through a small in-run readout - not needed for this
feature, a possible later one; (b) delete the live-change path as dead code - rejected: it is small, tested, and
feature 002's spec asked for it.
