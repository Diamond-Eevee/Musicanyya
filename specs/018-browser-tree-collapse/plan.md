# Implementation Plan: Collapsible Browser Folder Tree

**Branch**: `018-browser-tree-collapse` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/018-browser-tree-collapse/spec.md`

## Summary

The score browser's folder rail (013) gets a clickable disclosure control on every folder that has sub-folders. It
starts collapsed, and which folders are open is remembered across reloads. The open folders become one more field,
`expanded`, in the view record 013 already saves (`localStorage` `musicanyya.browser.v1`, format version unchanged,
additive). The rail's session-only `collapsed` set moves into `browserState`, so pointer and keyboard change the same
saved state. When the index loads, the path to the chosen folder is opened and the restored selection is scrolled into
view. Opening an item reveals its folder and selects it, for *My files* too. Nothing is loaded on start. The pure
helpers live in `src/core/browser/tree-state.ts`. No new dependency, port or asset.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none added
**Storage**: `localStorage` `musicanyya.browser.v1` (existing key, additive optional field `expanded`); IndexedDB unchanged (version 3)
**Testing**: Vitest (core helpers in Node; browserState and `mx-browser-rail`/`mx-browser-list` in the existing DOM test setup of `tests/ui/score-browser`); Playwright e2e for reload persistence and "selected, not loaded"
**Shells / Delivery Targets**: browser and Electron (same renderer); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari
**Performance Goals**: a toggle re-renders the rail within one frame (<= 16 ms with the full library, about 100 sections); browser appears within 013 SC-002 (300 ms) including the reveal
**Real-time Paths Touched**: none
**Constraints**: core helpers pure (no DOM, no Web API); storage failures never throw or show an error (FR-014); elements stay pure views of `browserState`
**Scale/Scope**: about 100 library sections, at most 3 levels deep; `BROWSER_EXPANDED_MAX` = 512 stored ids

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.* Re-checked after Phase 1: all pass,
unchanged.

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No code on the AudioWorklet, scheduler, MIDI timing or plugin paths | [x] Pass (not touched) |
| II | One Clock | No timing behaviour | [x] Pass (not touched) |
| III | Score Fidelity | No Score, engraving or Note ID change; restore loads no Score (FR-011) | [x] Pass |
| IV | Test-First | Core helpers tested in Node first; store, elements and e2e tests are written before the code; deterministic, no hardware | [x] Pass |
| V | Layered, Framework-Free | Logic in `core/browser/tree-state.ts` (pure); state in `ui/state/browserState.ts`; elements render only; plain custom elements and CSS; browser works alone | [x] Pass |
| VI | Musician-First Feedback | "Contains chosen folder" uses shape (dot, bar width) as well as colour; nothing modal; the chevron shape shows the state | [x] Pass |
| VII | Pedagogy as Data | No Advice involved | [x] Pass (not touched) |
| VIII | Simplicity, Web-First | P1 (toggle + persist) is a usable MVP; no dependency; no speculative port (R-10) | [x] Pass |

## Project Structure

### Documentation (this feature)

```text
specs/018-browser-tree-collapse/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # R-1 .. R-11
|-- data-model.md        # view.expanded, helpers, store transitions, constant
|-- quickstart.md
|-- contracts/
|   |-- browser-view.md       # 013 score-browser 1.1.0 changes + the persisted record
|   `-- contract-changes.md   # edits to 013 and 001 contracts
|-- checklists/requirements.md
`-- tasks.md             # /speckit:tasks
```

### Source Code (repository root)

```text
src/core/defaults.ts                     # + BROWSER_EXPANDED_MAX
src/core/browser/types.ts                # BrowserViewState.expanded
src/core/browser/view-state.ts           # default expanded: [], validateViewState calls validateExpanded
src/core/browser/tree-state.ts           # NEW: validateExpanded, isExpanded, setExpanded, ancestorsOf, revealPath, containsChosen
src/core/browser/query.ts                # export inFolder (logic unchanged)
src/ui/state/browserState.ts             # indexLoaded/indexFailed reveal + revealSelection; openSucceeded rule; selectionRevealed()
src/ui/elements/mx-browser-rail.ts       # toggle span, click split, view.expanded instead of private set, marker, scroll chosen
src/ui/elements/mx-browser-list.ts       # scroll restored selection into view once
src/app/session.ts                       # openFile: browserState.fileOpened(ref) on a successful direct file open
src/ui/styles/browser.css               # chevron, toggle hit area, contains-selected marker, reduced motion
tests/core/browser/tree-state.test.ts    # NEW
tests/core/browser/view-state.test.ts    # expanded validation, 013 payload upgrade
tests/ui/score-browser/rail-tree.test.ts # NEW: pointer toggle, name click, keyboard, marker, persistence calls
tests/ui/score-browser/open-rules.test.ts# openSucceeded selection/folder/reveal, indexLoaded reveal
tests/e2e/score-browser-tree.spec.ts     # NEW: start collapsed, reload persistence, restore not loaded, corrupt storage
specs/013-score-browser-progress/contracts/score-browser.md, data-model.md; specs/001-*/contracts/storage.md
```

**Structure Decision**: Single web project layers as in reference R2. Only core/browser, ui/state, two ui elements,
`src/ui/styles/browser.css` and one call in `src/app/session.ts` change.

## Complexity Tracking

No violations, no additions.

## Phase 0: Research

See [research.md](research.md): R-1 storage (additive field, same key and version), R-2 ownership in `browserState`,
R-3 validation and `formerIds`, R-4 reveal rules, R-5 folder after opening, R-6 disclosure markup and a11y, R-7
marker, R-8 scroll into view, R-9 nothing loads, R-10 no port yet, R-11 tabs.

## Phase 1: Design

- [data-model.md](data-model.md), [contracts/browser-view.md](contracts/browser-view.md),
  [contracts/contract-changes.md](contracts/contract-changes.md), [quickstart.md](quickstart.md).
- `docs/agents/reference.md`: Recent Changes updated; Active Technologies unchanged (nothing new).

## Decisions and open items

- Decided (R-1): an additive `expanded` field in the existing record; the version stays 1, so rollback is safe.
- Decided (R-4, analyze M1): the path to the chosen folder is revealed only on the first successful index load of an
  app run; later loads (reopen, refresh after a reset, retry) keep the musician's collapse.
- Decided (R-5, analyze H1): direct file opens (*Open file...*, drop) select the file through a new
  `browserState.fileOpened(ref)` called from `Session.openFile` (`src/app/session.ts`), also while the browser
  is closed.
- Decided (R-8, analyze M2): a restored selection that no longer exists is cleared silently on index load.
- Decided (R-5, from spec US3 #5): after a successful open, the chosen folder switches to the item's own folder only
  when the current folder cannot list the item.
- Decided (R-10): no `PreferencesStore` port until accounts exist; the record format is the stable unit.
- Superseded 013 text: "Every folder starts expanded ... kept for the session only" (013 contract §1, the comment at
  the top of `mx-browser-rail.ts`). The owner asked for this change in the 018 spec.
- No "needs owner" items.
