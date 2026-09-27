# Data Model: Tempo as an Editable BPM Number

Feature 012. Builds on 001 data-model section 3 (timeline, tempo map) and section 5 (transport), and on 003 `RunSettings`.
Research decisions are referenced as R-n ([research.md](research.md)).

## 1. Beat (`TempoBeat`, new, `src/core/score/model.ts`)

The note value one BPM counts (spec FR-003), as an exact length in quarter notes.

| Field | Type | Rule |
|---|---|---|
| `type` | `NoteTypeValue` | MusicXML note-type-value of `<beat-unit>`: `1024th` ... `16th`, `eighth`, `quarter`, `half`, `whole`, `breve`, `long`, `maxima` |
| `dots` | `0..3` | count of `<beat-unit-dot/>` after that `<beat-unit>` (more than 3: the mark is ignored, R-2) |
| `quartersNum` / `quartersDen` | integers, `> 0` | exact length: base length x (2 - 1/2^dots); dotted quarter = 3/2, double-dotted half = 7/2, eighth = 1/2 |

Derived only by `beatOf(type, dots)` (core, pure). The Metronome's beat (`beatTicksAt`, `src/core/timeline/beat.ts`) is
expressed as a `TempoBeat` by `metronomeBeatAt(measureIndex, measures)`: compound meters give a dotted note of the
`<time>` denominator, all others one note of the denominator (the existing rule, unchanged).

## 2. Tempo mark (`TempoMark`, extended)

| Field | Type | Change |
|---|---|---|
| `measureIndex`, `onsetInMeasure` | as today | - |
| `qpmNum` / `qpmDen` | as today | quarter notes per minute that are **played** (sound tempo first, else metronome mark, R-3) |
| `beat` | `TempoBeat \| null` | **new**: note value of the `<metronome>` mark in the same direction; `null` when the direction has only `<sound tempo>` |
| `isDefault` | `boolean` | **new**: `true` only for the mark inserted when the Score has no usable tempo (`DEFAULT_TEMPO_QPM`) |

Validation (parser, R-2): a tempo is usable when its quarter-notes-per-minute is finite and within
`[TEMPO_MARK_QPM_MIN, TEMPO_MARK_QPM_MAX]`; otherwise the mark is dropped, exactly as a zero or text-only tempo is
today (the Score still opens, Constitution III). `<per-minute>` is read by `parsePerMinute`: a plain number, an
optional leading "c." / "ca." / "circa", or a range whose first number is used; anything else is unreadable.
Metric modulations (two `<beat-unit>`s), `<metronome-note>` forms, `<beat-unit-tied>` and an unknown or missing
`<beat-unit>` give no tempo and no beat from the mark (a `<sound tempo>` in the same direction still applies, with
`beat: null`). The old silent "x1" fallback for unknown units is removed.

## 3. Tempo display segment (`TempoDisplaySegment`, new, `src/core/tempo/tempo-display.ts`)

Piecewise-constant over the unrolled timeline, built from the same passes as the tempo map (001 R-8.5), so repeats,
jumps and the global lead-in shift line up with playback.

| Field | Type | Rule |
|---|---|---|
| `startTick` | `Ticks` | same tick space as `PlaybackTimeline.tempo` |
| `qpmNum` / `qpmDen` | integers | the played tempo of the segment (equal to the tempo map at that tick) |
| `beat` | `TempoBeat` | the mark's own beat; else the beat of the last earlier mark (in playback order) that had one, unless a `<time>` change lies between them; else the Metronome's beat at that measure - *unless no mark with its own beat has appeared anywhere in the Score yet, in which case quarter notes* (R-4 refined by T048, spec FR-003) |
| `beatSource` | `'mark' \| 'inherited' \| 'metronome'` | where `beat` came from (tests and the accessible description) |
| `isDefault` | `boolean` | from the mark (FR-002 "default") |

Derived values (pure functions, contracts/tempo-display.md):

- `writtenBpm(seg)` = `(qpmNum / qpmDen) / (quartersNum / quartersDen)` - may be fractional (e.g. 67.5).
- `shownBpm(seg, percent)` = `roundHalfUp(writtenBpm(seg) * percent / 100)` - always a whole number (spec "Rounding").
- `bpmLimits(seg)` = `[max(1, ceil(writtenBpm * TEMPO_PERCENT_MIN / 100)), floor(writtenBpm * TEMPO_PERCENT_MAX / 100)]`;
  if the interval is empty (a written tempo under 1 BPM cannot occur, R-2), the field is read-only at `shownBpm(seg, 100)`.
- `percentForBpm(seg, bpm)` = `100 * clamp(bpm, bpmLimits) / writtenBpm(seg)` - the factor the engine uses.

A new segment starts wherever the played tempo **or** the beat **or** `isDefault` changes (a beat-only change still
changes what is shown, even though the tempo map ignores it). A `<time>` change with no mark of its own starts a
segment only when it changes the (fallback) beat.

"Differs from written" (FR-005, the "written NN" hint) compares whole numbers: `shownBpm(seg, percent) !==
shownBpm(seg, 100)`, so the field never reads "67 BPM (written 67)" (R-5).

## 4. Tempo factor (`tempoPercent`, meaning widened)

The single scaling quantity the Audio engine, the Metronome, the schedule and grading already use (001 FR-011,
003 FR-037). It stays a percentage of the written tempo, so every consumer keeps working unchanged (R-1).

| Where | Before | After |
|---|---|---|
| Range | integers 25..200, multiple of 5 | any finite number in `[TEMPO_PERCENT_MIN, TEMPO_PERCENT_MAX]` = [25, 200] |
| `clampTempoPercent` | rounds to a step of 5, clamps | clamps; a non-finite value gives `TEMPO_PERCENT_DEFAULT` |
| Transport (Listen / Practice) | persisted in `UserSettings`, carried to the next Score | **not persisted**; reset to 100 on every Score open (FR-015) |
| `RunSettings.tempoPercent` (Play) | integer 25..200 step 5, stored per Score | finite 25..200, stored per Score; older stored integers read as they are |
| `Grade.settings.tempoPercent` / Performance record | integer | the exact number the run used (JSON / structured clone round-trips it exactly, R-1) |

Scaling the whole Score by one factor is what makes FR-012 hold: setting 45 BPM where 60 is written gives 75%, and the
90 section then plays at 67.5 and shows 68.

## 5. Tempo reference position (which segment the field shows)

| Situation | Reference tick |
|---|---|
| Listen, playing or paused | the audible cursor tick (the one `mx-score-view` draws the cursor at) |
| Listen, stopped | `TransportSnapshot.startTick` (the tick Play starts from; a measure click moves it, FR-004) |
| Practice, session running | the tick of the expected event the session waits at (`transportState.positionTick`) |
| Practice, no session | the first pass of the chosen start measure, else 0 |
| Play, run in progress | the run cursor's timeline tick (009 `playCursorAt`) |
| Play, no run | the first pass of the run range's first measure, else 0 |

`mx-score-view` publishes the index of the display segment at the reference tick into `tempoPositionState` (new UI
store, same "costs nothing when unchanged" rule as `runPositionState`); the session publishes the rest positions.

## 6. Tempo field states (`mx-tempo-field`)

```text
            focus / type                Enter, blur (valid)          value applied
  [showing] ------------> [editing] ------------------------> [showing]
      ^                      |  Escape, blur (empty / not a number)
      |                      +----------------------------------------> [showing] (value restored, nothing sent)
      |  run starts (Play)          run ends
      +--------------------> [locked] ----------> [showing]
```

- **showing**: the input shows `shownBpm(segment, percent)`; it follows segment and factor changes live.
- **editing**: the input has focus and its text differs from the shown value; live updates do **not** overwrite the
  text (FR-007), but the "written" hint and beat symbol still follow.
- **locked**: a Play run is active; the value is shown, the input is read-only and the step and reset controls are
  disabled (FR-017).
- Step up/down (the -/+ buttons, ArrowUp/ArrowDown in the input; no PageUp/PageDown, R-6):
  `shownBpm +/- TEMPO_BPM_STEP`, clamped, applied at once.
- Reset: `percent = TEMPO_PERCENT_DEFAULT`; disabled while `percent === TEMPO_PERCENT_DEFAULT` (FR-011).

## 7. Named constants (`src/core/defaults.ts`; data-model 001 section 10 is updated)

| Constant | Value | Change / why |
|---|---|---|
| `TEMPO_PERCENT_MIN` / `MAX` / `DEFAULT` | 25 / 200 / 100 | unchanged (FR-008) |
| `TEMPO_PERCENT_STEP` | 5 | **removed**: the factor is no longer stepped (FR-009); Play's percentage list goes too |
| `TEMPO_BPM_STEP` | 1 | new: one press of a step control (FR-010) |
| `TEMPO_MARK_QPM_MIN` / `MAX` | 10 / 1000 | new: a tempo outside is treated as unusable (spec edge "absurdly large", R-2) |
| `TEMPO_BEAT_DOTS_MAX` | 3 | new: more dots than this make the mark unusable (R-2) |
| `TEMPO_BPM_DIGITS_MAX` | 4 | new: longest number the tempo field accepts (spec edge "four digits", analyze A9) |
| `DEFAULT_TEMPO_QPM` | 100 | unchanged; shown in the Metronome's beat with "(default)" |
