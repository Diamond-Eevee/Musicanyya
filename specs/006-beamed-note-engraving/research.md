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
  splits into quarters when it contains anything shorter than an eighth. 3/4 - the whole bar is one group only for
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
- **B11**: a (part, voice) is beamed only if none of its notes anywhere carries `<beam>` (FR-004, US3 sc. 2).
- **Chords**: beams are written on the chord head (the note without `<chord/>`); a `<beam>` on any chord member
  counts as encoded.

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
  all staves; `fifths` and non-traditional `<key-step>/<key-alter>`); bar alteration per (staff, step, **octave**),
  empty at each barline and reset at a mid-bar key change. Expected = bar alteration, else key alteration.
- **A3 Ties**: a `<tie type="stop">` continuation of the same step/octave/alter gets no sign and does not change the
  bar state; across a barline its alteration is remembered for R-3 C1 only.
- **A4 Required**: a note that prints an `<accidental>` keeps it untouched and sets the bar state (a sign that
  contradicts `<alter>` is left as is). Otherwise, if alter differs from expected: add sharp / flat / natural /
  double-sharp / flat-flat; double sharp -> sharp prints a plain sharp. Non-integer alter (microtones): skipped.
- **A5**: same pos, same step and octave, different alter (two voices, or F and F♯ in one chord): both get signs.
- **A6 Octave**: state is per octave (FR-007).
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
the music: title centred (work title, else movement title, else file name), composer right-aligned, arranger
("arr. ...") below it, in the engraving's serif; long titles wrap. Verovio `header: 'none'`.
**Rationale**: the only way to show composer and arranger with the pinned Verovio; independent of Verovio
versions; supports the file-name fallback; no dependency.
**Alternatives**: `header: 'auto'` (title only - fails FR-017); injecting an MEI `<pgHead>` via `getMEI` + reload
(doubles load time for large scores); upgrading Verovio (not shown to fix it; stack change needs the owner).
**Consequence**: the block adds height before page 1; the feature 004 fit rule sizes pages, not the block, so the
first screenful shows the block plus the top of page 1. Covered by the 004 layout e2e tests (re-run).

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
