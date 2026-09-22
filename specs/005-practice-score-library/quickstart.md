# Quickstart: Practice Score Library

Feature `005-practice-score-library`. How to build the shelf, and how to verify each user story by
hand. Automated checks are named where they replace a manual step.

## Commands

```bash
pnpm install
pnpm library:exercises   # regenerate the exercise families from content/library/exercises/*.json
pnpm library:index       # regenerate public/library/index.json from the files on disk
pnpm dev                 # Vite dev server - open in Chrome or Edge
pnpm test -- tests/core/library tests/library   # the library's own suites
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e   # the full gate
```

`library:exercises` then `library:index` is the order: the index describes whatever is on disk. Both
are idempotent - running them on unchanged input must produce a byte-identical result (apart from the
index's `generated` timestamp), and `tests/library/index.test.ts` fails if a regeneration was
forgotten.

## Adding an item by hand

1. Put `<name>.musicxml` (authored) or `<name>.mxl` (obtained unmodified) in the right folder under
   `public/library/`.
2. Write `<name>.json` beside it (contract `library-index.md` SS1): title, composer, kind, level,
   tags, `reviewedBy`/`reviewedOn`, and a provenance block. A downloaded item also needs its
   `THIRD_PARTY_NOTICES.md` entry.
3. `pnpm library:index`, then `pnpm test -- tests/library`. The suites tell you what is missing: a
   wrong level, an unrecorded load notice, a missing licence, a file that does not load.

There is no code to change - that is FR-016, and the test proves it.

## Story verification

### US1 - Open the app and find something to play (P1)

1. `pnpm dev`, open the app in a **fresh profile** (no recents, no stored scores).
2. Open *Score > Scores*. **Expect**: the sections *Learning > Chords* and
   *Repertoire > Beginner / Intermediate / Advanced*, each item listed with title, composer and level.
3. Pick *Repertoire > Intermediate > Fur Elise*. **Expect**: the panel closes, the Score engraves like
   a printed page, and the transport is ready.
4. Press Play (Listen). **Expect**: it plays with a moving cursor, no notice in the tray.
5. Switch to Practice, then to Play. **Expect**: both behave exactly as for a dragged-in file.
6. Reopen *Scores*. **Expect**: the item is now also in the recents list underneath.
7. Look for the item's origin. **Expect**: source and licence (or "written for Musicanyya") are shown
   without leaving the score view.
8. Kill the dev server and reload. **Expect**: the previously opened item still opens from recents
   (the honest scope of "offline" - research R-4).
9. Repeat steps 2-4 under the desktop shell: `pnpm electron:dev`. **Expect**: identical behaviour
   under the `app://` origin. *(Automated: `tests/e2e/library.spec.ts`.)*

### US2 - Practise chords in every key (P2)

1. Open *Learning > Chords*. **Expect**: 24 exercises, one per major and minor key, named by key.
2. Open *C major triads* and *D major triads* in turn. **Expect**: the same 8 measures, the same chord
   positions, the same rhythm and the same fingering numbers - only the key differs (FR-005).
3. On any exercise, check that **every** note carries a fingering. *(Automated:
   `fingeringCoverage == 1` in `tests/library/sweep.test.ts`.)*
4. Open *G sharp minor triads*. **Expect**: the dominant is spelled D#-F##-A# and engraves with a
   double sharp; the item's note explains why it was not respelled (data-model SS5.1).
5. Switch to Practice with a MIDI keyboard. Play each chord. **Expect**: the app waits per chord and
   accepts a slightly spread chord (existing Practice rules, unchanged).
6. Open a drill from *Chords > Changes*. **Expect**: chord names above the staff, a written quarter
   rest between chords in the first section and none in the second, ties on common tones, and a
   backward repeat.

### US3 - Levels that mean something (P2)

1. Open the level description in the panel. **Expect**: each level's criteria in plain language.
2. Filter by *Beginner*. **Expect**: only Beginner items; each shows composer, key, metre, tempo,
   measures, duration, hands and skill tags.
3. Filter by key, then by skill tag, then type in the text box. **Expect**: the list narrows, and
   "zyczenie" finds "Życzenie" (accent-insensitive).
4. Change one item's `level` to `beginner` in its sidecar, run `pnpm library:index` and
   `pnpm test -- tests/library`. **Expect**: a failure naming the criteria it breaks. Revert.
   *(This is the real check behind FR-009; do it once when the criteria change.)*

### US4 - Everything on the shelf is legally clear (P2)

1. `pnpm test -- tests/library/licence.test.ts`. **Expect**: green, and the report lists every item
   with its licence.
2. Add a sidecar with `"licence": "CC-BY-4.0"`. **Expect**: the suite fails - not warns (FR-017).
   Revert.
3. Add a `downloaded` item without a `THIRD_PARTY_NOTICES.md` entry. **Expect**: failure (FR-020).
   Revert.
4. Truncate a score file to 0 bytes. **Expect**: failure (FR-021). Restore.
5. In the app, open an item that carries a `credit`. **Expect**: the credit line is visible where the
   item is shown (FR-019).

### US5 - The library keeps the app honest (P3)

1. `pnpm test -- tests/library/sweep.test.ts`. **Expect**: every item loads, engraves and yields a
   playable timeline; the row for each item matches its recorded facts and notices.
2. Add a `<harmony>` element to an authored item. **Expect**: the sweep fails with an unrecorded
   `unsupportedElement` notice (data-model SS4, correction A). Revert.
3. Delete an item's sidecar. **Expect**: the licence suite fails; in the running app the item is
   skipped with a notice and the rest of the library still lists (FR-022 spirit).
4. Point the catalog at a missing `index.json` (rename it, reload). **Expect**: one notice, a Retry
   button, and the Open button and recents still working (data-model SS6).

## Performance spot-checks (SC-007, SC-008)

- `pnpm test -- tests/core/library/filter.test.ts` asserts filtering a synthetic 200-item index stays
  under the budget.
- `du -sh public/library` after a full build: the whole shelf must stay well under the 10 MB the spec
  allows (authored MusicXML is a few KB per item).
- In the browser's Performance panel, open the library panel: no task longer than 50 ms.
