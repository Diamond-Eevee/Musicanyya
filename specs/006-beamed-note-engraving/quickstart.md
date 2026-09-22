# Quickstart: Beamed Notes and Complete Engraving

## Build and check

```text
pnpm install
pnpm test -- tests/core/musicxml/engraving     # rule tables, plan, idempotence
pnpm test -- tests/library                     # guard (FR-012) + before/after identity (SC-003)
pnpm test -- tests/verovio/engraving           # real Verovio: beams, visible accidentals, title
pnpm library:exercises                         # regenerate learning exercises (now completed)
pnpm library:engrave                           # complete hand-written repertoire files in place
pnpm library:index                             # refresh bytes/hash in public/library/index.json
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e   # full gate
```

`pnpm library:engrave` is idempotent: a second run changes nothing (`git diff --stat` stays empty).

## Manual verification

Start `pnpm dev`, open Chrome at http://localhost:5173.

### US1 - beams

1. Scores panel -> *Für Elise (theme, arranged for this app)*.
2. Pickup: E-D♯ under one double beam. Bar 1: six sixteenths under one beam (secondary beam unbroken). Bar 2:
   treble A eighth keeps its flag, the sixteenth rest breaks, C-E-A are beamed; bass A-E-A beamed.
3. Press Play (Listen): the cursor and highlights move exactly as before; Practice waits on the same notes.
4. Open *Bach Prelude BWV 846* and *Burgmüller Op. 100 No. 2*: every beat of sixteenths is beamed in 4/4 per beat;
   eighths in 4/4 pieces are grouped in fours, never across the middle of the bar.

### US2 - accidentals

1. *Für Elise (theme)* bar 1: the D after D♯ shows a natural sign; bar 5 the same.
2. Learning -> Chords -> *Triads in A minor*: the V chord shows G♯ with a sharp sign in both staves.
3. Bar after a change: the first D in bar 2 of *Für Elise (complete)*, if unaltered, shows a plain reminder natural.

### US3 - opened scores

1. Drag `tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` (pitches and durations only) onto the page:
   it looks like the library version; the notice tray shows one info notice "... beam groups, ... accidentals added
   for display".
2. Drag a MuseScore export with its own beams (e.g. an OpenScore fixture): no completion notice; beams as encoded.

### US4 - library guard

1. In a scratch copy, delete one `<accidental>natural</accidental>` from *Für Elise (theme)* bar 1 and run
   `pnpm test -- tests/library/engraving-guard`: it fails naming the item, bar 1, staff 1, `D5`.

### FR-017 - title

Every opened Score shows title, composer and (if any) arranger above the first system of page 1, in Listen,
Practice and Play.

### US5 - audit

Read `specs/006-beamed-note-engraving/engraving-audit.md`: one row per element (FR-014) per repertoire piece, each
"missing" row linked to a fix or a follow-up.
