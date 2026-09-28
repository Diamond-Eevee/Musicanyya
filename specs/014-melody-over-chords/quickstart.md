# Quickstart: Melody over chords (014)

No new command, script or setup. The existing library pipeline regenerates everything:

```bash
pnpm library:exercises      # regenerate from content/library/exercises (refuses items with melody findings)
pnpm library:index          # regenerate public/library/index.json (level check, step order, engraving guard)
pnpm library:fidelity       # re-run the audit, rewrite docs/library-audit.md
```

Focused tests while working:

```bash
pnpm test -- tests/core/library/exercise
pnpm test -- tests/tools/fidelity/melody-rules.test.ts
pnpm test -- tests/library
```

Full gate at a checkpoint: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

## Manual verification

Look at every picture; a check is not done until the PNG was opened.

### US1 - key-change items have a melody

1. `pnpm screenshot --item learning/key-changes/c-major-to-a-minor/introduction`
   Expect (amended after the owner's listening check, 2026-09-28): treble staff has quarter notes moving by step in
   scale runs like *C major - introduction* (C4 up to C5, the thumb passing under on F), a finger on every note;
   bass staff has root-position whole-note triads that change (I V I IV, then i i VI VI i i VI i) with roman numerals
   below; after the double bar the melody uses G♯ once, leading to A, and ends on A over the A minor chord. No bar with
   a triad on both staves.
2. `pnpm screenshot --item learning/key-changes/c-major-to-c-minor/beginner` - quarter notes with broken-chord
   thirds over whole-note chords, E♭ after the change.
3. `pnpm dev`, open the same item from the Score browser, press Listen: the melody sounds over the chords. Practice
   mode with the on-screen piano: the first stop waits for the melody note plus the left-hand chord.

### US2 - the difficulty ladder

1. Screenshot the introduction, beginner and intermediate items of `learning/key-changes/g-major-to-e-minor`:
   introduction in quarter-note steps, beginner adds leaps of a third and a half-bar IV6/4-V6 in the left hand,
   intermediate adds eighth pairs and wider leaps; the range does not shrink from one step to the next.
2. `pnpm library:index` prints no level or step-order failure.

### US3 - drills

1. `pnpm screenshot --item learning/keys/c-major/i-v-vi-iv`: left hand identical to before (dotted-half chords with
   quarter rests and the repeat, then whole notes with ties, then the tonic); right hand a melody resting with the
   left hand's quarter rests.
2. `pnpm screenshot --item learning/key-changes/c-major-to-c-minor/major-and-minor`: melody over C minor chords uses
   E♭.

### FR-012 - progress starts fresh

1. On `main` (before this feature) open *C major to A minor - introduction*, play it in Play mode once so it shows a
   result in the Score browser.
2. Switch to the feature build, reload: the item shows as New with no results; the browser, Continue and other items'
   progress work normally.
