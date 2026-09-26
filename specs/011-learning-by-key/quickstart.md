# Quickstart: Learning by key

## Commands

```bash
pnpm install
pnpm library:exercises        # regenerate every exercise (keys, key changes, moved drills) from content/library/exercises
pnpm library:songs            # build the songs from content/library/songs + approved sources (needs D-1)
pnpm library:engrave          # no-op for generated files; completes any hand-edited file
pnpm library:index            # rewrite public/library/index.json; refuses on level, step-order or successor errors
pnpm library:fidelity         # re-run every audit record, rewrite docs/library-audit.md
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

One item: `pnpm library:fidelity --item learning/keys/g-major/introduction`; one song:
`pnpm library:songs --song learning/keys/c-major/song-au-clair-de-la-lune`.

## Manual verification

Use `pnpm screenshot --item <id>` and open the PNG it prints (AGENTS.md "Seeing the app").

### US1 - Find my key and start at the easiest step

1. `pnpm dev`, open the Scores panel. *Learning* shows *Keys* and *Key changes*; *Keys* lists C major, A minor, G major,
   E minor ... Dm (24 folders), all closed.
2. Open *C major*: items read "1 Introduction", "2 Beginner", "3 Intermediate", "4 Advanced", then the three Advanced
   extras, then "Song - Au clair de la lune".
3. `pnpm screenshot --item learning/keys/c-major/introduction`: two systems, RH scale in quarters over LH whole-note
   triads C, G, C, G, C, then the hands swapped; tempo mark 60; fingering on every note.
4. Same for `learning/keys/f-sharp-major/introduction` and `learning/keys/g-sharp-minor/introduction`: same shape,
   accidentals written, the raised 7th (F double sharp in G# minor) on every occurrence.
5. Practice mode on the C major Introduction, both hands: the held chord never has to be re-struck while the scale moves.

### US2 - Key changes

1. Open *Key changes > C major -> C minor* (description "parallel"). Screenshot its Introduction: light-light double
   barline, then a three-flat key signature at the arrival bar; last chord C minor.
2. *C major -> A minor* (relative): no signature change, a double barline and "A minor" above the arrival bar; ends on
   A minor.

### US3 - Songs

1. Open *C major > Song - Au clair de la lune*. Staff 1 melody, staff 2 block chords C and G, chord names above.
2. Practice mode, "left hand only": the melody sounds as the cursor passes it; only the chords are expected.
3. The score-source line shows the Mutopia edition and "CC0 (arrangement) of a public-domain source".

### US4 - Old links

1. On `main` (before this feature) open *Chords > C major triads*, set Practice tempo to 70% and "left hand".
2. Switch to this branch, reload, open *Keys > C major > 3 Intermediate*: tempo 70% and "left hand" are preselected.
3. With the library filter section set to *Chords* on `main`, after the switch the filter shows *Keys* instead.
