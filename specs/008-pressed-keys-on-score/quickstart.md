# Quickstart: Pressed Keys on the Score (008)

No new setup, dependency or command. Build and run as before (`pnpm install`, `pnpm dev`); the full gate is
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

## Automated checks

```bash
pnpm test -- tests/core/notation
pnpm test -- tests/core/practice
pnpm test -- tests/ui/disc-layout.test.ts tests/ui/note-marks.test.ts
pnpm test:e2e -- tests/e2e/us1-practice.spec.ts tests/e2e/pressed-keys.spec.ts
```

The e2e spec drives Practice with the existing `e2e-midi` window event and saves reference PNGs to
`tests/.generated/008/` for the manual checks below.

## Seeing it (no MIDI keyboard needed)

`pnpm screenshot` gains two dev-only options (this feature): `--practice` (start Practice after opening) and
`--keys "<list>"`, a comma-separated list of steps, each `+<midi>` (key down), `-<midi>` (key up) or `wait`. The
picture is taken after the last step, with keys still down shown as held.

```bash
pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --practice --keys "+76,-76,+75,-75,+74" --out tests/.generated/008/us2-d5.png
```

Open the PNG and look at it before reporting a manual check as done (AGENTS.md section 8).

## Manual verification per user story

### US1 - correct notes turn green

1. Für Elise, Practice. Play E5, D#5, E5, D#5 (`+76,-76,+75,-75,+76,-76,+75,-75`).
2. Expect: the four noteheads are green (filled heads solid green; stems, beams, accidentals black), the translucent
   band stands behind the next note (E5), and no dashed ring, square or rectangle is anywhere on the page.
3. Chord check (any library item with a three-note chord, e.g. a C-major triad exercise): hold two of its keys ->
   two green heads, the third black; release one -> it turns black again.
4. Play a half note and a whole note: their heads turn green and stay hollow.

### US2 - wrong keys as red discs

1. Für Elise, Practice, at the first E5: `+74` (D5, held). Expect a red disc on the D5 position of the treble staff,
   in the band, shifted right of the E5 head (a second), E5 unobscured.
2. `-74`: the disc disappears.
3. `+64` (E4, wrong octave): a disc one octave below E5 on the treble staff; the hint names the octave as today.
4. `+70` (A#4/Bb4, black key, A minor context): a disc with a sharp sign (rule R-07), read correctly as the key
   pressed.
5. `+74,+72` held together: two discs, placed as a second without touching each other or the E5.
6. `+21` (A0): a disc with ottava label ("15mb" or "8vb") on the bass staff, not parked at the edge.
7. Toggle the marks layer off (View panel): discs and green heads vanish; the session continues.

### US3 - other states

1. Grace note: in a fixture with a grace note, play it -> its head turns green.
2. Held-over: hold a key into the next event that needs it -> orange head with a small chevron above it, plus the
   "release and play again" hint.
3. Skip forward one event (Skip Forward): the skipped heads turn grey with a small right-pointing chevron below.
4. Play mode: start a run and play the first notes correctly -> green heads, no dashed ring; at the end the Grade
   marks appear as before.

### Real files

Repeat US1 steps 1-2 and US2 step 1 on two items from `tests/fixtures/musicxml/real` with a grand staff and a key
signature (AGENTS.md: check behaviour on real files, not only on hand-made fixtures).
