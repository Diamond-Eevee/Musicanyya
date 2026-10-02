# Quickstart: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Feature**: `019-metronome-orchestra-volume`

## Build and run

```text
pnpm install
pnpm dev                    # http://localhost:5173 (Chrome/Edge)
pnpm electron:dev           # desktop shell against the dev server
```

New and changed commands (dev-time, see `docs/agents/reference.md` R7):

```text
pnpm library:orchestra repertoire/advanced/grieg-morning-mood          # (re)generate the Orchestra parts from the definition
pnpm library:orchestra repertoire/advanced/grieg-morning-mood --check  # verify the committed file, write nothing
pnpm library:convert-ly own-grieg-op46-no1-transcription-a repertoire/advanced/grieg-morning-mood
pnpm library:fidelity --item repertoire/advanced/grieg-morning-mood    # double-entry + orchestra checks, every difference
pnpm library:index                                                     # facts (incl. orchestra) and level
```

(The level folder, `advanced`, is the expected result of `computeLevel`; use the id `pnpm library:index` prints.)

## Gate

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## Manual verification

Use `pnpm screenshot` for what a picture shows (reference R7); ask the owner only for sound (SC-007).

### US1 - Metronome level

1. `pnpm screenshot --item repertoire/beginner/ode-to-joy --width 1280 --height 800` after opening the Levels panel
   (scripted click on the Levels button): the panel shows "Metronome 100 %" and "Orchestra" disabled with "This score
   has no orchestra"; the toolbar layout is unchanged apart from the Levels button.
2. Play mode, Start a run, set the Metronome slider to 30 % during the count-in: the run continues (no pause), the
   cursor keeps moving. Sound check for the owner: the click is clearly quieter, the piano is not.
3. Reload: the panel still shows 30 %.
4. Set 0 %: a run's count-in still lasts its measures, the cursor stands then moves; no click is heard.

### US2 - Morning Mood with Orchestra

1. `pnpm screenshot --browser --width 1280 --height 800`, then search "Morning": the item shows the "with orchestra"
   marker (glyph + text).
2. `pnpm screenshot --item repertoire/advanced/grieg-morning-mood --full`: two staves per system (treble + bass),
   title "Morning Mood", composer Grieg; no third staff, no instrument names. Compare page by page with the print
   (`https://archive.org/download/31761045200615/page/n6_w1000.jpg` and following).
3. `--greyscale` version of step 2: nothing on the score sheet depends on colour.
4. `pnpm screenshot --item repertoire/advanced/grieg-morning-mood --run --keys "sleep:6000"`: the cursor stands at a
   piano note (never between piano notes because of an Orchestra onset).
5. Practice: `--practice --keys "+80,-80"` with the item: only piano notes are expected (help shows piano keys only).
6. Note for the check: in Play mode the flute/oboe doubling can cover a missed melody note to the ear; the default
   level is kept low for that reason (research R-7, R-18).
7. Owner listening check (SC-007): Listen mode from bar 1 at 100 % tempo, then Play mode with the right hand only:
   the piece is recognisable, flute/oboe and strings are separate instruments in time with the piano, the default
   Orchestra level supports and does not drown the piano.

### US3 - Orchestra level

1. On *Morning Mood* in Listen mode, open Levels while playing: playback does not pause; move Orchestra to 0 % and back
   to 60 %: the Orchestra fades out and returns at once; the piano level does not change (owner sound check).
2. Open *Ode to Joy*: the Orchestra slider is disabled with the explanation; open *Morning Mood* again: enabled, same
   value as before.
3. Reload (browser) and restart (Electron): the value is kept.

### US4 - Find pieces with an Orchestra

1. Browser list and detail of *Morning Mood*: marker "with orchestra"; detail lists the instruments of the definition (e.g. "Flute, Oboe, Strings, Cello, Horn"), as the
   names are written there. Items without an Orchestra show no marker.
