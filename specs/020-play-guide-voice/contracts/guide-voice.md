# Contract: Guide voice in a Play run

**Version**: `1.0.0` (new, feature 020). Owners: `src/core/schedule/play-schedule.ts`, `src/core/play/types.ts`,
`src/core/defaults.ts`, `src/app/play-session.ts`, `src/app/session.ts`, `src/ui/elements/mx-levels-panel.ts`.
Decisions: [research.md](../research.md). Data: [data-model.md](../data-model.md).

## 1. Interface (play-run 2.2.0 -> 2.3.0)

```ts
interface PlayScheduleOptions {
  // ...existing fields (range, gradedNoteIds, accompaniment, countInMeasures, tempoPercent, metronome)
  /** Play the graded notes as the Guide voice when the Score has no Orchestra (feature 020). */
  guide: boolean;
}

interface PlaySchedule {
  schedule: ScheduleMessage;
  tickMap: PlayTickMap;
  expectedFirstRunTick: number;
  /** The Guide voice's channel, or null when the run has none (data-model §3). */
  guideChannel: number | null;
}
```

## 2. Normative rules (added to play-run "The run schedule")

1. **Rule 1 (amended)**: every `SoundingEvent` whose members intersect `gradedNoteIds` is omitted from its own channel.
   With `guide: true` and a guide channel (rule 2), it is instead written once on the guide channel with the velocity
   `max(1, round(velocity * GUIDE_VELOCITY_SCALE))`, sliced and shifted like every other event (rule 3).
2. **Guide channel**: only when `guide` is true, the timeline has no used Orchestra channel, and at least one event is
   graded in range: the lowest unused channel that is not `PERCUSSION_CHANNEL`, `LIVE_CHANNEL` or
   `METRONOME_CHANNEL`; none free -> `guideChannel: null` and no guide events. Its setup (run timeline only):
   program `GUIDE_PROGRAM`, bank 0, CC7 `GUIDE_CHANNEL_VOLUME`, no pan, `orchestra: true` (so it is in
   `orchestraMask`).
3. **Accompaniment independence**: guide events are kept whatever `accompaniment` says (they are the musician's part,
   not the accompaniment); accompaniment events are never copied to the guide channel.
4. **Count-in**: no guide event starts before `countInTicks` (follows from the shift; asserted by tests).
5. **Determinism**: the same timeline, measures and options give the same schedule, byte for byte.
6. **No other change**: with `guide: false`, or when rule 2 gives no channel, the schedule is identical to play-run
   2.2.0's output for the same options.

## 3. Level (mixer-levels 1.0.0 -> 1.1.0)

- The Guide voice is governed by the Orchestra level through `orchestraMask` (worklet-protocol 1.6.x, unchanged
  behaviour): CC11 = held level on the guide channel at setup and on every `orchestraLevel` message; main Volume on top.
- UI section 1, item 2 changes: the Orchestra slider is **never disabled**. When the open Score has no Orchestra part
  (`summary.parts[].orchestra`), or no Score is open, the hint `levels.guideVoice` ("No orchestra in this score: sets
  the guide voice in Play mode") is shown below it and is its `aria-describedby`; with an Orchestra, no hint and no
  `aria-describedby`. The stored level never changes because of the hint.

## 4. Never

Guide events are never in the Performance log, the expected notes, the played-along spans, the Grade, the on-screen
piano's lit keys, the score colouring or an Advice anchor (they exist only in the `ScheduleMessage`). The Guide voice
never plays in Listen or Practice mode (those modes do not use `compilePlaySchedule`).

## 5. Tests (minimum)

Core (`tests/core/play/guide-voice.test.ts`, new): graded events land on the guide channel with scaled velocity and the
run shift; hand / part / range selection guides only those notes; accompaniment on/off leaves guide events; no guide
event before the count-in ends; tied note once; chord as simultaneous note-ons; a Score with an Orchestra (fixture
`tests/fixtures/musicxml/orchestra/piano-and-oboe.musicxml`) gets `guideChannel: null` and the 2.2.0 schedule; an
Orchestra part with no playable instrument counts as none; no free channel -> null; `guide: false` equals today's
output; `orchestraMask` contains the guide channel; replay (`compileReplay` over a guided run) contains the guide events.
Grading golden: one recorded log graded against guided and unguided run contexts and levels 0 / 60 / 100 -> identical
Grades (SC-004). Engine offline render: guide onsets at the scheduled frames at 50/100/150 % tempo (SC-001); level 0
equals the unguided render within `ORCHESTRA_SILENT_TOLERANCE_DBFS` (SC-003); at level 60 guide RMS at least
`GUIDE_QUIETER_MIN_DB` below the piano (SC-002); peak voices under `VOICE_HEADROOM_FRACTION` of the cap (R-6). E2e
(browser + Electron): Play run schedule has guide note-ons on a mask channel with `GUIDE_PROGRAM` (SC-008); the Levels
panel slider is enabled with the guide hint on a Score without an Orchestra and without the hint on one with it.
