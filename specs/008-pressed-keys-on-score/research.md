# Research: Pressed Keys on the Score (008)

Phase 0 of `/speckit.plan`. Every decision: **Decision / Rationale / Alternatives considered**. Notation rules were
reviewed by the `music-domain-expert` role (2026-09-25); its findings are folded into R-06 to R-10 and into the
spec (terminology "red disc", FR-007, staff choice, ottava handling).

## Findings from the code (baseline)

- Practice marks are drawn on the one canvas overlay (`src/ui/score/practice-marks.ts`) as outlines around the
  notehead box: `waiting` = dashed blue ring, `correctSoFar` = dashed sky-blue ring, `correct` = solid green ring,
  `heldOver` = triangle, `playedAlong` = hexagon, `skipped` = dashed grey square.
- **Practice has no cursor of its own.** `drawPracticeState` in `src/ui/elements/mx-score-view.ts` draws marks,
  the loop bracket and the start marker, but no cursor; the dashed `waiting` ring is the only sign of the position.
  `drawCursorOverlay`'s `isPracticeWaiting` branch (a rectangle) is never called. Removing the dashed ring
  (FR-009) therefore needs a Practice cursor (R-02).
- Wrong / wrong-octave / extra keys reach the UI only as the `keyFeedback` effect and are shown on the on-screen
  keyboard (002 contract, R-14). The session keeps `heldKeys`, but not which held keys are wrong.
- Play mode's live "correct so far" mark is `drawLiveMarks` in `src/ui/score/grade-marks.ts` (dashed sky-blue ring,
  fed by the `liveMark` run effect).
- The canonical Score model has **no clefs, key signatures or octave shifts** (`src/core/score/model.ts`). The
  engraving walk (`src/core/musicxml/engraving/walk.ts`) already reads `<key>` per staff for accidental planning,
  and records `<octave-shift>` as `printedOctave`, but only for the render copy.
- Verovio SVG (6.3.0, Leipzig): `g.note#<NoteId>` holds `g.notehead` (one `<use>` of glyph E0A2/E0A3/E0A4), a
  sibling `g.stem`, optional `g.dots`, `g.accid`. Each measure's `g.staff` holds the five staff-line `<path>`s and
  any `g.clef`. So the notehead alone can be styled by CSS (`g.note.<class> > g.notehead`), and staff-line geometry
  can be measured per measure and staff.

## R-01 Green noteheads: a CSS class on the note's SVG element

**Decision**: Note marks (correct, held-over, skipped) are CSS classes on the Note's own `g.note` element, styled
through `g.note.<class> > g.notehead { fill: ... }`. A small UI module diffs the wanted classes against the applied
ones (off before on, as `highlight.ts` does) and re-applies them when a page is (re)mounted.

**Rationale**: Colours exactly the notehead glyph of exactly that Note ID (Constitution III), so hollow heads stay
hollow (the glyph is recoloured, not overdrawn), stems/dots/accidentals/fingering/lyrics stay black (FR-002), and
the mark follows scroll, zoom and reflow with no per-frame work (FR-013). A class toggle is well inside 50 ms
(FR-008).

**Alternatives considered**: drawing a green ellipse over the head on the canvas (covers the printed glyph with a
hand-drawn approximation, breaks hollow heads, needs per-frame geometry); asking Verovio to re-render with MEI
`@color` (a full re-render per key press, far over 50 ms); colouring `g.note` as a whole (turns stem, flag and
accidental green too, against FR-002).

## R-02 Practice cursor: a translucent band behind the notes

**Decision**: Practice gets its own cursor: a translucent sky-blue band behind the current event, as wide as the
event's noteheads plus a margin and as tall as the system at that measure. It is an absolutely positioned element
in the score stack **under** the page SVG (the SVG has a transparent background), repositioned only when the event
index, layout or scroll changes. The dashed `waiting` ring and the unused `isPracticeWaiting` rectangle go.

**Rationale**: Matches the owner's reference picture; behind the SVG it never tints the noteheads, so green and red
stay readable (Constitution VI "overlays never hide notes"). It belongs to the cursor layer and is switched off with
it (FR-012 of 004).

**Alternatives considered**: the Listen playhead bar (thin, drawn over the notes on the canvas; reads as "playing
now", not "waiting here"); a translucent fill on the top canvas (tints every notehead it crosses, muddying green);
keeping the dashed ring (the owner rejected dashed outlines).

## R-03 The other note states in the notehead style

**Decision**: `correct`, `correctSoFar` and `playedAlong` = green notehead (`--practice-correct-color`, Okabe-Ito
bluish-green #009e73). `heldOver` = orange notehead (#e69f00) **plus** a small upward chevron above the head
("lift the key"), drawn on the canvas above the notehead box, never over it. `skipped` = grey notehead (#999999) **plus** a small right-pointing chevron below the head ("moved past"), drawn on
the canvas below the notehead box, never over it (owner decision 2026-09-25, analyze A1). Both chevrons are placed
relative to the **notehead** box (`g.notehead`), not the whole `g.note` box, so a stem does not push them away.
`waiting` = no mark (the band of R-02 shows it). Red discs (R-04) are vermilion #d55e00.

**Rationale**: One visual language (recoloured heads, no outlines). Shape distinctions required by FR-010 and
Constitution VI: correct = the printed head itself; wrong = an added disc at another position or beside the head;
held-over = an upward chevron above the head; skipped = a right-pointing chevron below it (grey and green heads
alone would differ by colour only, analyze A1). The
owner decided (2026-09-25) that a green head needs no extra shape.

**Known limit (accepted)**: in greyscale, a chord member held green at the cursor looks close to a black one. The
key is physically held and the on-screen keyboard shows it; the owner's "green notehead only" answer covers this.
SC-005 is checked on accepted notes (behind the cursor) and on the four state shapes.

**Alternatives considered**: keeping the triangle/hexagon/square outlines (mixes old and new looks, US3); a tick
over correct notes (rejected by the owner).

## R-04 Red discs: drawn on the existing canvas overlay

**Decision**: Discs, their ledger lines, accidentals and ottava labels are drawn on the existing overlay canvas in
the Practice layer. Disc = solid vermilion ellipse, 0.85 x the size of a black notehead on that staff (measured from
the rendered notehead box; fallback 1.18 x 1.0 staff spaces). Ledger lines use the staff-line stroke width and the
measured staff-line spacing. Everything is derived from the staff's measured line positions (R-05) and the core's
placement (R-06 to R-10).

**Rationale**: The canvas already carries the marks layer, is cleared per frame, and is switched off with the marks
layer (FR-014). The disc is feedback, not engraving; its appearance is deliberately "your key", not a printed note
(Constitution III forbids hand-drawn *notation*, so accidentals use the real font glyphs, R-11).

The discs' ledger lines and ottava labels are drawn on the canvas by our code. They are feedback that marks "your
key", not engraved notation of the Score, so Constitution III's "no hand-drawn approximations of notation" is not
breached; this reading is recorded in plan.md Complexity Tracking and checked by the constitution review (T064).

**Alternatives considered**: inserting SVG `<use>` elements into Verovio's page SVG (mutates the engraved document,
glyph defs only exist for glyphs the page used, and pages are re-mounted); a second SVG overlay layer (a new layer
with the same job as the canvas).

## R-05 Staff geometry from the rendered SVG

**Decision**: For the disc's staff, the UI measures the five staff-line paths of that staff in the cursor's measure
and derives the bottom-line y and the staff space. The staff element is found from a written note of that staff at
or near the cursor (`noteEl.closest('g.staff')`); only when the measure has no note on that staff does it fall back
to `#<MeasureId> > g.staff:nth-of-type(k)`, `k` = the part's staff offset + staff number (analyze A10). Cached per element-cache signature and scroll key, like the dimmed-note rects.

**Rationale**: Exact against what Verovio drew, for any zoom; no duplication of Verovio's layout in our code.

**Alternatives considered**: interpolating from written notes on that staff (fails on rests and empty bars);
computing layout ourselves (duplicates Verovio).

## R-06 Where the pitch is printed: clef, key and octave shifts join the Score model

**Decision**: The parser adds three per-part lists to the canonical Score (additive): `clefs`, `keys` and
`octaveShifts`, each with staff and position (measure index + onset in measure). A pure core function returns the
notation context of a staff at a position, and another places a pressed key: diatonic staff position (0 = bottom
line), letter, printed octave, alter, whether a sign is shown, ledger-line count and ottava. `<clef-octave-change>`
and `<octave-shift>` are applied (MusicXML `<pitch>` is sounding pitch; an 8va is encoded `type="down"`), so the
disc sits where the pitch is printed. Transposing instruments: written = pressed - `<transpose>`
(chromatic/octave-change, diatonic for the letter); not needed for piano, implemented with the existing
`transpositions` list.

**Rationale**: Placement is notation logic; the constitution keeps it in the core (V: the UI renders what the core
produces) where it is tested in Node without a browser (IV). The walk already proves `<key>` parsing.

**Alternatives considered**: reading the clef glyph (E050/E062/E05C) and its y from the SVG (misses mid-measure
changes and octave clefs, and puts music logic in the UI); reusing the engraving walk's output (it serves the render
copy and is not part of the Score).

## R-07 Spelling a pressed key (FR-007)

**Decision**: First rule that applies: (a) the spelling that pitch class already has at the cursor event or earlier
in the bar on that staff; (b) the key's own scale note (E# in F# major, Cb in Gb major); (c) a white key as its
natural; (d) a black key as a sharp when `fifths >= 0`, a flat when `fifths < 0`; in a minor key the raised 7th as
the leading tone. No double accidentals. The sign is shown when the spelled pitch differs from the key signature or
from the accidental in force for that letter and octave in the bar; a letter altered in another octave in the bar
also gets its sign (courtesy). A disc never sets bar accidentals. Non-traditional keys (no `<fifths>`): every disc
shows its sign.

**Rationale**: SC-007 (the key can be named from the Score alone) needs the reading the surrounding music implies;
the order above is the expert's recommendation and is deterministic, so it is golden-testable (FR-016).

**Alternatives considered**: key signature only (wrong after a written accidental in the bar); always sharps (reads
wrong in flat keys).

## R-08 Staff choice on a grand staff

**Decision**: (1) A key that matches a written note at the cursor goes on that note's printed staff. (2) One hand
practised: that hand's staff, unless it needs more than `PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES` (3) ledger lines
and the other staff fewer. (3) Both hands: the staff whose notes sounding at the cursor are nearest in semitones.
(4) Neither staff has notes there: fewer ledger lines under the clef in force; tie: C4 and above upper staff. The
choice is **sticky**: made at key-down, kept until release (the core keeps the previous placements and reuses the
staff of a key that is still held).

**Rationale**: Pitch-based (clef changes cannot flip it), readable, stable while held (expert review).

**Alternatives considered**: "middle C and above on the upper staff" alone (wrong when both staves are in bass
clef); re-choosing every frame (discs jump as the cursor moves).

## R-09 Sideways shift (FR-006) and clusters

**Decision**: Obstacles are the rendered notehead boxes on the disc's staff at the cursor column. A disc at the same
staff position as a written head, or a second from it, moves **right** by one written-head width plus 0.1 staff
space (further right past augmentation dots). Several discs: placed lowest first, each in the leftmost free slot
(base column, +1, +2 head widths) that does not touch a written head or an earlier disc a second or less away. A
disc's accidental sits in the accidental column left of the written chord's accidentals. This is a pure geometry
function over numbers (UI layer, tested in Vitest without a DOM).

**Rationale**: The engraver's chord-second convention; notes Verovio already displaced are respected because the
check uses rendered boxes. The owner's reference picture shows slight overlap; the spec keeps "never hide a written
notehead" (Constitution VI), as explained to the owner on 2026-09-25.

**Alternatives considered**: left shift (collides with the written note's accidental); overlap allowed (hides part
of the note the musician is reading).

## R-10 Far-away keys: ledger limit and ottava label

**Decision**: `PRACTICE_DISC_MAX_LEDGER_LINES = 5`. Beyond it the disc is placed one octave (then two, then three) closer, at
that octave's correct position, with an "8va"/"8vb" ("15ma"/"15mb", "22ma"/"22mb") label beside it. Three folds are needed
when a Score's own 8va/15mb is in force (implementation, 2026-09-25): a piano key can then lie up to 16 ledger lines from the staff. Applied after R-08, which often
solves it by choosing the other staff.

**Rationale**: Beyond 4-5 ledger lines engravers use ottava; a disc parked at the staff edge would show a wrong
pitch and break SC-007.

## R-11 Accidental glyphs from Verovio, no new asset

**Decision**: A pure function `harvestGlyphs(toolkit)` in `src/workers/glyphs.ts` (testable in Node with the real
toolkit, analyze A7) is called by the Verovio worker on `init`: it renders one tiny built-in MEI measure (a sharp, a flat, a natural and a
black notehead) before any Score is loaded, extracts the glyph path data of E262 (sharp), E260 (flat), E261
(natural) and E0A4 (black notehead) from the SVG `<defs>`, and returns them in the `ready` response. The UI turns
them into `Path2D`s once and draws accidentals with them at the staff's scale.

**Verified (2026-09-25, spike with the installed verovio 6.3.0 in Node, removed afterwards)**: `loadData` accepts an
MEI string (warns "No header found", then renders); the SVG `<defs>` holds each used glyph as
`<g id="E262-<suffix>"><path transform="scale(1,-1)" d="..."/></g>` in font units, placed by
`<use ... transform="translate(x, y) scale(0.72, 0.72)">`.

**Rationale**: Same Leipzig glyphs as the engraved page (Constitution III), no new asset and no new licence
(Leipzig via Verovio is already in `THIRD_PARTY_NOTICES.md`), one render at start-up in the worker (off the main
thread).

**Alternatives considered**: bundling Bravura or Leipzig OTF (new asset, licence notice, owner decision); Unicode
text glyphs (system-font dependent); hand-drawn paths (Constitution III).

## R-12 Which held keys are wrong: tracked by the session

**Decision**: `PracticeSession` gains `heldWrongKeys: ReadonlyMap<number, WrongKeyState>`: set wherever the matcher
emits `keyFeedback`; deleted on the key's `noteOff` and on `deviceLost`; on every event change each still-held key is
re-evaluated (a held key required by the new event becomes that note's `heldOver`, and leaves the map; an extra key
stays). Contract `practice-session` 1.5.0 -> 1.6.0 (MINOR, additive).

**Rationale**: The matcher is the only place that knows why a key is wrong; deriving it in the UI from `heldKeys`
would duplicate matching logic (Constitution V). Pure and replayable, so FR-016 is a golden test.

**Also (T068, found running T014)**: the matcher never withdrew a `correctSoFar` mark when a chord key was released,
although FR-003 needs it (and this document first assumed 002 did). `noteOff` of a key required by the current event
now removes the `correctSoFar` / `heldOver` mark of its notes, the same moment its held-over hint is hidden.

**Alternatives considered**: UI keeps its own map from `keyFeedback` effects (misses re-evaluation at event
changes and device loss; logic in the UI).

## R-13 Play mode live mark (FR-017)

**Decision**: The `liveMark` effect sets the same `mx-mark-correct` class (green notehead) instead of
`drawLiveMarks`' dashed ring; the classes are cleared when the Grade layer is shown, a new run starts or the mode
changes. `drawLiveMarks` is removed. The Grade marks are untouched.

**Rationale**: Owner decision 2026-09-25 (same style, no dashed outlines anywhere).

## R-14 Performance

A key press changes at most a handful of classes and one canvas redraw of the marks layer (already per frame in
Practice). Staff geometry and notehead boxes for the cursor measure are cached per layout/scroll key. Budget:
visual <= 50 ms after the key press (002 SC-002, constitution II), measured in the e2e test from the `e2e-midi`
dispatch to the class/pixel change.
