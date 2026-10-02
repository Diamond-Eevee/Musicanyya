# Quickstart: Guide Voice in Play Mode

**Feature**: `020-play-guide-voice` | Setup and commands are unchanged (see the repository `README.md`).

## Automated checks

```bash
pnpm test -- tests/core/play/guide-voice.test.ts tests/core/schedule
pnpm test -- tests/engine/channel-carryover.test.ts tests/engine/guide-render.test.ts
pnpm test -- tests/core/play tests/core/grade tests/engine
pnpm test:e2e -- tests/e2e/levels.spec.ts tests/e2e/guide-voice.spec.ts
```

Full gate at every checkpoint: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

## Manual verification

You need a MIDI keyboard for the "play along" steps; the "play nothing" steps need none.

### FR-015 - Volume and pan never carry over

1. `pnpm dev`, open `tests/fixtures/musicxml/channels/turned-down-left.musicxml` (Open file) and press Play in Listen
   mode: quiet, from the left.
2. Open `tests/fixtures/musicxml/channels/plain.musicxml` and press Play: full loudness, centred - the same as when it is
   the first file opened after a reload.

### US1 - Hear my part softly during a Play run

1. `pnpm dev`, open a library exercise without an Orchestra (any item without the "with orchestra" marker), choose
   **Play** mode, both hands, and start a run. Play nothing.
   - The count-in clicks with no guide note.
   - From the first beat, the expected notes sound in a soft electric piano, in time with the cursor and the clicks.
2. Start again and play the right notes: your piano is clearly louder; the guide blends with it.
3. Play a wrong note on purpose: the clash with the guide is audible. The Grade shows that note as wrong pitch, as it
   would without the guide.
4. Choose the right hand only with "Hear other parts" off: only right-hand notes are guided; the left hand stays silent.
5. Open *Morning Mood* in Play mode: the Orchestra plays, no electric piano guide.
6. Listen and Practice mode on the exercise: no electric piano guide.

### US2 - Orchestra level

1. On the exercise, open **Levels**: the Orchestra slider is enabled and says "No orchestra in this score: sets the
   guide voice in Play mode". Capture it: `pnpm screenshot --item <exercise id>` and open the PNG, then open the Levels
   panel in the dev app and compare.
2. During a run, drag the Orchestra slider to 0 %: the guide fades out at once; piano, accompaniment and clicks are
   unchanged. Back to 60 %: it returns.
3. Reload: the level is kept; open *Morning Mood*: the slider shows the same value and the hint is gone.

### US3 - Replay

1. Finish a run with a few wrong notes, open it in the attempts list and replay it: the guide plays with your recorded
   notes; at 0 % the replay sounds as before this feature.

### Owner listening check (OD-1, SC-007)

On two items without an Orchestra (one hands-together piece, one single-hand exercise), at the default level, the owner
judges: is the guide clearly a different, soft sound that helps tell right from wrong notes without covering the piano?
Answers may change `GUIDE_VELOCITY_SCALE` or `GUIDE_PROGRAM` (`src/core/defaults.ts`).
