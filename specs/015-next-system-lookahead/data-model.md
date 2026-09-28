# Data Model: See the Next System While Playing

**Feature**: `015-next-system-lookahead` | **Date**: 2026-09-28

No persisted data changes: no IndexedDB store, no `localStorage` key, no settings field, no Score model field. Every
entity below lives in the UI layer for the lifetime of one layout and is recomputed from the rendered Score. The Score
model, Note IDs, timeline, schedules, Performance logs and Grades are untouched (spec FR-013).

---

## 1. Entities

### System (rendered)

One line of engraved music: a `g.system` element of a mounted page.

| Field | Type | Source / rule |
|---|---|---|
| element | `Element` | `measureEl.closest('g.system')` for the cursor's measure; the following `g.system` in document order, else the first `g.system` of the next page |
| box | `Span` (`top`, `bottom`, content px) | element `getBoundingClientRect()` + `scrollTop - scrollEl.getBoundingClientRect().top` |
| page | number | the `data-page` of the enclosing page element |

Validation: `bottom > top`. A system whose page is not mounted has no box ("unknown", `nextKnown: false`). There is
no next system after the last `g.system` of the last page ("absent", `next: null, nextKnown: true`).

### Clear space

The part of the Score view the musician can read: `[scrollTop, scrollTop + clientHeight - insetState.bottom]`.
The slim bar does not overlap the Score view (004 FR-001); the notice tray is a bounded corner overlay and is not
subtracted (004 FR-011). Source of the bottom inset: `insetState` (004 `ui-shell.md`, Insets), unchanged.

### LookaheadInput / target

As in `contracts/follow-view.md` section 1: `current`, `next`, `nextKnown`, `scrollTop`, `clearHeight`,
`maxScrollTop` -> `number | null`. Pure; built once per frame while following.

### Glide

`from`, `to`, `startMs`, `durationMs`, `easing` (`'inOut' | 'out'`), per `contracts/follow-view.md` section 3. At
most one exists, held by `mx-score-view`.

### Page layout (changed)

| Field | Type | Rule |
|---|---|---|
| page | number (1-based) | unchanged |
| top | number (CSS px) | `startOffset` (title block height) + the heights of all earlier pages |
| height | number (CSS px) | measured (own `viewBox` aspect x page width) or estimated (mean of measured, else the requested height) |
| measured | boolean | new: true once the page has been rendered in this layout epoch; never goes back to false before the next relayout |

Kept per layout epoch: `measuredHeights: Map<page, number>` (cleared on `load` and `relayout`, **not** on unmount).

---

## 2. State machine: follow glide

```text
            target (not null, not ≈ position)
   Idle ─────────────────────────────────────▶ Gliding(inOut)
    ▲                                            │  │
    │ done (now ≥ start + duration)              │  │ new target, |to' - to| ≥ ε
    │ user scroll (cancel)                       │  ▼
    │ Follow off / run ends (cancel)             │ Gliding(out)  ◀── new target again (redirect again)
    └────────────────────────────────────────────┘  │
    ▲                                               │ done / user scroll / Follow off / run ends
    └───────────────────────────────────────────────┘

 Any state: a page height corrected above the viewport -> shiftGlide(Δ) (state unchanged)
 Reduced motion: durationMs = 0, so Gliding lasts zero frames (the first step lands on `to`)
```

- A redirect keeps the running glide's end time (at least `FOLLOW_GLIDE_MIN_REDIRECT_MS` from the redirect).
- Entering Gliding writes `scrollTop` on the same frame (step 4 of `follow-view.md` section 4), never later.
- "Follow off" is today's `transportState.follow === false` (manual scroll or the Follow checkbox); "run ends" is
  Listen leaving `playing`, a Practice session finishing, a Play run ending. The view then stays where it is.

---

## 3. Named constants (added to `src/engine/config.ts`)

| Constant | Value | Unit | Used by | Requirement |
|---|---|---|---|---|
| `FOLLOW_GLIDE_MS` | 400 | ms | `glideTo` | FR-007, FR-009, SC-002 |
| `FOLLOW_GLIDE_MIN_REDIRECT_MS` | 250 | ms | `glideTo` (redirect) | FR-009, FR-010 |
| `FOLLOW_GLIDE_REDUCED_MS` | 0 | ms | `glideTo` | FR-011 |
| `LOOKAHEAD_TOP_GAP_PX` | 12 | CSS px | `lookaheadTarget` | FR-001, FR-014 |
| `FOLLOW_TARGET_EPSILON_PX` | 1 | CSS px | `lookaheadTarget`, `glideTo` | FR-002 (no move, no oscillation) |
| `ENGRAVING_PAGE_MARGIN_TOP` | 18 | Verovio page units | Verovio worker | FR-003 |
| `ENGRAVING_PAGE_MARGIN_BOTTOM` | 18 | Verovio page units | Verovio worker | FR-003 |
| `ENGRAVING_SPACING_BRACE_GROUP` | 8 | MEI half staff spaces | Verovio worker | FR-016 |

Unchanged and still in use: `FOLLOW_MARGIN` (0.2, Grade-mark reveal only), `RELAYOUT_DEBOUNCE_MS`,
`SCORE_SCALE_*`, `MIN_PAGE_UNITS`, `MAX_PAGE_UNITS`.
