# Quickstart: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Feature**: `009-play-cursor-metronome`

## Build, run, check

```bash
pnpm install
pnpm dev            # browser, http://localhost:5173
pnpm test           # includes the real-synth click test (tests/engine/metronome-click.test.ts)
pnpm lint && pnpm typecheck && pnpm test:e2e
```

Nothing new to install; no new setting.

## Seeing it without a MIDI keyboard

`pnpm screenshot` gains a dev-only `--run` option (task in `tasks.md`): switch to Play, press Start with the faked MIDI
device the e2e tests use, then run `--keys` steps. The key-step grammar gains `sleep:<ms>` (wall-clock wait, so the
run advances). `--grade` waits for the Grade before the picture is taken; without it the picture is taken after the
last step, mid-run.

```bash
# cursor mid-run (count-in of one 3/8 measure at the written tempo, then ~2 s of music)
pnpm screenshot -- --item repertoire/beginner/fur-elise-theme-16-bar --run --keys "sleep:3500"
# Grade with correct notes, a wrong pitch, a wrong octave and silence
pnpm screenshot -- --item repertoire/beginner/fur-elise-theme-16-bar --run --grade --keys "sleep:1300,+76,-76,+75,-75,+74,-74,+64,-64"
```

Open the PNG the command prints. Never report a check as done without looking at it (AGENTS.md 8).

## Manual verification

Use a real MIDI keyboard in Chrome or Edge, and the desktop app for SC-010 (`pnpm electron:dev`).

### US1 - Cursor during a run

1. Open `repertoire/beginner/fur-elise-theme-16-bar`, choose **Play**, press **Start**, play nothing.
2. During the count-in: the orange bar stands at the first note; no note is highlighted.
3. After the count-in: the bar moves note by note with the clicks and the accompaniment, the notes under it are
   highlighted as in Listen, and the view follows.
4. Set tempo 60 % and a range of measures 5-8, Start: the bar starts at measure 5, moves slower, ends after 8.
5. Play the first notes correctly: they turn green and stay green while the bar passes over them.
6. Switch the cursor layer off (View panel): no bar, run unchanged. Stop the run: the bar is gone, the Grade shows.

### US2 - Metronome

1. Open `learning/chords/c-major-scale-and-chords`, Play, accompaniment off, Start, play nothing.
2. Every beat is a dry wood-block click, not a piano note; the first beat of each measure is the higher, louder
   click. With eyes closed, the owner can tell it is a metronome and where each measure starts (SC-004).
3. Mute the Metronome during the run: only the click stops. Stop, unmute, Start again: the click is back (R-02).
4. A multi-instrument Score (`tests/fixtures/musicxml/real/mozart-quartet-k387.mxl`, string quartet) in Listen:
   each part now sounds as its instrument (research R-01, 001 FR-015).

### US3 - Grade marks

1. In "Für Elise", play the first measure with one wrong pitch (D#5 -> D5), one note an octave low, skip one note and
   press one extra key; let the run end or stop it.
2. Correct heads are green (hollow heads stay hollow); the wrong pitch and the octave error are red discs at the keys
   played, in the note's column, the written head grey with the skip icon; the missed note is grey with the skip icon;
   the extra key is a red disc at the nearest note; early/late carets beside the heads; no ring or cross anywhere.
3. Click a disc and a grey note: the panel explains each in words (a wrong key in a chord: "B4 played in this
   chord; E4 not played"). Step through the mistakes: every disc and grey
   note is visited in playing order.
4. Switch the marks layer off: every mark goes. Start a new run: marks cleared.
5. Greyscale check (SC-006): take the `--grade` screenshot above and view it in greyscale; correct, wrong pitch,
   missed, extra, early and late are all distinguishable.
6. Practice: skip a note (Practice help) - it is grey with the same skip icon, not a ">" chevron (FR-016a).
