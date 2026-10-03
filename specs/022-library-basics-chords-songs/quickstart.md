# Quickstart: Library Basics, Chord Lessons and More Songs (022)

## Build the content

```bash
pnpm install
pnpm library:lessons            # Basics + chord lessons from content/library/lessons/*.json (new)
pnpm library:songs              # songs, incl. the new full/simplified pairs
pnpm library:exercises          # only if an exercise definition changed (raisedBecause, R1)
pnpm library:index              # regenerate public/library/index.json
pnpm library:fidelity --check   # every audit record reproduces; docs/library-audit.md fresh
```

One item: `pnpm library:lessons --lesson basics/ties-in-a-bar`, `pnpm library:songs --song <id>`.

## Checks

```bash
pnpm test -- tests/library      # level, playability, metadata, regeneration, fidelity, sweep
pnpm test -- src/core/library src/core/timeline
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke
```

## See it

```bash
pnpm screenshot --item basics/middle-c-quarter-notes
```

Open the PNG it prints. Never report a manual check without looking at the picture.

## Manual verification per story

### US1 - Basics (P1)

1. `pnpm dev`, open the library: **Basics** is the first shelf, above Learning and Repertoire.
2. Its lessons run 1-24 in teaching order (data-model §4), not alphabetically.
3. Open "Middle C and the beat": the details show the explanation ("Trains"); the score shows the one-line text above
   bar 1, not overlapping the tempo mark (screenshot).
4. Listen: plays with the cursor. Practice: waits for each C. Play with a perfect synthetic performance (e2e) ->
   every note correct.
5. "Ties: hold, don't play again": Practice moves on after the tied length without asking for the tied note.
6. "Staccato": Listen - the dotted notes sound clearly shorter than in "Legato".
7. Screenshot every Basics lesson once (`pnpm screenshot --item basics/<id>`) and look at each.

### US2 - Chord lessons (P2)

1. Library > Learning > **Chords** (after Keys and Key changes) with One chord, Chord switches, Progressions.
2. "Major to minor" in C: chord symbols C and Cm above the staff; Practice waits for each whole chord; one wrong note
   is marked wrong pitch.
3. "Seventh chords": each chord split between the hands, no hand more than three keys; the simplified version is
   listed at Beginner in the same folder.

### US3 - Songs (P3)

1. In a key folder, each new song appears as "Song - <name> (simplified)" (Beginner) and "Song - <name>"
   (Intermediate), next to each other.
2. Listen to both: the same tune; the full version's left hand moves (waltz/broken/repeated), the simplified holds one
   chord per bar.
3. Details list composer, source, licence and departures.
4. `pnpm library:fidelity --item learning/keys/<key>/song-<slug>` -> 0 differences.

### US4 - Orchestra-ready (P4)

1. Every `content/library/sources/<id>/source.json` used by a new song has `multiPart`.
2. Play mode on a new song uses the Guide voice (no Orchestra parts).

### Level rules (FR-005 - FR-007)

1. `pnpm test -- tests/library/index.test.ts` - every item passes its level check; no existing level changed
   (compare `git diff public/library/index.json` - only `levelCheck`, new facts and `raisedBecause` may change for
   existing items).
2. Unit tests: an Introduction item with eighth notes alone passes; with eighth notes and ties fails criterion 29.
