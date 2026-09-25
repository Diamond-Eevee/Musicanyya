# Quickstart: On-Screen Piano That Looks Like a Real Keyboard

Feature 010. No new setup: `pnpm install` as before.

## Run

- Browser: `pnpm dev`, open the printed URL. Desktop app: as in the main `quickstart` of feature 001.
- Tests: `pnpm exec vitest run tests/ui/piano` (layout and element), `pnpm exec playwright test
  tests/e2e/piano-keyboard.spec.ts` (real geometry in every engine), full gate `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm test:e2e`.

## Seeing it

`pnpm screenshot --item learning/chords/c-major-scale-and-chords --piano --width 1280` (also 1024, 1600, 1920,
2560), with `--practice --keys "..."` to put keys down (a held key stays down in the picture) and `--greyscale` for the
state check. `--piano` and `--greyscale` are new dev options of `tools/dev/screenshot.ts` (this feature's setup
task). Look at every picture before reporting.

## Manual verification

### US1 - the keyboard looks like a piano

1. Open any Score, View menu -> "On-screen piano keys" on.
2. Count: 52 white keys, 36 black keys; the black keys come in groups of two and three; the lowest key is an A, the
   highest a C.
3. The two black keys of a group lean slightly apart; in a group of three the middle one is centred. Black keys are
   about two thirds as long as the white keys and a little over half as wide.
4. Every C has a small label, C1 ... C8; middle C reads C4. No other key is labelled.
5. Resize the window from very wide to about 1024 px: the keyboard always fills the width, never scrolls sideways,
   keeps its proportions, and the Score stays clear of it.

### US2 - feedback on the new keys

1. With a MIDI keyboard (or the `e2e-midi` seam), hold C4 and C#4: both look pressed and carry the red dot; the black
   key's dot is as visible as the white key's.
2. In Practice, press a wrong pitch, a wrong octave and an extra key, including black keys: each shows its colour and
   symbol (✕ ▢ ◆) on exactly that key; the hint text appears under the keyboard.
3. Ask for help on a note that is a black key: that key shows the blue "?" and nothing next to it changes.
4. Hold a cluster of ten neighbouring keys: every key is marked and no mark lies on another key.
5. Press the sustain pedal: the indicator shows it as before.
6. View the same picture in greyscale: pressed, wrong pitch, wrong octave, extra, help and nothing are all told apart.
