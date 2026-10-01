# Contract: UI shell (slim bar, panel host, overlays)

**Version**: `1.5.0` (new with feature 004)
**Owner**: `src/ui/elements/mx-app.ts`, `src/ui/layout/*`, `src/ui/state/viewState.ts`

This contract fixes the shape of the application window so that every other element knows where it
may live. It is a UI-layer contract only: no core type, no engine port and no real-time path changes.

**1.5.0** (feature 019-metronome-orchestra-volume, MINOR): new panel id `'sound'`, the **Levels** popover
([019 mixer-levels.md](../../019-metronome-orchestra-volume/contracts/mixer-levels.md) section 1), opened by a
**Levels** button placed right after the Volume slider. Like the Volume slider the button is a toolbar control, not a
menu entry, so it stays enabled in every mode and during every run; the panel is non-modal and small, and - like View
during Listen (1.3.0) - is not closed by starting a run (`closeForRun` leaves `'sound'` open) and never pauses or stops
playback or a session. Opening any other panel closes it (the popover pattern above).

**1.4.0** (feature 017-leftover-sweep, MINOR): Section 2: two more measured fit steps after `compact` - the mode
switch (`.mx-bar-no-mode`), then the size controls (`.mx-bar-no-size`) move to the View popup, which carries a copy of
each (T038). They replace a fixed `max-width: 900px` media query (013 T096) the bar's contents had outgrown: with a
Score open the bar overflowed at about 925-984 px, and during a Practice run at 1280 px. The mode switch goes first,
since it cannot change during a run while zooming can (by the size controls or the keys; no popup opens during a run).
Section 3: a popup whose own tools have nothing to show in the current state shows a one-line hint instead of
opening empty (Setup in Listen, Recent attempts outside Play, Latency before a Play run; T041).

**1.3.0** (feature 016-modern-look-logo, MINOR, owner decision 2026-09-29): Section 3: the **View** entry stays
enabled during a Listen run (playing or paused), so the theme can be changed while listening (016 SC-010,
US5). It is the only exception: during a Practice session or a Play run every entry stays disabled, and starting
any run still closes any open popup. The View popup opened during Listen is not closed by the run guard.

**1.2.0** (feature 016-modern-look-logo, MINOR): Section 2: new first bar slot `#brand` (logo,
[brand.md](../../../specs/016-modern-look-logo/contracts/brand.md)), not focusable, not a toolbar item; the fit order
gains a step between roomy and compact (`.mx-bar-no-word`, R-11). Section 3: the View popup gains the Theme choice
([theme.md](../../../specs/016-modern-look-logo/contracts/theme.md), R-12). Section 6: notices carry an icon with an
accessible name ("Information" / "Warning", R-9); every focusable control has a visible `:focus-visible` ring (FR-006).

**1.1.0** (feature 013-score-browser-progress, MINOR, R-1/R-2/R-20): the bar's `#open-controls` slot
(`mx-open-button`) opens the Score browser - a modal `<dialog>` outside sessions - instead of the file chooser
directly; the file chooser moves inside the browser (*Open file...*). The browser is **not** a `PanelId` and is not
part of `viewState.openPanel`: it has its own open flag (`browserState`) and its own run rule (opening pauses a
playing Listen transport; it refuses to open during a Play run or Practice session; a Play/Practice start closes it
- `src/ui/state/runGuard.ts`). Menu: Score > "Recent scores" becomes "Open..." (opens the browser) and "About this
score" (the `scores` panel, now holding only `mx-score-source`).

---

## 1. Window regions

```text
+--------------------------------------------------------------+
| header#mx-bar        (reserves height, <= 48px @100% scaling) |
+--------------------------------------------------------------+
| main#mx-main                                                  |
|   mx-score-view                     (fills the region)        |
|   div#panel-host                    (overlay, popovers)       |
|   mx-notice-tray                    (overlay, bottom-right)   |
|   mx-piano-keys                     (overlay, bottom, opt-in) |
|   mx-practice-help                  (overlay, near the cursor) |
+--------------------------------------------------------------+
```

Rules:

1. `#mx-bar` is the **only** element permitted to reserve layout space besides the Score view.
2. Every child of `#mx-main` other than `mx-score-view` is `position: absolute` within it and must
   declare a `--mx-inset-*` custom property if it needs the Score to keep clear of it.
3. `mx-score-view` receives `width: 100%` and all remaining height; it never has a sibling in the flow.
4. No element may use `<dialog>.showModal()` or otherwise block interaction while a run is active.

### Insets

| Overlay | Custom property | Effect |
|---|---|---|
| `mx-piano-keys` (when on) | `--mx-inset-bottom` | Added as `padding-bottom` on the Score scroll container, so the follow-scroll band stays clear (FR-010). |
| `mx-notice-tray` | none | Corner-anchored, bounded to 3 stacked notices; never enters the middle band. |

---

## 2. Slim bar contents (FR-002)

Fixed order, left to right:

| Slot | Element | Visible when |
|---|---|---|
| `#brand` | `mx-brand` (logo mark + word; [brand.md](../../../specs/016-modern-look-logo/contracts/brand.md)) | always |
| `#mode-controls` | `mx-mode-switch` | a Score is loaded |
| `#transport-controls` | `mx-transport` | a Score is loaded |
| `#size-controls` | `mx-size-controls` (new) | a Score is loaded |
| `#open-controls` | `mx-open-button` | always |
| `#menu-controls` | `mx-menu` x4 (Score, Setup, View, Help), plus a fifth `more` menu holding all their entries | always (`more` only in compact mode) |
| `#run-status` | `mx-run-status` (new) | always (empty when idle) |

`#brand` is not focusable and is not a toolbar item; Tab moves past it to the first control. Nothing else may be added to the bar without amending this contract.

**One row, always.** The bar never wraps. When its contents would overflow its width, `mx-app` steps through fit
states: `roomy` -> `roomy-no-word` (`.mx-bar-no-word`, hiding the brand word while keeping the mark) -> `compact` (the
four menus are replaced by `more` and the transport sliders shorten) -> `no-mode` (`.mx-bar-no-mode`: the mode switch
moves to the View popup) -> `no-size` (`.mx-bar-no-size`: the size controls move there too). Each step is taken only
when the one before still overflows (1.4.0). Nothing is lost - what leaves the bar is in the View popup - and nothing
is clipped at any window size (`SC-006`).

---

## 3. Panel host and the panel protocol

Every secondary tool is wrapped in `mx-panel`:

```html
<mx-panel data-panel="diagnostics" heading="Audio diagnostics">   <!-- sets popover="auto", role="dialog" -->
  <header>title + close button</header>                          <!-- in its shadow root -->
  <slot>the existing element, unchanged</slot>
</mx-panel>
```

The View popup (`data-panel="view"`) hosts the Theme choice (`<fieldset class="mx-view-theme">`, [theme.md](../../../specs/016-modern-look-logo/contracts/theme.md), R-12).

State machine (source of truth: `viewState.openPanel`, see `data-model.md` section 2):

| Trigger | Result |
|---|---|
| menu entry activated | `openPanel(id)`; any other panel closes |
| close button / Escape / click outside | `closePanel()`; focus returns to the invoker |
| a run starts (Listen, Practice or Play) | `closeForRun()` -> `openPanel = null` |
| View opened during a Listen run (1.3.0) | stays open; any other panel opened during a run is closed |
| a notice arrives | nothing; notices never change `openPanel` and never take focus |
| a Play run is graded | `openPanel('grade')` - the Grade arrives over the Score and takes no focus |

**No popup during a run.** While a Listen, Practice or Play run can be stopped (count-in, running, paused) every
menu entry is disabled - except **View** during a Listen run (1.3.0: the listener chose to open it, and Listen
grades nothing). A popup would cover music - a short score is one page, so nothing could scroll clear of it -
and `SC-004` says nothing but the Score, the bar and notices is on screen during a run. Starting a run closes any
open popup (`closeForRun`) and the entries come back when it ends.

`mx-panel` applies the state to the DOM as:

- `viewState.openPanel === id` -> `el.showPopover?.()`, `hidden = false`, `aria-hidden="false"`
- otherwise -> `el.hidePopover?.()`, `hidden = true`, `aria-hidden="true"`

The optional-call form is deliberate: `happy-dom@20` has no Popover API (research R-3), so unit tests
assert the store and the attributes, and Playwright asserts the native behaviour.

**Panels must not re-render the Score.** Opening or closing a panel changes no layout input of
`mx-score-view`, so no relayout is triggered (FR-020).

---

## 4. Keyboard contract

| Key | Behaviour | Precedence |
|---|---|---|
| `Escape` | closes the open panel if there is one; **otherwise** stops the transport | panel first (research R-4) |
| `Space` | play / pause | unchanged |
| `+` / `=` , `-` / `_` (bare) | Score larger / smaller by `SCORE_SCALE_STEP` | **existing, kept** (spec Assumptions); ignored while focus is in a text-entry control, so a panel's number field can take `-` |
| `Ctrl/Cmd +` , `Ctrl/Cmd -` | Score larger / smaller by `SCORE_SCALE_STEP` | new; same effect as the bare keys |
| `Ctrl/Cmd 0` | Score back to the default size | new |

All Score-size keys live in `src/ui/shortcuts.ts` and write `viewState.setScale` / `resetScale`; the
bare-key handler that used to sit in `src/app/session.ts` is removed, so there is one place that binds
keys to size changes.

Every menu and panel is reachable by Tab; `mx-menu` supports Arrow/Home/End within an open menu and
closes on Escape without touching the transport.

---

## 5. Events

`mx-panel` and `mx-menu` communicate only through `viewState`, plus the focus-return handoff in
`src/ui/layout/invoker.ts` (a DOM node cannot live in the store). No new custom events cross layers; the
existing per-element events (`zoomchange`, `measureclick`, setup-change events) keep their current
names and payloads, except:

| Event | Change |
|---|---|
| `mx-score-view` `zoomchange` | renamed payload field `zoomPercent` -> `scale`; same range and meaning (see `score-layout.md`) |

---

## 6. Accessibility

- The bar is a `<header>` with `role="toolbar"`; each menu button has `aria-haspopup="menu"` and
  `aria-expanded`.
- `#brand` is `aria-hidden="true"` for its SVG mark and exposes the accessible name via the brand word. It is not focusable.
- Each `mx-panel` is `role="dialog"` **without** `aria-modal` (it is non-modal by design, Principle VI) and is
  named by its `heading` attribute, which it copies to `aria-label` on the host (an `aria-labelledby` cannot reach
  the `<h2>` inside its shadow root).
- Opening a panel from a control moves focus to the panel's close button; closing the last open panel returns
  focus to that control (`src/ui/layout/invoker.ts`). A panel the app opens itself (the Grade) takes no focus.
- The run status is an `aria-live="polite"` region so mode and device changes are announced without
  stealing focus.
- Notices carry an icon with an accessible name ("Information" / "Warning", R-9; `src/ui/i18n/en.ts`).
- Every focusable control in the bar and panels has a visible `:focus-visible` outline of ≥ 2 px (`CHROME_FOCUS_RING_PX`, FR-006).

