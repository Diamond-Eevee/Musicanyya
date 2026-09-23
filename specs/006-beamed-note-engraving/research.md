# Research: Beamed Notes and Complete Engraving

Each item: **Decision / Rationale / Alternatives considered**. Verified facts carry the date and how they were checked.
Beam and accidental rules were reviewed by the `music-domain-expert` role on 2026-09-23 against the W3C MusicXML 4.0
reference (`<beam>`, `<note>` element pages).

## R-1. What Verovio does with missing beams and accidentals (verified)

**Facts** (verovio 6.3.0 from `node_modules`, Node probe, 2026-09-23):

- `fur-elise-theme.musicxml` (no `<beam>`): SVG has 0 `g.beam` and 52 `g.flag`. Verovio does not beam MusicXML
  automatically and has no option to do so.
- `triads-a-minor.musicxml` (G♯ given only as `<alter>1</alter>`): the MEI has 6 `accid.ges`, 0 visible `accid`, so
  the G♯ is printed as G. The same holds for the D natural after D♯ in *Für Elise* bar 1 (no `<accidental>`).
- In the running app (dev server, *Für Elise* opened from the Scores panel): 0 `.beam` elements, flags only;
  no `.pgHead`.

**Decision**: complete the MusicXML (insert `<beam>` and `<accidental>`) before Verovio reads it.
**Rationale**: Verovio draws what is encoded; this is the only lever that also fixes the files for other viewers.
**Alternatives**: post-processing the SVG (fragile, breaks Note ID mapping); converting to MEI and editing
(`getMEI` + reload doubles the load cost of large scores, SC-005); switching engraver (ADR-0001, rejected).

## R-2. Beam rules

**Decision**: implement exactly these rules (`beat-grouping.ts`, `beams.ts`).

- **B1 Time**: rational whole-note time; onsets rebuilt from `<duration>`, `<backup>`, `<forward>`, so a change of
  `<divisions>` mid-piece is harmless. `pos` = position in the metre.
- **B2 Short bars**: the bar length comes from the cursor maximum, never from `implicit`/`number`. The first bar of
  the piece and any short bar with `implicit="yes"` are **end-aligned** (`pos = onset + barLen - actualLen`); other
  short bars are start-aligned. (*Für Elise* pickup E-D♯ = one group.)
- **B3 Groups per metre**:

  | Metre | Groups |
  |---|---|
  | x/4 (2/4, 3/4, 4/4, 5/4, 6/4) | quarter |
  | 2/2, 3/2, `cut` | half |
  | x/8 or x/16 with numerator <= 3 (3/8, 2/8, 3/16) | whole bar |
  | 6/8, 9/8, 12/8 | dotted quarter |
  | 6/16, 9/16, 12/16 | dotted eighth |
  | 5/8 | 3+2 eighths |
  | 7/8 | 2+2+3 eighths |
  | additive `<beats>3+2</beats>` | the given sums in beat-type units |
  | composite (several beats/beat-type pairs) | concatenation |
  | `common` | 4/4 |
  | `senza-misura`, anything else | one group per 1/beat-type |

- **B4 Eighth extensions (owner, 2026-09-23)**: 4/4 - each half bar is one group only if it holds exactly four
  non-rest eighths with no tuplet and no dotted note; otherwise per quarter; never across the middle. 2/2 - a half
  splits into quarters when it contains anything shorter than an eighth - on the metre's quarter boundaries (a short
  first bar counted back from the barline, B2), so a quarter-note pickup stays one group (fixed 2026-09-23: it was
  cut at its midpoint, which split the *Chopin Op. 28 No. 4* pickup's dotted eighth from its sixteenth). 3/4 - the whole bar is one group only for
  exactly six non-rest, non-tuplet eighths.
- **B5 Beamable**: not a rest, not a grace note, type eighth or shorter (type derived from duration and
  time-modification when `<type>` is missing; underivable -> not beamable), wholly inside one group. A chord is one
  event.
- **B6 Forming groups**: per (part, voice) - `<staff>` ignored, so cross-staff beams follow the voice. A group
  ends at a group boundary, barline, rest, `<forward>` or non-beamable note. Rests are never inside a beam. A
  one-note run keeps its flag. (*Für Elise* bar 2: A flag | rest | C-E-A beamed.)
- **B7 Tuplets**: a tuplet span (`<tuplet type="start">`..`stop`, else consecutive notes with the same ratio up to
  `actual-notes`) is its own group; two triplets are never joined.
- **B8 Grace notes**: two or more consecutive grace notes form their own group; a lone one keeps its flag; grace
  notes do not break the surrounding main group (verified with Verovio in a fixture test, fallback: break).
- **B9 Beam values**: beam count b = 1 (eighth) .. 8 (1024th), dots and tuplets do not change it. For each level L,
  note i with b(i) >= L: neighbour on both sides at >= L -> `continue`; left only -> `end`; right only -> `begin`;
  neither (L >= 2) -> hook: first note `forward hook`, last note `backward hook`, middle note `forward hook` if on the
  level L-1 grid else `backward hook`. (Dotted eighth + sixteenth: sixteenth L2 `backward hook`.)
- **B10**: secondary beams are never broken inside a primary group beyond B9 (six sixteenths in 3/8 keep one
  unbroken secondary beam, as in the reference *Für Elise*).
- **B11**: a (part, voice) is beamed only if none of its notes anywhere carries `<beam>` (FR-004, US3 sc. 2) - for
  opened files. A library file must be fully beamed (FR-001), so in library mode a partly beamed voice gets the groups
  whose notes carry no `<beam>`; a note that has one breaks the group like a rest (amended 2026-09-23: the audit
  found the *Chopin Op. 28 No. 4* pickup unbeamed in an otherwise beamed voice).
- **Chords**: beams are written on the chord head (the note without `<chord/>`); a `<beam>` on any chord member
  counts as encoded.
- **B12 Validity of encoded beams** (amended 2026-09-23, pre-merge review): a beam may cross a barline, so runs are
  followed through the whole voice in document order, per `number`: `continue`/`end` with no open run, `begin` while
  one is open, a non-rest note without a level-1 beam inside an open level-1 run (rests may sit under a beam), a
  secondary level still open when level 1 ends, or a run open at the end of the voice make the voice's beam data
  inconsistent (`beamDataInvalid`, reported at the measure where the bad run began). Main, grace and cue notes are
  separate streams; a chord's beams may be written on any member. The first rule ("closes within its own measure")
  flagged 49 warnings on four professionally encoded OpenScore quartets.
- **B13 Sung lines**: a voice that carries lyrics and no `<beam>` anywhere is left as encoded - traditional vocal
  notation flags one note per syllable on purpose and beams only melismas (OpenScore Lieder: Stanford's Soprano and
  Alto, the Chopin song's melody).

**Rationale**: standard engraving practice (Gould, *Behind Bars*) plus the owner's clarifications; every rule is a
pure function of written data, so it is deterministic and golden-testable.
**Alternatives**: beam per beat everywhere (owner rejected for 4/4); beam over rests (non-standard for learners,
contradicts spec scenario 1.2); break secondary beams per beat inside 3/8 (differs from the reference edition).

**Deferred (not in spec)**: 2/4 with four eighths as one bar-long group (many editions do it; off, per the per-quarter
rule). Could become a named option later.

## R-3. Accidental rules

**Decision**:

- **A1 Scope**: per (part, *printed* staff, bar), all voices together, ordered by (pos, grace before main, document
  order). Accidentals belong to the staff where the note is printed.
- **A2 State**: key alteration from the `<key>` in force (a `<key number="n">` for staff n, a key without `number` for
  all staves; `fifths`); bar alteration per (staff, step, **octave**), empty at each barline and reset at a mid-bar
  key change for the staves whose key changed. Expected = bar alteration, else key alteration. Everything before a
  bar's first `<note>`/`<backup>`/`<forward>` - also an `<attributes>` after `<print>` or `<barline
  location="left">`, as MuseScore writes a key change at a system break - and anything back at onset 0 is the bar's
  start; only a later `<attributes>` is mid-bar. A non-traditional key (`<key-step>/<key-alter>`, no `<fifths>`) is
  not modelled: no required sign is added on a staff while it is in force (amended 2026-09-23; reading it as C major
  would mark every note it alters).
- **A3 Ties**: a tie continuation (`<tie type="stop">`, or only `<tied type="stop|continue">`) that prints no sign
  gets none and does not change the bar state; across a barline its alteration is remembered for R-3 C1 only.
- **A4 Required**: a note that prints an `<accidental>` keeps it untouched and sets the bar state - also when it is
  a tie continuation, since the reader sees the sign (amended 2026-09-23) - (a sign that
  contradicts `<alter>` is left as is and reported as `accidentalContradicts`, the FR-006 exception). Otherwise, if alter differs from expected: add sharp / flat / natural /
  double-sharp / flat-flat; double sharp -> sharp prints a plain sharp. Non-integer alter (microtones): skipped.
- **A5**: same pos, same step and octave, different alter (two voices, or F and F♯ in one chord): both get signs.
- **A6 Octave**: state is per octave (FR-007) of the **printed** line: under `<octave-shift>` MusicXML encodes the
  sounding pitch, so the printed octave is the encoded octave minus (size-1)/7 for `type="down"` (8va) and plus it
  for `type="up"` (8vb), per staff and shift `number`, from the start direction to the stop direction (amended
  2026-09-23). Each chord note counts on its own `<staff>`. A `print-object="no"` note is invisible: no sign, no
  state.
- **A7 Grace notes**: ordinary events before their main note; their accidental lasts to the end of the bar.
- **C1 Courtesy memory**: the alterations of each letter (any octave) in the previous bar in document order,
  including tied notes carried over. The first bar of ending 2+ also considers the bar before ending 1.
- **C2 Courtesy**: the first untied note of a letter per staff in a bar gets a plain sign of its own alteration if it
  has none, A4 did not already require one, and the previous bar used a different alteration of that letter.
  Only that one bar (FR-008).
- **C3 Where courtesy applies**: mode `'library'` always; mode `'opened'` only in parts that print no `<accidental>`
  at all (a file that prints accidentals has made its own courtesy choices; FR-009, FR-011). Required signs are
  added in both modes.
- **C4 Form**: `<accidental>natural</accidental>` without `parentheses`, `bracket` or `cautionary` (a fixture test
  checks Verovio draws no parentheses; if `cautionary` is ever added, re-check).

**Rationale**: common-practice rules; per-octave state is what FR-007 asks for; C3 keeps the app from overriding an
editor's deliberate choices in real scores.
**Alternatives**: courtesy signs for other octaves in the same bar (Gould recommends; not asked for; off);
bracketed courtesy (owner chose plain).

## R-4. Title, composer, arranger (verified)

**Facts** (Verovio 6.3.0 probe, 2026-09-23): `header: 'encoded'` draws no header for MusicXML (not even for
`tests/fixtures/musicxml/community/51a-Header-Credits.musicxml`, whose `<credit>` elements are ignored).
`header: 'auto'` draws the work title only; the composer and arranger are in the MEI header
(`persName role="composer"/"arranger"`) but are not drawn.

**Decision**: a **title block** in the score view (UI layer), directly above page 1's first system, scrolling with
the music: title centred (movement title, else work title, else file name), then composer and arranger ("arr. ...")
on one right-aligned line, in the engraving's serif; long titles and the credits line wrap. Compact (owner, R-11):
about 70 px for one title line. Verovio `header: 'none'`. **Title source (amended 2026-09-23)**: in all 18 OpenScore
fixtures that name both, `<movement-title>` is the piece ("Sailing at Dawn", "Aus alten Märchen") and `<work-title>`
the collection ("Songs of the Fleet, Op.117", "Dichterliebe, Op.48"), so the movement title comes first, as a printed
song is headed; the first rule (work title first) would have titled a song by its collection.
**Rationale**: the only way to show composer and arranger with the pinned Verovio; independent of Verovio
versions; supports the file-name fallback; no dependency.
**Alternatives**: `header: 'auto'` (title only - fails FR-017); injecting an MEI `<pgHead>` via `getMEI` + reload
(doubles load time for large scores); upgrading Verovio (not shown to fix it; stack change needs the owner).
**Consequence**: the block adds height before page 1; the feature 004 fit rule sizes pages, not the block, so the
first screenful shows the block plus the top of page 1. Every page position starts below the block's drawn height
(`layoutPages` `startOffset`, measured after the block is drawn, T058), so scrolling, page mounting and the
scroll-back after a relayout stay exact. Covered by the 004 layout e2e tests, unchanged (re-run).

## R-5. Where completion runs

**Decision**: in the score worker, after `readXml` and alongside `buildScore`, on the parse tree; inserts go into the
render copy through `createRenderCopy` (contract 1.1.0). The Score model is built from the untouched source.
**Rationale**: off the main thread (Constitution I); the Score, Note IDs, schedule and Grades cannot change by
construction (FR-005, SC-003 for opened files).
**Alternatives**: in the Verovio worker (would need a second parse); in the Score model (has no rests, types,
tuplets or written alterations).

## R-6. Library: fix the files, not only the display

**Decision**: complete the files on disk: `pnpm library:engrave` for hand-written repertoire items and the exercise
generator for generated ones; the guard test then requires zero inserts. The worker also completes at display time,
but for library files that is a no-op.
**Rationale**: files stay correct for any viewer and for export; the guard test has a single truth; the 005 test "no
notice when opening a library item" keeps passing.
**Alternatives**: display-only completion (files stay wrong elsewhere; guard meaningless).

## R-7. Content hashes change

**Fact**: `contentHash` (SHA-256 of the file) is the Practice/attempt storage key (`session.ts`
`practiceScoreId`), and `index.json` stores `bytes`/`hash` per item.
**Decision**: accept the change; regenerate `index.json`. Stored attempts for a library item made before this
feature stop showing for that item (the app was merged today; no release has shipped).
**Alternatives**: key storage by library id (out of scope; a separate feature if wanted).

## R-8. Where the new elements go inside `<note>`

**Decision**: accidental after the last `<type>`/`<dot>`, else before the first of `time-modification`, `stem`,
`notehead`, `notehead-text`, `staff`, `beam`, `notations`, `lyric`, `play`, `listen`, else before `</note>`. Beams
before the first of `notations`, `lyric`, `play`, `listen`, else before `</note>`, ascending `number`. Offsets from
`@rgrove/parse-xml` element `start`/`end` (already enabled with `includeOffsets`). No `<stem>` is written (Verovio
computes stems).
**Rationale**: MusicXML 4.0 `<note>` sequence (W3C reference), so completed files stay schema-valid.

## R-9. Performance

**Decision**: one linear pass over notes per part plus a sort per (staff, bar); inserts spliced in the existing
single-pass render-copy build. Measured in a test on the largest fixture (the 4.7 MB quartet) and the complete
*Für Elise*: completion time <= 10% of the current open time (SC-005).

**Measured (2026-09-23, `tests/core/musicxml/engraving/perf.test.ts`, Windows/Node, fastest of several runs)**:
- **SC-005 as written** (owner decision 2026-09-23, R-11): opening the largest library piece (*Bach BWV 846*,
  139 KB) - score worker load plus Verovio layout and page 1 - takes 70 ms, of which completion is 0.8 ms: +1.1% over
  opening without it (limit +10%). The test asserts the 10%.
- Linearity fences (T033): completion vs `readXml`+`buildScore` is 23% on Mozart K.387 (4.4 MB: 38 ms vs 166 ms)
  and about 33% on the bare *Für Elise* (0.1 ms vs 0.3 ms); the tests fail above 50%, which catches a quadratic
  regression. The earlier note that recorded ~32-40% as an "accepted deviation" from SC-005 compared completion with
  parsing only, not with opening; it is withdrawn.

## R-10. `walk.ts` implementation notes (filled in during T009)

**Decision**: `walkScore` normalizes every onset/duration/measure-length to one document-wide common tick unit
(`WalkResult.ppq`), computed with the same `computePPQ` helper `buildScore` already uses for the Score's own
ticks. This is what makes B1 ("a `<divisions>` change mid-piece is harmless") hold: every position is directly
comparable regardless of where or how often `<divisions>` changes, without needing a separate rational/fraction
type.
**Rationale**: reuses an already-tested technique instead of inventing a second one; data-model.md's "durations
are in the measure's `<divisions>` units" is satisfied in spirit (one consistent tick unit per walk), not literally
(the raw MusicXML `<divisions>` integer is not itself the unit).

**Decision**: `MeasureContext.keyByStaff` and `.time` hold the state in force at the *start* of the measure
(after any `<attributes>` at onset 0, before the first note/backup/forward); a later `<attributes>` change is
recorded separately in `MeasureContext.midBarChanges: { onset, keyByStaff?, time? }[]` (R-3 A2's mid-bar key
reset). `divisions` stays "last value seen by measure end" (informational only - every note's own duration is
already converted using whatever `<divisions>` was active when it was read, so the field is not load-bearing for
beat-grouping or accidentals).
**Alternatives**: a single flat state per measure with no mid-bar change record (rejected - loses the position a
change takes effect at, which R-3 A2 needs); per-onset event stream merged with notes (more general but not
needed by any rule in R-2/R-3, added complexity deferred until a rule actually needs it).

**Decision** (`accidentals.ts`, T025): C1's courtesy memory is *the previous bar specifically* - a letter absent
from the immediately preceding bar has no defined memory for C2 to compare against, even if that letter appeared
several bars earlier. Implemented by replacing the whole memory map at each bar boundary (not merging the new
bar's letters into the old map), so an absent letter's old value is forgotten rather than carried forward
indefinitely.
**Rationale**: caught by a fixture case the first implementation got wrong: `accidentals.musicxml` measure 9's C5
(sharp, matching the key) sits several bars after the last bar that wrote a *different* alteration of C (a
required natural, measure 3) but with measures 4-8 never touching the letter C in between - a "carry forward
until next use" memory wrongly added a courtesy sharp there; only "previous bar strictly" agrees with the
fixture's own intended reading and with R-3's literal wording ("the previous bar used a different alteration").
**Alternatives**: accumulate/merge across bars, letting a letter's last-seen value persist indefinitely
(rejected - wrong per the fixture case above, and would make courtesy signs appear arbitrarily far from the
change they are supposed to remind the reader about).

**Decision**: `beat-grouping.ts` exports two functions, not one. `beamSpans(time, measureLength, implicit, ppq)`
stays pure (no note content) and returns only the R-2 B3 baseline groups (with B2 pickup end-alignment applied).
A second function, `applyEighthExtensions(time, groups, notes)`, takes the baseline groups plus the measure's
actual notes and applies B4 (4/4 half-bar merge to four plain eighths; 3/4 whole-bar merge to six; 2/2 half split
on anything shorter than an eighth) - B4 is content-dependent (it must inspect what is actually written in a
candidate span), so it cannot live inside a function of `time`/`measureLength` alone. `beamSpans` also takes an
explicit `ppq` (ticks per quarter) rather than relying on `measureLength` alone to infer the metre's nominal
length, because an implicit (pickup) bar's `measureLength` is *short by definition* - there is no way to recover
what a full bar of the metre would be from it without a separate tick reference.
**Rationale**: keeps the pure geometric table (B3/B2) independent of note content, testable as a simple metre-in
tick-out function, while B4's content check gets its own small, separately testable function; `beams.ts` (T017)
calls both in sequence per (part, voice, measure).
**Alternatives**: fold B4 into `beamSpans` by also passing notes (rejected - couples the pure table to content
for every caller, even ones that only need the baseline); compute nominal length from `measureLength` alone by
requiring the caller to pass it only for full bars (rejected - `beamSpans` already needs to run for the same
metre on both full and short bars, so it needs one number, `ppq`, it can always rely on).

## R-11. Owner decisions at the pre-merge review (2026-09-23)

The pre-merge review (implementation log, 2026-09-23 18:30) raised four decisions only the owner can make. The owner
chose the reviewer's recommendation each time:

1. **SC-005 (open time)**: measured as written - the largest library piece, full open, with vs without completion -
   and not relaxed. Result in R-9: +1.1%.
2. **Title block vs 004 SC-002**: a compact title block (title, then composer and arranger on one line), counted in the
   page positions; feature 004's "two systems visible without scrolling" stays unchanged and its test unmodified.
3. **Purely visual audit gaps** (slurs, articulations, fingering, ...): named follow-ups for a future
   "library enrichment" feature, listed in `engraving-audit.md`; any gap that affects playback or grading is fixed
   in 006.
4. **Licence wording**: a factual note - the engraving tool adds only `<beam>` and `<accidental>` elements, nothing
   else changes, and each file keeps the licence recorded for it in `public/library/index.json`. No claim about
   copyright status.5. **Playback gaps found by the audit** (G-01..G-10 in `engraving-audit.md`: wrong melodies, invented or missing bars in
   nine library pieces, plus G-10 found at the T048 check, all from feature 005): not fixed in 006. 006 merges; the corrections are a new feature,
   "library content corrections", with the audit as its worklist. This replaces decision 3's "any gap that affects
   playback or grading is fixed in 006", which was made before the audit showed what the gaps are.