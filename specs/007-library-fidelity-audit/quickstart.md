# Quickstart: Library Fidelity Audit

Everything below runs in Node; no browser, MIDI keyboard or network is needed once the sources are committed.

## Setup

```text
pnpm install
```

## Commands

```text
pnpm library:fidelity                         # re-run every check, rewrite docs/library-audit.md
pnpm library:fidelity --item <id>             # one item, every difference printed in full
pnpm library:fidelity --check                 # CI mode: fail if any result or the report is stale
pnpm library:convert-ly <source-id> <item-id> --replace   # convert a Mutopia .ly into an item (cross-checked against its MIDI)
pnpm library:engrave                          # complete beams/accidentals after a conversion (feature 006)
pnpm library:index                            # regenerate public/library/index.json
pnpm test -- tests/tools/fidelity tests/tools/lilypond tests/library
```

## Adding a source (only after the owner approved it)

1. Download the `.ly` and `.mid` from the Mutopia piece page into `content/library/sources/<source-id>/`, unchanged.
2. Write `source.json` (contract `source-manifest.md`): edition, URL, licence as the page states it, `obtained`,
   `approvedByOwner`, SHA-256 of each file (`certutil -hashfile <file> SHA256` on Windows, `sha256sum` elsewhere),
   `midiOrder` and `midiNoteTracks` (inspect once with `pnpm library:fidelity --inspect-midi <path>`).
3. Add the source to `THIRD_PARTY_NOTICES.md`.

## Manual verification

### US1 - originals are the original

1. `pnpm library:fidelity --item repertoire/advanced/chopin-prelude-op28-no4` prints the source
   (`mutopia-468-chopin-op28-no4`) and `0 differences (expected 0)`, with 0 for item vs notation and for notation
   vs sound. The edition and the aspects compared are in the report row (step 4).
2. Planted error: copy the item's `.musicxml` to your scratch space, raise one pitch by a semitone, and run
   `pnpm library:fidelity --item repertoire/advanced/chopin-prelude-op28-no4 --file <copy>`.
   Expected: exactly one `pitch` difference naming that bar and beat (e.g. `bar 0, beat 0: pitch C4, source B3`
   for the pickup's B3), and the record fails. Do not edit the real file.
3. `pnpm screenshot --item repertoire/advanced/satie-gymnopedie-no1` (a replaced item): open the PNG and check
   that the title and subtitle no longer mention "our own close", and that the first system shows the familiar
   alternating low-bass/high-chord pattern with two sharps in the key signature (the chords on the lower staff).
   The app shows one system at a time; the end of the piece is covered by the mechanical check (bar count, played
   order, every pitch and onset against the source and its MIDI).
4. Open `docs/library-audit.md`: the Chopin row names "Peters, 1879", Mutopia 468, method mechanical, 0 differences.

### US2 - arrangements say so, quotes are right

1. `pnpm library:fidelity --item repertoire/beginner/fur-elise-theme-16-bar` prints its `melody` checks against
   Mutopia 931. Each check's counted differences equal its `expectedDifferences` (the named departures: the left-out
   C in bar 1, G for G# and D for D#, the shortened bar 5), and the rhythm differences are listed as allowed by
   departures (the doubled values).
2. `public/library/index.json`: the item's `meta.departures` lists each departure in words, naming the bars.
3. `pnpm screenshot --item repertoire/beginner/ode-to-joy`: the title says it is arranged.

### US3 - exercises are theoretically correct

1. `pnpm library:fidelity --item learning/chords/triads-b-flat-minor` prints `theory: 0 differences`.
2. Planted error: copy `triads-g-sharp-minor.musicxml`, change one `F##` (step F, alter 2) to `G` (step G, alter 0),
   run the one-file check on the copy. Expected: one difference naming its bar, hand and chord, e.g.
   `bar 2: right hand, chord 3: expected F##, found G4 (spelling)`.

### US4 - one report

1. `docs/library-audit.md` lists 58 items (or fewer on the shelf plus the removed ones, the totals line says which),
   each exactly once, and the level-count table shows every level at or above its minimum or the shortfall.
2. `pnpm library:fidelity --check` exits 0 on a clean tree.
3. Pick any "verified" row, run `--item` for it, and get the same difference count as the report.

### App still works (FR-021)

1. `pnpm screenshot --item repertoire/advanced/clementi-sonatina-op36-no1-mvt1` and
   `--item repertoire/advanced/burgmuller-op100-no2` (both moved to Advanced by the audit): open each PNG; beams are
   drawn, the title block matches the new sidecar, no load error is printed.
2. Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.
