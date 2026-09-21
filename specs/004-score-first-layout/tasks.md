# Tasks: Score-First Application Window

**Input**: Design documents from `specs/004-score-first-layout/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
-->

**Real-time paths**: this feature edits **no** AudioWorklet, scheduler, metronome or MIDI-timing code
(plan.md "Real-time Paths Touched"). The only RT-adjacent claim is contract `score-layout.md` **G-4**
(a relayout during an active run does no audio-thread work and posts no worklet message), which is
reviewed once in Polish (T104) rather than per task.

**Inherited open tasks (research R-8)**: `001-score-viewer-listen` T138, T139, T141 and
`003-play-mode-grading` T082, T110 are still open on `main` and touch these files. This feature does
**not** adopt them; T004 re-checks whether the restructure invalidates any of them and records the
verdict, so they are not silently lost.

---

## Phase 1: Setup

- [ ] T001 Pin Verovio's page-unit relation before any UI work (research R-2, `score-layout.md` section 2
      rule 5): add `tests/verovio/page-units.test.ts` that renders a fixture through the real
      `verovio 6.3.0` worker path at several `pageWidth` / `pageHeight` / `scale` combinations and
      asserts the measured relation to the rendered SVG `viewBox`, including whether `adjustPageHeight`
      must be `0` for a dictated height. Keep it as a permanent regression test.
- [ ] T002 If T001's measurements differ from the assumed rule, correct
      `specs/004-score-first-layout/contracts/score-layout.md` section 2 and `research.md` R-2
      **first**, and note the correction in `specs/004-score-first-layout/implementation-log.md`
      (depends on T001).
- [ ] T003 [P] Add `SCORE_SCALE_MIN` (50), `SCORE_SCALE_MAX` (200), `SCORE_SCALE_DEFAULT` (100),
      `SCORE_SCALE_STEP` (10), `MIN_PAGE_UNITS` (400) and `MAX_PAGE_UNITS` (10000) to
      `src/engine/config.ts`, and re-export `ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_DEFAULT` / `ZOOM_STEP` as
      deprecated aliases (removed in T107); update the constants table in
      `specs/004-score-first-layout/contracts/score-layout.md` section 1 if T001 changed any value
      (the two page-unit bounds are provisional until T001 pins the unit relation).
- [ ] T004 [P] Re-check the five inherited open tasks (001 T138/T139/T141, 003 T082/T110) against the
      new layout and record the verdict - still valid, invalidated, or superseded - in the
      "Inherited open tasks" note above and in `implementation-log.md`.

---

## Phase 2: Foundational (blocks all user stories)

Everything here is pure logic or store-level, so it is testable in Node (Constitution IV) and every
story depends on it.

### Tests (write first, confirm they fail)

- [ ] T005 [P] `tests/ui/view-state.test.ts`: `setScale` clamps to 50-200 and rounds to the nearest
      `SCORE_SCALE_STEP`; `resetScale()` gives 100; `openPanel(id)` replaces any open panel (FR-004);
      `closePanel()` gives `null`; `closeForRun()` gives `null` (FR-006); an unknown `PanelId` string
      reads as `null`; `setOverlay` toggles one layer with `pianoKeys` defaulting to `false`
      (`data-model.md` section 2).
- [ ] T006 [P] `tests/ui/fit.test.ts`: `fitLayout(viewportW, viewportH, scale)` returns
      `pageWidth = round(w * 100 / scale)` and `pageHeight = round(h * 100 / scale)` (or the relation
      T001 measured), clamps both to `[MIN_PAGE_UNITS, MAX_PAGE_UNITS]`, and returns `null` for a
      0 x 0 viewport so the last good layout stays (`score-layout.md` section 2 rules 1-3).
- [ ] T007 [P] `tests/ui/anchor.test.ts`: `anchorRect(invokerRect, popupSize, viewportSize, placement)`
      places the popup under its invoker, flips or shifts it when it would leave the viewport, and
      never returns a negative offset (research R-3, positioning).
- [ ] T008 [P] `tests/engine/storage/settings-v2.test.ts`: the `view-settings.md` section 3 migration
      table - `version: 1` plus a valid `zoomPercent` gives `scale` unchanged and `version: 2`;
      `version: 1` without `zoomPercent` gives `scale: 100`; no file gives all defaults; every field is
      validated on its own with fall-back to its default; unknown fields survive a save; the next
      `save()` writes `version: 2` and drops `zoomPercent`.
- [ ] T009 [P] `tests/ui/panel.test.ts`: `mx-panel` reflects `viewState.openPanel` onto
      `hidden` / `aria-hidden`, calls `showPopover?.()` / `hidePopover?.()` only when present (happy-dom
      has neither), carries `role="dialog"` **without** `aria-modal`, takes its accessible name from
      its heading, and closes via its close button (`ui-shell.md` sections 3 and 6).
- [ ] T010 [P] `tests/ui/menu.test.ts`: `mx-menu` renders the entries of one menu group from
      `menu-model.ts`, sets `aria-haspopup="menu"` and `aria-expanded`, activates an entry by calling
      `viewState.openPanel(id)`, supports Arrow/Home/End within the open list, closes on Escape
      **without** touching the transport, and renders inapplicable entries as disabled rather than
      hidden (`data-model.md` section 5).

### Implementation

- [ ] T011 `src/ui/layout/fit.ts` - the pure `fitLayout()` of `score-layout.md` section 2 (makes T006
      pass; depends on T003).
- [ ] T012 [P] `src/ui/layout/anchor.ts` - the pure anchoring helper (makes T007 pass).
- [ ] T013 `src/ui/state/viewState.ts` - replace `zoomPercent` with `scale`, add `openPanel`,
      `overlays` and the `setScale` / `resetScale` / `openPanel` / `closePanel` / `closeForRun` /
      `setOverlay` transitions of `data-model.md` section 2 (makes T005 pass; depends on T003).
- [ ] T014 `src/engine/ports.ts` - `UserSettings` version 2: `version: 2`, `scale`, `overlays`;
      `zoomPercent` removed from the interface (`view-settings.md` section 1). In the same commit,
      update `tests/fakes/memory-settings-store.ts` (its `BUILT_IN_USER` declares the v1 shape and would
      break typecheck) to `version: 2`, `scale: SCORE_SCALE_DEFAULT` and the default `overlays`.
- [ ] T015 `src/engine/storage/local-settings-store.ts` - validate `scale` and each `overlays` field on
      its own, and migrate v1 to v2 silently (makes T008 pass; depends on T014). In the same commit,
      restate the eight `zoomPercent` / `version: 1` assertions of
      `tests/engine/storage/local-settings-store.test.ts` in v2 terms (`scale`, `version: 2`) - a
      correction forced by the rename, each assertion keeping its strictness; the v1 -> v2 behaviours
      themselves are T008's.
- [ ] T016 [P] `src/ui/layout/menu-model.ts` with the four menus (Score, Setup, View, Help) and their
      `PanelId` entries, plus their labels, panel titles, size-control labels and overlay-switch labels
      in `src/ui/i18n/en.ts` (`data-model.md` section 5).
- [ ] T017 `src/ui/elements/mx-panel.ts` - the generic popover wrapper (header with title and close
      button, slot for the existing element) driven by `viewState.openPanel` (makes T009 pass; depends
      on T013).
- [ ] T018 `src/ui/elements/mx-menu.ts` - menu button plus keyboard-navigable list (makes T010 pass;
      depends on T013, T016).
- [ ] T019 [P] `src/ui/styles/panels.css` - appearance and top-layer styling for `mx-panel` and
      `mx-menu`; no element here may reserve flow space (`ui-shell.md` section 1 rule 2).

**Checkpoint**: the panel state machine, the fit arithmetic and settings v2 are green in Node; the user
stories can proceed.

---

## Phase 3: User Story 1 - The Score fills the window (Priority: P1) MVP

**Goal**: the Score view spans the full window width and all height except one slim bar (at most 48 px),
the Score fits the viewport width at any window size, and the user can make it larger or smaller.

**Independent Test**: open a multi-page MusicXML file maximised on 1920x1080 - the Score occupies the
full width and at least 90% of the height, at least two systems of a two-staff piano score are readable
without scrolling, and no side or bottom panel reserves any space.

### Tests (write first, confirm they fail)

- [ ] T020 [P] [US1] `tests/e2e/us1-layout.spec.ts`: at 1280x720, 1366x768, 1600x900, 1920x1080 and
      2560x1440 with a fixture Score loaded - the Score view's bounding box is 100% of the window width
      and at least 90% of its height (SC-001), `#mx-bar` is at most 48 px tall, there is no horizontal
      document scrollbar (G-1), and no element other than the bar and the Score view occupies flow
      space (SC-006).
- [ ] T021 [P] [US1] `tests/e2e/us1-layout.spec.ts` (same file, second describe): at 1920x1080 at least
      two systems of `tests/fixtures/musicxml/c-major-scale-and-chords.musicxml` are fully inside the
      viewport without scrolling (SC-002).
- [ ] T022 [P] [US1] `tests/ui/score-view-fit.test.ts`: `mx-score-view` derives its `LayoutOptions` from
      the observed viewport through `fitLayout()`, debounces relayout by `RELAYOUT_DEBOUNCE_MS`, sends
      no request for a 0 x 0 viewport, sets `adjustPageHeight` per T001, and computes each page
      element's height from the rendered SVG `viewBox` aspect ratio instead of a constant
      (`score-layout.md` section 4).
- [ ] T023 [P] [US1] `tests/ui/size-controls.test.ts`: `mx-size-controls` renders larger / smaller /
      reset, steps `viewState.scale` by `SCORE_SCALE_STEP`, disables larger at 200 and smaller at 50,
      reset returns to 100, and each control has an accessible name.
- [ ] T024 [P] [US1] `tests/ui/shortcuts.test.ts`: the existing bare `+` / `=` and `-` / `_` keys **and**
      the new `Ctrl/Cmd +`, `Ctrl/Cmd -` change `viewState.scale` by `SCORE_SCALE_STEP`, `Ctrl/Cmd 0`
      resets it to 100 (`ui-shell.md` section 4); bare `+` / `-` are ignored while focus is in a
      text-entry control; `Space` still toggles play.
- [ ] T025 [P] [US1] `tests/ui/empty-state.test.ts`: with no Score loaded the Score area shows one
      invitation with an open action reachable in one activation, and a MusicXML file dropped anywhere
      in the Score area is accepted (FR-016).

### Implementation

- [ ] T026 [US1] Rewrite `src/ui/elements/mx-app.ts` to the regions of `ui-shell.md` section 1: a single
      `header#mx-bar` with the slots of section 2 in their fixed order, a `main#mx-main` containing only
      `mx-score-view` plus the absolutely-positioned `#panel-host`, `mx-notice-tray`, `mx-piano-keys`
      and `mx-practice-help`; the three asides are removed (depends on T017, T018).
- [ ] T027 [US1] Rewrite `src/ui/styles/layout.css`: bar height token at most 48 px at 100% scaling,
      main as the full remaining area, overlay hosts absolutely positioned, `--mx-inset-*` custom
      properties declared; the `.mx-side-panel` / `.mx-help-panel` / `.mx-diagnostics-panel` widths are
      deleted (depends on T026).
- [ ] T028 [US1] `src/ui/elements/mx-score-view.ts`: observe the scroll container with a
      `ResizeObserver`, derive `LayoutOptions` through `fitLayout()`, rename the `zoomchange` payload
      field `zoomPercent` to `scale` (`ui-shell.md` section 5), and re-anchor on the current top measure
      using the existing `relayout()` path (makes T022 pass; depends on T011, T013).
- [ ] T029 [US1] `src/ui/score/pages.ts` and `mx-score-view.applyPageCount()`: take the page height from
      the rendered SVG `viewBox` aspect ratio and pass it to `layoutPages()`, replacing
      `DEFAULT_PAGE_HEIGHT = 1600` (`score-layout.md` section 4; depends on T028).
- [ ] T030 [US1] `src/workers/verovio.worker.ts`: set `adjustPageHeight` as T001 determined for both
      `render` and `relayout`, leaving the message shape unchanged (the worker contract stays backward
      compatible).
- [ ] T031 [P] [US1] `src/ui/elements/mx-size-controls.ts` - larger / smaller / reset bound to
      `viewState` (makes T023 pass; depends on T013).
- [ ] T032 [US1] `src/ui/shortcuts.ts`: move the bare `+` / `=` / `-` / `_` Score-size keys here from
      `src/app/session.ts` `onKeyDown` (kept, per spec Assumptions) and add `Ctrl/Cmd +`, `Ctrl/Cmd -`,
      `Ctrl/Cmd 0`, all writing `viewState.setScale` / `resetScale` (makes T024 pass; Escape precedence
      is T046; the `session.ts` branch is deleted in T034).
- [ ] T033 [US1] `src/ui/elements/mx-drop-zone.ts` plus the empty state in `mx-app`: the invitation fills
      the Score area and accepts a drop anywhere in it (makes T025 pass).
- [ ] T034 [US1] `src/app/session.ts`: mount the Score view, mode switch, transport, open button, size
      controls and menus into the new bar and main regions; load `scale` from settings, persist it on
      `zoomchange`, drop every `zoomPercent` reference and the bare-key zoom branch of `onKeyDown`
      (now T032), and bridge `viewState.scale` -> the Score view in one direction only, so a size change
      from a control, a shortcut or a stored setting takes the same path (depends on T014, T026, T031,
      T032).
- [ ] T035 [US1] `src/ui/styles/score.css`: page sizing without the 1200 px cap, insets consumed from
      `--mx-inset-*`, no horizontal overflow at any `scale` (G-1).
- [ ] T036 [US1] Update the existing unit tests whose DOM assumptions moved -
      `tests/ui/score-view.test.ts`, `tests/ui/transport.test.ts`, `tests/ui/open-and-recent.test.ts` -
      selectors and mount points only; no assertion may be weakened or skipped.
- [ ] T037 [US1] Update the existing e2e specs' selectors for the new regions -
      `tests/e2e/us1-open-view.spec.ts`, `us1-play.spec.ts`, `us1-practice.spec.ts`,
      `us2-listen.spec.ts`, `us2-grade.spec.ts`, `us3-play-setup.spec.ts`, `us4-attempts.spec.ts`,
      `electron-smoke.spec.ts`, `static-host.spec.ts` - selectors only, assertions unchanged (the one
      `zoomPercent` assertion in `us1-open-view.spec.ts` is T038, not this task).
- [ ] T038 [US1] `tests/e2e/us1-open-view.spec.ts:35`: the persisted-zoom assertion reads
      `.zoomPercent` from localStorage; T015 renames the field, so read `.scale` instead. A correction
      forced by the rename, not a weakening: the expected value (110 after one `+` press) and the
      bare-`+` key press above it stay exactly as they are (depends on T015, T032, T034).
- [ ] T039 [US1] `tests/e2e/us1-layout.spec.ts` (same file as T020/T021): a malformed MusicXML file
      opened or dropped on the empty Score area shows its failure message in that area, and with a Score
      already open shows it as a notice - in both cases the window keeps one slim bar and no layout jump
      (spec edge case "Malformed or unsupported MusicXML"; write it with T020-T025 so it fails first).

**Checkpoint**: US1 verifiable on its own - the Score owns the window at every supported size, the size
controls work, and every existing suite is green (SC-001, SC-002, SC-006, part of SC-008a).

---

## Phase 4: User Story 2 - Secondary tools live in menus and popups (Priority: P2)

**Goal**: recent scores, MIDI, environment, diagnostics, help and latency are reachable only from the
bar's menus and open as popups over the Score.

**Independent Test**: open each secondary tool from the menus in turn - each appears as a popup over the
Score, only one is open at a time, Escape closes it and returns focus, and the Score is unchanged
underneath.

### Tests (write first, confirm they fail)

- [ ] T040 [P] [US2] `tests/e2e/us2-panels.spec.ts`: every menu entry opens its panel over the Score;
      opening a second closes the first (FR-004); Escape, the close button and a click outside all close
      it and return focus to the invoking control (FR-005); the Score's scroll position and rendered SVG
      are unchanged before and after (FR-020); each tool is reachable in at most 2 activations and
      closed in 1 (SC-003); open and close each complete within 100 ms (SC-007).
- [ ] T041 [P] [US2] `tests/e2e/us2-panels.spec.ts` (same file): with a panel open, starting Listen,
      Practice or Play closes the panel automatically and the run starts with no dialog (FR-006); and
      opening then closing a panel while a run is active produces no main-thread task longer than
      50 ms (long-task observer) and does not stop or move the run (SC-007's second clause).
- [ ] T042 [P] [US2] `tests/ui/escape-precedence.test.ts`: with a panel open Escape closes the panel and
      does **not** stop the transport; with no panel open Escape stops it (research R-4, `ui-shell.md`
      section 4).
- [ ] T043 [P] [US2] `tests/ui/panel-host.test.ts`: `session.ts` mounts all ten `PanelId` tools into
      `#panel-host` wrapped in `mx-panel`, each with the right `data-panel`, and none of them is a child
      of the bar or of `mx-score-view`.
- [ ] T044 [P] [US2] `tests/ui/panel-keyboard.test.ts`: every control inside an open panel is in the tab
      order, and the panel is dismissible without a mouse (FR-005, Acceptance 2.5).

### Implementation

- [ ] T045 [US2] `src/app/session.ts`: re-parent `mx-recent-list`, `mx-attempts-list`, `mx-midi-panel`,
      `mx-latency-panel`, `mx-environment-panel`, `mx-diagnostics`, `mx-help-notation` (content
      unchanged) into `mx-panel` wrappers inside `#panel-host`, and delete the old `#side-panel` /
      `#help-panel` / `#diagnostics-panel` lookups and their toggle buttons (makes T043 pass; depends on
      T017, T034).
- [ ] T046 [US2] `src/ui/shortcuts.ts`: Escape precedence - close the open panel and return, otherwise
      stop the transport (makes T042 pass; depends on T013).
- [ ] T047 [US2] Wire the four `mx-menu` instances in the bar to `menu-model.ts`, disabling entries that
      cannot apply (no Score loaded) rather than hiding them (depends on T018, T026).
- [ ] T048 [US2] Call `viewState.closeForRun()` at the single place each run starts in
      `src/app/session.ts` (Listen, Practice, Play) so FR-006 has one call site (makes T041 pass; depends
      on T013).
- [ ] T049 [US2] Verify and, if needed, enforce that opening or closing a panel changes no layout input
      of `mx-score-view`, so no relayout is triggered (`ui-shell.md` section 3 last rule, FR-020; makes
      the T040 scroll/SVG assertion pass).
- [ ] T050 [US2] Add the Escape-precedence rule and the new shortcuts to the shortcut list in
      `src/ui/elements/mx-help-notation.ts` and `src/ui/i18n/en.ts` (research R-4).

**Checkpoint**: US1 and US2 both work independently - the Score still owns the window, and every
secondary tool lives behind a menu.

---

## Phase 5: User Story 3 - Mode setup before the run, minimal chrome during it (Priority: P2)

**Goal**: Practice and Play setup happens in a popup before the run; during a run only mode, position
and Stop remain, and the Grade arrives over the Score in a dismissible panel.

**Independent Test**: choose Practice, adjust the settings in the setup popup, start the run - the setup
is gone, the Score is at full size, and the bar shows mode, measure and a working Stop.

### Tests (write first, confirm they fail)

- [ ] T060 [P] [US3] `tests/ui/run-status.test.ts`: `mx-run-status` derives `mode`, `phase`,
      `measureLabel`, `deviceState` and `canStop` from `transportState`, `practiceState`, `playState`
      and `midiState` without holding state of its own, is `aria-live="polite"`, and is empty when idle
      (`data-model.md` section 3, `ui-shell.md` section 6).
- [ ] T061 [P] [US3] `tests/e2e/us3-run-chrome.spec.ts`: while a run is active no setup control is
      visible, mode plus current measure plus Stop are visible in the bar at all times (FR-008), and the
      number of on-screen elements other than the Score, the bar and transient notices is zero (SC-004).
- [ ] T062 [P] [US3] `tests/e2e/us3-run-chrome.spec.ts` (same file): Stop ends the run in one activation;
      a device-lost notice during a run appears in the notice tray with no dialog and no layout jump
      (Acceptance 3.3, edge cases).
- [ ] T063 [P] [US3] `tests/ui/setup-panel.test.ts`: the `setup` panel shows `mx-practice-panel` in
      Practice mode and `mx-play-panel` in Play mode, with the same settings and the same change events
      as before (FR-007, FR-018).
- [ ] T064 [P] [US3] `tests/e2e/us3-run-chrome.spec.ts` (same file): when a Play run finishes the Grade
      appears over the Score as a dismissible panel, and dismissing it leaves the per-note Grade marks
      on the notes (FR-009).

### Implementation

- [ ] T065 [P] [US3] `src/ui/elements/mx-run-status.ts` - mode, measure, device state and Stop (makes
      T060 pass; depends on T013).
- [ ] T066 [US3] Mount `mx-run-status` in the bar's `#run-status` slot and hide the setup panels while a
      run is active in `src/app/session.ts` (makes T061 pass; depends on T026, T065).
- [ ] T067 [US3] Route `mx-practice-panel` and `mx-play-panel` into the single `setup` panel chosen by
      the current mode, content and events unchanged (makes T063 pass; depends on T045).
- [ ] T068 [US3] Present `mx-grade-panel` as the `grade` panel over the Score, opened when a Play run
      finishes and dismissible without clearing `grade-marks` (makes T064 pass; depends on T017, T045).
- [ ] T069 [US3] Confirm no message path during a run is modal: `src/ui/elements/mx-notice-tray.ts` and
      `src/ui/elements/mx-practice-help.ts` stay non-focus-stealing overlays (FR-011; makes T062 pass).

**Checkpoint**: US1 to US3 work independently; the window during a run is the Score plus one slim bar.

---

## Phase 6: User Story 4 - Overlays never hide the music (Priority: P3)

**Goal**: floating chrome never covers the system holding the cursor, notices stay bounded, and every
overlay layer can be switched off.

**Independent Test**: run Listen on a scrolling score and watch the cursor cross the viewport edges -
the current system is never under the bar, a notice or an open popup.

### Tests (write first, confirm they fail)

- [ ] T080 [P] [US4] `tests/e2e/us4-overlays.spec.ts`: over a full Listen run of a 100-measure score,
      sampled at 10 Hz, the bounding box of the system containing the cursor never intersects the bar,
      the notice tray, the piano strip or an open panel (SC-005, FR-010).
- [ ] T081 [P] [US4] `tests/ui/view-panel.test.ts`: `mx-view-panel` renders a switch per overlay layer
      (cursor, marks, advice, piano keys, notices) plus the Score size controls, and each switch writes
      `viewState.setOverlay` immediately (FR-012).
- [ ] T082 [P] [US4] `tests/ui/overlay-layers.test.ts`: switching a layer off stops it being drawn and
      does not stop or alter the run - `src/ui/score/cursor-overlay.ts`, `src/ui/score/grade-marks.ts`,
      `src/ui/score/practice-marks.ts`, `src/ui/elements/mx-piano-keys.ts` and
      `src/ui/elements/mx-notice-tray.ts` each honour their switch (FR-012, FR-015, `data-model.md`
      section 2).
- [ ] T083 [P] [US4] `tests/ui/insets.test.ts`: showing `mx-piano-keys` sets `--mx-inset-bottom` and the
      Score scroll container's `padding-bottom` to the strip's height; hiding it clears both
      (`ui-shell.md` section 1, Insets).
- [ ] T084 [P] [US4] `tests/ui/notice-bounds.test.ts`: the notice tray stacks at most 3 notices, never
      grows beyond its bounded area, and never takes keyboard focus (FR-011, Acceptance 4.2).

### Implementation

- [ ] T085 [P] [US4] `src/ui/elements/mx-view-panel.ts` - the View panel: overlay switches plus the size
      controls (makes T081 pass; depends on T013, T031).
- [ ] T086 [US4] Honour `viewState.overlays` in `src/ui/score/cursor-overlay.ts`,
      `src/ui/score/grade-marks.ts`, `src/ui/score/practice-marks.ts`, `src/ui/elements/mx-piano-keys.ts`
      and `src/ui/elements/mx-notice-tray.ts`; piano keys default to off (makes T082 pass, FR-015).
- [ ] T087 [US4] Declare and consume `--mx-inset-bottom` for the piano strip in
      `src/ui/styles/layout.css` and `src/ui/elements/mx-score-view.ts` so the follow band stays clear
      (makes T083 pass; depends on T027).
- [ ] T088 [US4] Bound the notice tray to 3 stacked notices in the bottom-right corner in
      `src/ui/elements/mx-notice-tray.ts` and `src/ui/styles/layout.css` (makes T084 pass).
- [ ] T089 [US4] Collapse the bar's secondary controls into an overflow menu below the design-minimum
      width instead of wrapping into a second row, in `src/ui/elements/mx-menu.ts` and
      `src/ui/styles/layout.css` (spec edge case "window too small for the slim bar's controls").

**Checkpoint**: all four stories work; the music is never covered.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T100 [P] `tests/e2e/us1-layout.spec.ts`: persistence - the chosen `scale` and the overlay switches
      are restored after a reload (SC-008), and from the fitted size the staves can be made at least
      twice as tall using only bar controls in at most 10 activations (SC-008a).
- [ ] T101 [P] `tests/e2e/us1-layout.spec.ts`: no clipped control and no horizontal page scrollbar at
      1280x720, 1366x768, 1600x900, 1920x1080 and 2560x1440 at 100%, 150% **and** 175% device scale
      factor (SC-006 names 100% and 150%; FR-013 promises the whole 100-175% range, so both are
      asserted).
- [ ] T102 Behaviour neutrality (SC-009, FR-018): run the full `pnpm test` and confirm every core,
      timing, Practice and grading suite passes **unchanged**; grade a stored attempt from
      `tests/fixtures/performances/` before and after and confirm the Grade is identical.
- [ ] T103 [P] Confirm no layer violation was introduced: `tests/architecture/layers.test.ts` green, and
      `git diff --stat main -- src/core` empty (plan: `src/core` is not touched).
- [ ] T104 RT review of contract guarantee **G-4** with `.claude/agents/rt-audio-reviewer.md`: a relayout
      while a run is active does no audio-thread work and posts no worklet message, and no main-thread
      task exceeds 50 ms during a run with a relayout (Constitution I; add the e2e timing assertion to
      `tests/e2e/us1-layout.spec.ts` if it is not already covered).
- [ ] T105 [P] Constitution audit of the branch with `.claude/agents/constitution-auditor.md`; CRITICAL
      findings become tasks here before merge.
- [ ] T106 [P] Update `specs/004-score-first-layout/quickstart.md` and `README.md` only if a command or
      the manual script changed; `docs/agents/reference.md` was already updated in the plan phase.
- [ ] T107 Remove the deprecated `ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_DEFAULT` / `ZOOM_STEP` aliases from
      `src/engine/config.ts` and every remaining reference, so one value never has two names
      (`score-layout.md` section 1; depends on T034, T045).
- [ ] T108 Run the `quickstart.md` manual verification script for all four user stories plus the Score
      size section, in a maximised window on the 1080p laptop screen.
- [ ] T109 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` - all green.
- [ ] T110 Append the checkpoint entry to `specs/004-score-first-layout/implementation-log.md` and
      commit.
- [ ] T111 [P] `tests/e2e/electron-smoke.spec.ts`: in the Electron shell the layout is the same as in the
      browser - the Score view spans the window width, `#mx-bar` is at most 48 px tall, and no aside
      reserves space (spec edge case "Electron and browser Shells"; FR-001). Run it before T109.

---

## Dependencies & Execution Order

- **Phase order**: Setup (T001-T004) -> Foundational (T005-T019) -> US1 (T020-T039) -> US2 (T040-T050)
  -> US3 (T060-T069) -> US4 (T080-T089) -> Polish (T100-T111).
- **The settings rename lands as one unit**: T014 and T015 each fix the test files their change breaks
  (`tests/fakes/memory-settings-store.ts`, `tests/engine/storage/local-settings-store.test.ts`), so the
  tree typechecks and passes after every task; T034 then removes the last `zoomPercent` in `src/`, and
  T038 the last one in `tests/`.
- **T001 gates the whole Score-layout path**: the measured Verovio unit relation can correct
  `score-layout.md` (T002), which T011 and T028-T030 then implement. Do not start T011 before T001/T002.
- **T003 before T011 and T013**; **T014 before T015**; **T013 before T017, T018, T031, T032, T046, T048,
  T065, T085**.
- **US2 needs US1's host**: T045 and T047 depend on T026 (the rewritten `mx-app`) and on T034.
- **US3 needs the panel host**: T067 and T068 depend on T045.
- **US4 is polish on top**: T087 depends on T027; T086 depends on T013.
- **T107 comes last among implementation tasks** - it removes the aliases every earlier task may still
  use.
- Within each story: tests -> UI implementation -> existing-test updates (Constitution IV).

## Parallel Opportunities

- **Setup**: T003 and T004 together (different files), while T001 runs.
- **Foundational tests**: T005, T006, T007, T008, T009, T010 - six independent test files, all writable
  at once.
- **Foundational implementation**: T012, T016 and T019 are independent of each other; T011/T013 and
  T014/T015 form two short chains that can run side by side.
- **US1 tests**: T020-T025 are six independent files.
- **US1 implementation**: T031 is independent of the `mx-app` / `mx-score-view` chain (T026 -> T027,
  T028 -> T029); T030 touches only the worker.
- **US2 tests**: T040-T044 together.
- **US3 tests**: T060 and T063 are unit files independent of T061/T062/T064, which share one e2e file
  and therefore run one at a time.
- **US4 tests**: T080-T084 together. **US4 implementation**: T085 is independent of T086-T088.
- **Polish**: T100, T101, T103, T105, T106, T111 in parallel; T102, T104, T107-T110 are sequential
  (T111 must be green before T109).

## Summary

| Phase | Tasks | Count |
|---|---|---|
| Setup | T001-T004 | 4 |
| Foundational | T005-T019 | 15 |
| US1 (P1) | T020-T039 | 20 |
| US2 (P2) | T040-T050 | 11 |
| US3 (P2) | T060-T069 | 10 |
| US4 (P3) | T080-T089 | 10 |
| Polish | T100-T111 | 12 |
| **Total** | | **82** |

**Suggested MVP**: Setup + Foundational + **US1 only** (39 tasks). US1 alone delivers the whole point of
the feature - the Score owning the window at a readable size - and is independently testable. US2 is
what keeps it that way over time, so it is the natural second increment.

**Next step**: `/speckit.implement` from T001 (analyze done 2026-09-21; its edits applied the same day).
