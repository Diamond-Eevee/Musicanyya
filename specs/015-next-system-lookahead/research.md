# Research: See the Next System While Playing

**Feature**: `015-next-system-lookahead` | **Date**: 2026-09-28 | **Plan**: [plan.md](plan.md)

All measurements below were taken on 2026-09-28 with `verovio 6.3.0` (the pinned version), the worker's option set
(`breaks: 'auto'`, `font: 'Leipzig'`, `header`/`footer: 'none'`, `svgViewBox: 1`, `scale: 100`), rendered SVG
measured in Chromium (`getBoundingClientRect` of `g.system` / `g.staff`) and, for the app itself, with
`pnpm screenshot --item repertoire/advanced/fur-elise-complete --width 1920 --height 950 --piano`. The spike scripts
lived in the session scratchpad, not in the repository; the tasks turn the facts that matter into pinned tests.

---

## R-1. Why the next system is missing today (baseline)

**Finding**:

1. Each Verovio page is exactly one screenful (004 `score-layout.md` 1.1.1, section 2 rule 4: `adjustPageHeight: 0`,
   `pageHeight` = viewport height). Verovio fills a page with as many whole systems as fit and leaves the rest blank.
   At 1920 x 1000 the first two pages of Für Elise (complete) hold **one** system each, followed by ~460 px of blank;
   other pages hold two systems and 100-200 px of blank. In the screenshot of the real app at 1920 x 950 with the
   piano strip, exactly one system is visible and the rest of the clear space is empty.
2. Follow (`followScrollTo`) moves only when the cursor's **measure** leaves the middle 60 % of the usable viewport
   (`FOLLOW_MARGIN = 0.2`), and then jumps in one frame so that the measure is centred. It never looks at the next
   system.
3. Piano systems (bounding box of `g.system`, which includes tempo marks, dynamics and pedal marks) at the default
   size are 305-463 px tall across the library's 16 piano pieces; a 1080p browser window with the piano strip shown
   leaves ~700 px of clear space (window 950 px high minus the 48 px slim bar and the ~200 px strip).

| Clear space | Library piano pieces where two consecutive systems fit (default spacing) |
|---|---|
| 710 px (1080p browser, piano strip shown) | 3 of 64 system changes in total (Clementi 2/8, Twinkle 1/2); 0 for Für Elise, Bach, Burgmüller, Mary |
| 900 px (1080p, strip hidden) | 48 of 64 (Für Elise 9/15, Bach 11/11, Clementi 8/8, Chopin op. 28 no. 20 0/2) |

**Consequence**: the spec's first SC-001 ("100 % at 1080p with the strip") was impossible; the owner chose the
fit-aware wording and compact spacing (spec amendments of 2026-09-28, R-4).

---

## R-2. Closing the blank space at the end of a page (FR-003)

**Decision**: render every page cropped to its content - Verovio `adjustPageHeight: 1` - with the page's top and
bottom margins reduced to `ENGRAVING_PAGE_MARGIN_TOP = 18` and `ENGRAVING_PAGE_MARGIN_BOTTOM = 18` (Verovio page
units; default 50). `pageHeight` stays the viewport height (it still decides how many systems go into one page, which
is now only the unit of lazy mounting, not a visual page). Each page element takes its height from **its own**
rendered `viewBox` (width x its own aspect), instead of every page sharing the first page's aspect.

**Measured result** (1920 px wide):

| Score | Gap between system boxes inside a page | Gap across a page break |
|---|---|---|
| Für Elise (complete), default margins | 33-63 px | 97-126 px |
| Für Elise (complete), margins 18/18 | 33-63 px | 33-62 px |
| Clementi op. 36 no. 1, margins 18/18 + compact spacing | 45-91 px | 53-68 px |

With 18/18 the page-break gap falls inside the range of ordinary in-page gaps, so a page break looks like any other
system break (FR-003, contract G-5). With margins 0/0 the gap drops to -1..3 px: boxes touch and content above the
first system (tempo marks) is clipped at the page's top edge - rejected. 18 is the smallest value measured whose gap
matched the in-page gap; it is a named constant.

**Rationale**: Verovio does the cropping itself, so the height of each page is known the moment its SVG arrives (from
the `viewBox` the sanitiser already reads) - no DOM measurement, no extra worker round trip, testable in Node.

**Alternatives considered**:

- *Crop in the main thread* (measure the last system's box after mounting, shrink the page element): needs layout
  reads after every mount and duplicates what Verovio already offers. Rejected.
- *One tall page* (`pageHeight` = the whole Score): no page breaks at all, but one SVG per Score (1-2 MB for Für
  Elise, more for 500 measures) mounted at once breaks the 50 ms main-thread budget (Constitution I) that lazy page
  mounting exists for. Rejected.
- *CSS gap between pages with 0 margins*: clips content above the first system (measured), and the right gap depends
  on the content anyway. Rejected.
- *Ask the worker for every page's height up front* (render all pages once): blocks the single Verovio worker for
  seconds on long Scores, delaying the pages the musician is looking at. Kept as a fallback only if R-3's estimates
  prove visibly jumpy on the real library (not expected: see R-3).

**Consequence**: page heights now differ from page to page and are known only after a page is rendered (R-3). The
004 contract rule "one page = one screenful" is replaced; `contracts/score-layout.md` 2.0.0 records the new rules.

---

## R-3. Heights of pages that are not rendered yet

**Decision**: `layoutPages()` takes one height per page. A rendered page contributes its **measured** height (kept
for the whole layout epoch, also after it is unmounted, so a page never changes height twice). An unrendered page
gets an **estimate**: the mean measured height of the pages rendered so far in this epoch, or the requested
`pageHeight` (in CSS px) before any page is rendered. When a page's height changes from estimate to measurement by
Δ px and the page lies wholly above the current scroll position (its old bottom ≤ `scrollTop`), the view compensates:
`scrollTop += Δ`, and a running glide shifts its start and end by Δ (R-6), so nothing on screen moves.

**Rationale**: pages are mounted within one screen above and below the viewport (existing `mountedPageNumbers`), so
changes almost always happen off screen; compensation handles the pages above; pages below only move content that
is not visible. The mean converges after two or three pages; page heights within a Score vary by less than one
system.

**Alternatives considered**: CSS scroll anchoring (`overflow-anchor`) does the compensation natively in Chrome and
Firefox but not in Safari, and it cannot shift our glide; explicit compensation is deterministic and unit-testable.

---

## R-4. Compact vertical spacing (FR-016, owner decision 2026-09-28)

**Decision**: Verovio `spacingBraceGroup: 8` (named `ENGRAVING_SPACING_BRACE_GROUP`; default 12). `spacingStaff`
(between staves of different parts) and `spacingSystem` stay at their defaults.

**Facts**:

- Units are MEI half-spaces: the default 12 gives a minimum gap of 6 staff spaces (108 px at 100 %) between the
  treble and bass staff of a grand staff; 8 gives 4 spaces (72 px). Verovio still widens the gap where content needs
  it (e.g. 4.6 spaces in Für Elise m. 3-4).
- `getAvailableOptions()` of 6.3.0 lists `spacingBraceGroup` ("Minimum space between staves inside a braced group",
  default 12, 0-48). On all library piano pieces it gives the same system heights as `spacingStaff: 8`, while voice
  + piano and multi-instrument Scores keep their part separation.

| At ~697 px clear, default size | Default | Compact |
|---|---|---|
| Clementi op. 36 no. 1 | 0/8 | 8/8 |
| Mary Had a Little Lamb | 0/1 | 1/1 |
| Bach BWV 846 | 0/11 | 4/11 |
| Für Elise (complete) | 0/15 | 1/15 (its height is mostly the pedal row and voltas, not the staff gap) |

**Notation review** (music-domain-expert, 2026-09-28, compact renders of Clementi and Für Elise): no collisions
(*pp* between the staves, ledger-line notes, a clef change with slur, low bass beams all clear); 4 spaces is the
tight end of printed practice (condensed Peters/Schirmer layouts; Henle usually 5-7 in sparse music) and acceptable
because Verovio widens it by content; 9 or 10 would lose most of the gain without helping dense Scores. Limit it to
braced groups (adopted: `spacingBraceGroup` instead of `spacingStaff`). Keep `spacingSystem` so systems stay clearly
further apart than the staves of one system. Asked for one more fixture with hairpins, dynamics and a cross-staff
beam between the staves (a task). Noted separately: the "Ped." row sits nearly as close to the next system as to its
own - an existing Verovio placement, out of scope (spec Out of Scope).

**Alternatives considered**: `spacingStaff: 8` (also moves parts closer together - rejected by the review); 9 or 10
(too little gain); shrinking the Score during runs (rejected by the owner, FR-015).

---

**Review of the implemented spacing (T030, 2026-09-29, music-domain-expert, two parts)**: all 16 library piano pieces,
the T025 fixture, voice-and-piano and the 13 `tests/fixtures/musicxml/real` files with a piano, first screens plus every
library page, and a default-vs-compact pre-screen of element boxes. Library: no ink contact; in Bach BWV 846 m. 1/4
(beats 2 and 4) and Clementi op. 36 no. 1 m. 20 a RH beam ends 0.28 staff space above a LH note (default 1.0-1.25) -
0.28 space (51 inner units) is the clearance Verovio leaves wherever content forces the staves apart, so values 9 or
10 would not change these systems; 11 would. Owner decision 2026-09-29: keep 8 and word SC-008 as "no ink contact and
nothing closer than Verovio's own 0.28-space floor" (spec amended). **Known limits** (Verovio 6.3.0 places these
elements after fixing the staff gap, and no option changes that): `bridge-dweller-in-my-deathless-dreams` m. 65 (a
cross-staff beam starts inside a ledger-line notehead of the other voice; still at 10), `wolf-auf-einer-wanderung`
m. 77 (a "cresc." extender dash on a slur; clear at 10) and m. 33 ("molto cresc." dashes 0.3 space above beams),
`mendelssohn-duet-op63-1` m. 33 (an *sf* beside the RH ledger lines). Measured cost of a larger value: each step adds
9 CSS px per grand staff at the default size.

## R-5. Which system is "current" and "next", and when to move (FR-001, FR-002, FR-014)

**Decision**: a **system** is Verovio's `g.system` element; its box is the element's bounding box (all its staves plus
tempo marks, dynamics, pedal marks - everything a musician reads with the line). The cursor's system is
`measureEl.closest('g.system')` of the measure the mode already follows (Listen: the sounding pass, Practice: the
current event's measure, Play: `playCursorAt`'s measure) - verified: every `g.measure` of a Verovio page is a
descendant of a `g.system`. The next system is the following `g.system` in the same page, else the first one of the
next page; it is *unknown* when that page is not mounted, and absent after the last system of the Score.

The move rule is one pure function (`contracts/follow-view.md`):

1. The clear space is `[scrollTop, scrollTop + clientHeight - insetBottom]` (the slim bar does not overlap the Score
   view; notices stay in their corner and are ignored, 004 FR-011).
2. **No move** when the current system is fully in the clear space and the next one is too (or there is none).
3. Otherwise the target puts the current system's top `LOOKAHEAD_TOP_GAP_PX` (12) below the top of the clear space,
   clamped to the scroll range. This one rule gives: the next system below it when both fit (FR-001); the top of the
   next system in the rest of the space when they do not (FR-014); the top of an over-tall system with the cursor bar
   through it (FR-014); no scrolling past the end at the last system (FR-004, clamp).
   *(Amended 2026-09-29, owner decision, follow-view 1.2.0: the gap shrinks - down to 0 - when it alone keeps the
   next system from fitting. Measured in T028: Clementi at 1920 x 950 with the strip has a pair of 689 px in 697 px of
   clear space, which the fixed 12 px gap pushed 4 px under the piano strip.)*
4. A target within `FOLLOW_TARGET_EPSILON_PX` (1) of the current position is no move (the not-fit case settles at
   its target and stays there - no oscillation).

**Rationale**: stateless, deterministic, testable without a browser; the system-top anchor never needs the next
system's size, so an unknown next system simply means "move the current one to the top", which is also right when
its page has not rendered yet.

**Alternatives considered**: centring (today's rule - never looks ahead); keeping the previous system partly visible
(needs more room than a laptop has, and the spec's owner decision puts the current line at the top); moving by
measure rather than by system (moves in the middle of a line - rejected by the owner).

---

## R-6. Fluent movement (FR-007 - FR-013)

**Decision**: our own glide in the existing `requestAnimationFrame` loop of `mx-score-view` (the loop that already
draws the cursor and follows), writing `scrollTop` through `scrollOwn()`:

- A fresh glide eases in and out (cubic) over `FOLLOW_GLIDE_MS` (400 ms), whatever the distance (FR-009).
- A new target during a glide (fast system change, a jump, a page's height corrected) redirects from the current
  position with an ease-out curve that keeps the running glide's end time, never shorter than
  `FOLLOW_GLIDE_MIN_REDIRECT_MS` (250 ms): it starts at speed instead of stopping first (FR-010), and a jump to a page
  that renders only during the glide still arrives when the first glide would have (FR-009). *(Changed after analyze
  A1, 2026-09-28: the first design restarted a full 400 ms on every redirect, so a jump to an unmounted page - estimate
  first, exact system after the page rendered - took up to ~800 ms.)*
- `prefers-reduced-motion: reduce` (read with `matchMedia` when a glide starts) sets the duration to
  `FOLLOW_GLIDE_REDUCED_MS` (0: instant) (FR-011).
- A user scroll (detected by the existing `noticeUserScroll`, which runs first in every frame) cancels the glide at
  once (FR-012), and during a run switches Follow off exactly as today.
- Frame order: position -> cursor's system -> target -> glide step (write `scrollTop`) -> draw the cursor, Practice
  marks and Play marks. Drawing after the scroll keeps the canvas overlay in step with the moving music; today the
  overlay is drawn first, which would lag one frame behind a glide.
- The glide's position is kept as a number in the glide state, not read back from `scrollTop` (which browsers round
  to device pixels), so rounding never accumulates.

**SC-003 check**: the largest per-frame step of a cubic ease over 400 ms at 60 Hz is `3 x 16.7/400 = 12.5 %` of the
distance. A system-to-system move is at most about one clear-space height, so at most ~12.5 % of the viewport per
frame, under the 1/6 limit. A redirect over at least 250 ms moves at most `3 x 16.7/250 = 20 %` of its remaining
distance per frame; a fast system change leaves at most about half a viewport to go, so about 10 % of the viewport.
(At 30 Hz the fresh case would be 25 %; SC-004 requires 60 Hz.)

**Alternatives considered**: `scrollTo({ behavior: 'smooth' })` / CSS `scroll-behavior: smooth` - the duration is
browser-defined and distance-dependent (no named setting, FR-007/FR-009 unverifiable), and the `scroll` events it
fires are indistinguishable from the musician's own scrolling, which would switch Follow off on every glide.
Rejected. A spring (critically damped) would give continuous velocity on redirect, but its settle time depends on
distance and needs tuning; the two-curve rule is simpler and bounded.

**Web API facts**: `matchMedia('(prefers-reduced-motion: reduce)')` - Chrome 74, Edge 79, Firefox 63, Safari 10.1;
Playwright emulates it (`reducedMotion: 'reduce'`), so the e2e test can check FR-011.

---

## R-7. Pages along a long glide

**Decision**: while a glide runs, `mountVisiblePages()` mounts the pages around the glide's **target** position and
keeps the ones around its start, so the destination is ready when the glide arrives; pages only flown over are
not mounted (they pass as blank placeholders for a few frames). When the cursor's measure has no mounted page, the
target is the estimated top of its page (existing `scrollToPageOf`, now gliding), and the next frame after the page
mounts redirects to the exact system (R-6).

**Rationale**: a distant jump (repeat, D.C., Follow after scrolling away) crosses at most a few pages in 400 ms;
rendering every page on the way would queue work in the single Verovio worker and delay the one that matters.

*(Amended 2026-09-29, T044, follow-view 1.4.0.)* The first implementation did not hold to this: the pages around the
**moving** view were mounted on every frame (the glide's frames and the `scroll` events it causes), with no guard
against asking for a page already in flight. A probe on `large-score.musicxml` (Chromium, 1920 x 1080, jump from
page 1 to page 13 during Listen) showed page 13 asked for 5 times, pages 4-10 rendered on the way, frames of 46-118 ms,
the landing page mounted after the glide's planned end (so the exact-system redirect took the 250 ms minimum), and
then a fresh 400 ms glide over the last 2 px (the done glide counted as none): 605 ms from the click; T019 (c) had
measured 897.7 ms. **Decision**: while a glide runs, only the pages within one screen of `glide.to` are rendered,
nearest first, and nothing is unmounted until it ends; a page is asked for once per layout (`pageEpoch`); no glide
in place while the landing page renders; `glideTo` keeps a done glide whose `to` is the target. Measured after:
332-373 ms from the click to arrival for a jump 24+ pages away at 1280 x 720 (5 runs), 382-383 ms two pages back.
**Alternatives**: start the glide only once the page has rendered (the render time adds to every jump); a longer
`FOLLOW_GLIDE_MS` for distant jumps (FR-009 wants the same bound however far).

---

## R-8. Verification strategy

- **Pure unit tests (Node / happy-dom, test-first)**: `lookaheadTarget` (every rule and edge: fits, does not fit,
  over-tall, last system, unknown next, epsilon, clamp); glide curves (start, end, monotonic, no overshoot, per-frame
  bound, redirect continuity of position, reduced motion, shift by Δ); `layoutPages` with per-page heights, estimates
  and the compensation rule.
- **Verovio pins (Node)**: with the worker's options, a page's `viewBox` height is its content height plus margins
  (not `pageHeight`); `spacingBraceGroup` 8 gives a minimum grand-staff gap of 4 staff spaces (720 inner units)
  and leaves a two-part (voice + piano) gap unchanged.
- **e2e (Playwright, Chromium)**: a Listen run through Clementi (fits) and Für Elise (does not fit), sampling at
  every system change whether both systems are in clear space (SC-001 a/b, SC-007); per-frame `scrollTop` deltas
  during the run (SC-003) and frame rate (existing `play-frame-rate.spec.ts` pattern, SC-004); reduced motion
  (FR-011); a wheel scroll during a glide (FR-012); page-break gaps and "no system clipped by its page" over every
  library piano piece (FR-003, G-5, G-6).
- **Manual**: owner hand test (SC-006) and the notation review of all library piano pieces (SC-008), both from
  `quickstart.md`.

---

## R-9. Boxes of music-font text (FR-001, SC-007; owner decision 2026-09-29)

**Finding** (T028): at 1920 x 950 with the piano strip, *Mary Had a Little Lamb*'s first system measured 380 px although
its staves are 4 spaces apart. Its tempo mark "Moderato ♩ = 96" is SVG `<text>`; the note is a `<tspan>` in Leipzig,
the SMuFL font Verovio embeds with `@font-face` in each page. Chromium sizes SVG text boxes by the font's line metrics,
about 1.83 em above and 1.14 em below the baseline for Leipzig (2.97 em in total: 214 px at the 72 px the glyphs are
set in), so the box reached 83 px above the ink (text dynamics such as "più *f*": 100 px). The system box, and the
look-ahead with it, followed the box: 90 px of white above the tempo mark, and two systems that fit by ink (661 px of
697) judged as not fitting. Verovio writes metronome notes (U+ECA3/ECA5/ECA7, dot U+ECB7) and dynamics
(U+E520-E539) this way, all at the same size, in the library and the real files.

**Decision**: the page sanitiser adds `ascent-override: 75%; descent-override: 25%; line-gap-override: 0%` to every
`@font-face` rule of a page's `<style>` (`score-layout.md` 2.1.0 section 5; constants `SMUFL_TEXT_ASCENT_PCT`,
`SMUFL_TEXT_DESCENT_PCT`). A box is then one em tall, three quarters above the baseline.

**Measured** (spike in Chromium on library and real pages): the ink of these glyphs reaches at most about 0.68 em above
and 0.21 em below the baseline (metronome note stems; the descender of *f*); with 75/25 every sampled box contains its
ink with 3-22 px to spare (tempo marks 5 px above, 8-9 px below; text dynamics 22 px above, 3 px below); 25 pages of
five Scores rendered with and without the descriptors are pixel-identical (SVG text is placed by `x`/`y`, not by line
boxes).

**Rationale**: fixes the cause (the font's line metrics) in the one place every page passes through, with standard
CSS descriptors (Chrome/Edge 87, Firefox 89), no DOM measurement per frame and no change to the engraving.

**Alternatives considered**: a system box built from the boxes of its children minus text (hides the stem of a
metronome note, which then slides under the slim bar); `getBBox()` (the same font metrics); glyph boxes from the SMuFL
metadata per character (a font table in our code for a measuring problem); rendering tempo marks without the music
font (changes the engraving). A browser without the descriptors keeps the old boxes: it looks ahead less often, nothing
else changes.
