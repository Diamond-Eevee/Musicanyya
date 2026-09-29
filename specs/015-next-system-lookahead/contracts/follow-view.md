# Contract: Follow view (look-ahead target and glide)

**Version**: `1.4.0` (1.4.0, 2026-09-29, T044 after FR-009 measured 897.7 ms: section 3 rule 2 keeps a glide on the
frame it ends, section 4 renders only the pages a glide lands on and reads reduced motion from one MediaQueryList, F-4 names what a
frame reads; 1.3.0, 2026-09-29, T042: section 4 documents the e2e seam `data-follow-settled`, additive;
1.2.0, 2026-09-29, owner decision after T028 measured SC-007: the top gap of rule 3 yields when it
alone keeps two systems from fitting, and section 4 documents `data-gliding`; 1.1.0, 2026-09-28 after analyze A1: a redirect keeps the running glide's end time, new
constant `FOLLOW_GLIDE_MIN_REDIRECT_MS`; 1.0.0 was the first version). Replaces the follow rule "keep the cursor's measure in the middle 60 % and jump to centre
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
3. Otherwise `target = clamp(current.top - gap, 0, maxScrollTop)`, where `span = next.bottom - current.top` and
   `gap = min(LOOKAHEAD_TOP_GAP_PX, clearHeight - span)` when `next !== null && span <= clearHeight` (the two fit only
   with less space above them: the gap shrinks just enough, down to 0), else `gap = LOOKAHEAD_TOP_GAP_PX`. *(1.2.0:
   before, the gap was always `LOOKAHEAD_TOP_GAP_PX`, so a pair up to 12 px shorter than the clear space did not fit.)*
4. Return `null` when `|target - scrollTop| < FOLLOW_TARGET_EPSILON_PX`, else `target`.

Boxes are the `g.system` elements' bounding boxes. Text in the music font is measured with the line metrics that
`score-layout.md` 2.1.0 section 5 gives it, so a tempo mark or a text dynamic adds its ink, not the font's much taller
line box, to its system.

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
   current position, `easing: 'out'` (cubic), `startMs: nowMs`, and `durationMs = max(active.startMs +
   active.durationMs - nowMs, FOLLOW_GLIDE_MIN_REDIRECT_MS)` - the redirected glide keeps the running glide's end time,
   and only when less than the minimum is left does it end up to `FOLLOW_GLIDE_MIN_REDIRECT_MS` later. A target within
   the epsilon of the glide's `to` keeps that glide unchanged, also when it is done (the frame it ends, before it is
   dropped): it then lands exactly on its `to`. *(1.4.0: before, a done glide counted as none, so on the frame a long
   glide ended - the view still a few px short of its `to`, e.g. 2 px after 8400 px - a fresh glide started over those
   px and held the arrival back by `FOLLOW_GLIDE_MS`.)*
3. `reducedMotion` true: `durationMs: FOLLOW_GLIDE_REDUCED_MS`.
4. Positions never overshoot: every `top` lies between `from` and `to`, and is monotonic in time.
5. Duration does not depend on distance (FR-009). A redirect at time `t` ends the movement at
   `max(original end, t + FOLLOW_GLIDE_MIN_REDIRECT_MS)`: redirects in the first 150 ms of a glide (such as the exact
   target arriving once a page has rendered) never make it end later than `FOLLOW_GLIDE_MS` after it started.

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

While a glide runs, `mountVisiblePages()` renders only the pages within one screen of `glide.to`, the one holding it
first, and unmounts nothing; once the glide ends it returns to the pages within one screen of the view and unmounts the
rest (research R-7). A page's render is asked for once per layout (no second request while one is in flight), and a
render asked for before a load or relayout is dropped. When the measure's page is not mounted and the view already
rests at that page's estimated top, no glide starts (none in place while the page renders). *(1.4.0: before, the pages
under the moving view were rendered too, each frame asked again for pages in flight, and the landing page waited
behind them in the worker.)* Also while a glide runs,
`<mx-score-view>` carries `data-gliding="true"`, removed when the glide ends or is cancelled (1.2.0: documented; the
e2e checks use it to tell a glide from a settled view, `tests/e2e/us4-overlays.spec.ts`).
In a following frame (step 3), `<mx-score-view>` also carries `data-follow-settled="true"` when `lookaheadTarget`
returns `null` and no glide runs after step 4: the view rests where the look-ahead rule wants it. Every other following
frame (a target, a running glide, the measure's page not mounted, no measure) removes it, and so does the end or
cancellation of a glide, and so does every frame that does not follow (it drops the glide: Follow off, Listen paused
or stopped, a Practice session finished). *(1.3.0: added for the e2e checks that measure
the page during a run, `waitForStillScore` in `tests/e2e/helpers/pressed-keys.ts`; unit test
`tests/ui/score-view-follow.test.ts` "data-follow-settled is set only while the view rests ...".)*
Reduced motion is read when a glide starts, from one `MediaQueryList` for `(prefers-reduced-motion: reduce)` made the
first time it is needed (it follows a change of the setting); never a `matchMedia` call per frame (1.4.0, audit L1).

## 5. Constants (`src/engine/config.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `FOLLOW_GLIDE_MS` | 400 | duration of every follow glide, fresh or redirected (FR-007, FR-009; SC-002 needs ≤ 600) |
| `FOLLOW_GLIDE_MIN_REDIRECT_MS` | 250 | shortest duration of a redirected glide, so a late redirect never snaps (FR-010; its largest 60 Hz step is 20 % of its distance) |
| `FOLLOW_GLIDE_REDUCED_MS` | 0 | duration when the OS asks for reduced motion (FR-011) |
| `LOOKAHEAD_TOP_GAP_PX` | 12 | clear space left above the current system's box at the target; less (down to 0) when only that keeps the next system from fitting (rule 3) |
| `FOLLOW_TARGET_EPSILON_PX` | 1 | positions closer than this count as equal (no move, no redirect) |
| `FOLLOW_MARGIN` | 0.2 | unchanged; now used only to reveal a Grade mark (009 FR-023) |

## 6. Guarantees

- **F-1**: Following never changes sound, cursor time, Practice waiting or grading (spec FR-013); the follow code
  reads positions and writes only `scrollTop`.
- **F-2**: No follow movement is a single-frame cut unless reduced motion is on.
- **F-3**: A fresh glide moves the music by at most 12.5 % of its distance per 60 Hz frame, a redirected one by at
  most 20 % of its (remaining) distance (SC-003).
- **F-4**: The per-frame follow work reads three boxes (the scroller and the current and next `g.system`) and the
  scroller's sizes, and does arithmetic; its only DOM write is `scrollTop` (and the `data-*` seams of section 4).
  During a glide it may ask for a page render (section 4); the page is put in the stack when the render arrives, not
  in the frame. *(1.4.0, audit L2: the text said "two element box reads" and left out the page renders.)*
