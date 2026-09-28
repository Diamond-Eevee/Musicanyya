# Contract: Follow view (look-ahead target and glide)

**Version**: `1.0.0` (new). Replaces the follow rule "keep the cursor's measure in the middle 60 % and jump to centre
it" (001 FR-014, `followScrollTo` with `FOLLOW_MARGIN`) **for runs** (Listen playing, Practice session, Play run).
Revealing a Grade mark after a run (009 FR-023) keeps the old middle-band rule and is not covered here.

**Owner**: `src/ui/score/follow.ts` (pure, no DOM), `src/ui/elements/mx-score-view.ts` (integration),
`src/engine/config.ts` (constants)

---

## 1. Types

All positions are CSS px in the Score view's **content coordinates** (the same axis as `scrollTop`).

```ts
export interface Span { top: number; bottom: number }

export interface LookaheadInput {
  current: Span;              // box of the g.system that holds the cursor's measure
  next: Span | null;          // box of the following g.system in reading order; null when unknown or absent
  nextKnown: boolean;         // false: there is a next system but its page is not mounted
  scrollTop: number;
  clearHeight: number;        // scroll element clientHeight - insetState.bottom
  maxScrollTop: number;       // scrollHeight - clientHeight
}

export type Easing = 'inOut' | 'out';

export interface Glide {
  from: number;
  to: number;
  startMs: number;            // performance.now() time base, same as the rAF loop
  durationMs: number;
  easing: Easing;
}
```

## 2. Target (FR-001, FR-002, FR-004, FR-014)

```ts
/** The scrollTop to move to, or null when the view should stay where it is. Pure and deterministic. */
export function lookaheadTarget(input: LookaheadInput): number | null;
```

1. `inClear(span) := span.top >= scrollTop - FOLLOW_TARGET_EPSILON_PX && span.bottom <= scrollTop + clearHeight + FOLLOW_TARGET_EPSILON_PX`.
2. Return `null` when `inClear(current)` and either `next === null && nextKnown` (the Score's last system) or
   `next !== null && inClear(next)`.
3. Otherwise `target = clamp(current.top - LOOKAHEAD_TOP_GAP_PX, 0, maxScrollTop)`.
4. Return `null` when `|target - scrollTop| < FOLLOW_TARGET_EPSILON_PX`, else `target`.

Consequences the tests pin: when two systems fit, the view stays still until the cursor enters a system whose next
one is not fully visible; when they do not fit, the view settles with the current system at the top and never moves
again inside that system; an unknown next system moves the current one to the top; at the last system the clamp keeps
the view from scrolling past the end; a system taller than the clear space is shown from its top.

## 3. Glide (FR-007 - FR-012)

```ts
/** Starts a glide, or redirects the running one (`active`) from where it is now. Duration 0 means "jump now". */
export function glideTo(position: number, to: number, nowMs: number, active: Glide | null, reducedMotion: boolean): Glide;

/** The position at `nowMs`; `done` once `nowMs >= startMs + durationMs` (position is then exactly `to`). */
export function glidePosition(glide: Glide, nowMs: number): { top: number; done: boolean };

/** Moves a glide's whole path by `delta` (page height compensation, score-layout.md section 3 rule 3). */
export function shiftGlide(glide: Glide, delta: number): Glide;
```

1. Fresh glide (`active` null or done): `easing: 'inOut'` (cubic), `durationMs: FOLLOW_GLIDE_MS`.
2. Redirect (`active` running and `|to - active.to| >= FOLLOW_TARGET_EPSILON_PX`): `from` = the running glide's
   current position, `easing: 'out'` (cubic), `durationMs: FOLLOW_GLIDE_MS`, `startMs: nowMs`. A target within the
   epsilon of the running glide's `to` keeps the running glide unchanged.
3. `reducedMotion` true: `durationMs: FOLLOW_GLIDE_REDUCED_MS`.
4. Positions never overshoot: every `top` lies between `from` and `to`, and is monotonic in time.
5. Duration does not depend on distance (FR-009).

## 4. Frame integration (`mx-score-view`)

Per animation frame, in this order:

1. `noticeUserScroll()` - a scroll the view did not make cancels the glide (FR-012) and, as today, switches Follow off
   during a Listen run.
2. The mode's position and the cursor's measure (unchanged code paths for Listen, Practice, Play).
3. When following (unchanged gating: Follow on; Listen `playing`; a Practice session not finished; a Play run):
   find the measure's `g.system` and the next one, build `LookaheadInput`, call `lookaheadTarget`; a non-null
   target calls `glideTo`. When the measure's page is not mounted, the target is that page's (estimated) top.
4. Advance the glide: `glidePosition(glide, now)` -> `scrollOwn(top)`; drop the glide when `done`.
5. Draw the cursor, Practice band/marks and Play marks (after the scroll, so overlays never lag the music).

While a glide runs, `mountVisiblePages()` also mounts the pages within one screen of `glide.to` (research R-7).
Reduced motion is read from `matchMedia('(prefers-reduced-motion: reduce)')` when a glide starts.

## 5. Constants (`src/engine/config.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `FOLLOW_GLIDE_MS` | 400 | duration of every follow glide, fresh or redirected (FR-007, FR-009; SC-002 needs ≤ 600) |
| `FOLLOW_GLIDE_REDUCED_MS` | 0 | duration when the OS asks for reduced motion (FR-011) |
| `LOOKAHEAD_TOP_GAP_PX` | 12 | clear space left above the current system's box at the target |
| `FOLLOW_TARGET_EPSILON_PX` | 1 | positions closer than this count as equal (no move, no redirect) |
| `FOLLOW_MARGIN` | 0.2 | unchanged; now used only to reveal a Grade mark (009 FR-023) |

## 6. Guarantees

- **F-1**: Following never changes sound, cursor time, Practice waiting or grading (spec FR-013); the follow code
  reads positions and writes only `scrollTop`.
- **F-2**: No follow movement is a single-frame cut unless reduced motion is on.
- **F-3**: A system-to-system glide moves the music by at most 12.5 % of its distance per 60 Hz frame (SC-003).
- **F-4**: The per-frame follow work is two element box reads and arithmetic; no DOM writes other than `scrollTop`.
