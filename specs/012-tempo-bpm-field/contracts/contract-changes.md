# Contract changes to earlier features (feature 012)

Each change below is applied to the named contract file with the version bump shown, as part of the implementation
tasks (AGENTS.md section 6: contract first, then code). Reasons: [research.md](../research.md).

| Contract | From -> to | Change |
|---|---|---|
| `001/contracts/worker-messages.md` | 1.2.0 -> **1.3.0** (MINOR) | `TimelineDto` gains `tempo: TempoDisplaySegment[]` (tempo-display.md 1.1.0; R-8). The Verovio worker's `ready.glyphs` gains `noteheadHalf`, `noteheadWhole`, `flag8thUp` path data (R-7). Additive only. |
| `001/data-model.md` section 2 / Score model | - | `TempoMark` gains `beat: TempoBeat \| null` and `isDefault: boolean` (012 data-model section 2). Parser rules R-2: all note-type-values, 0-3 dots, `parsePerMinute`, no x1 fallback, qpm bounds. |
| `001/data-model.md` section 10 | - | Remove `TEMPO_PERCENT_STEP`; add `TEMPO_BPM_STEP`, `TEMPO_MARK_QPM_MIN`/`MAX`, `TEMPO_BEAT_DOTS_MAX`, `TEMPO_BPM_DIGITS_MAX` (012 data-model section 7). |
| `001/contracts/worklet-protocol.md` | 1.4.0 -> **1.4.1** (PATCH, wording) | `tempo.percent` is any finite number in [25, 200], no longer an integer multiple of 5. Message shape unchanged. |
| `004/contracts/view-settings.md` (`musicanyya.settings.v1`, format 2) | 2.0.0 -> **2.1.0** (MINOR) | `tempoPercent` is deprecated: no longer written, and ignored when read (FR-015, R-9). Files with or without it validate; format version stays 2. `UserSettings` (engine ports) drops the field. |
| `001/contracts/storage.md` | note only | Points to view-settings 2.1.0 for `tempoPercent`. |
| `003/contracts/play-run.md` | 2.0.0 -> **2.1.0** (MINOR) | `RunSettings.tempoPercent`: any finite number in [25, 200] (was integer, multiple of 5). |
| `003/contracts/performance-log.md` (play-settings format 1) | wording | `RunSettings.tempoPercent` validation: finite number in [25, 200]; older integer values stay valid. `lastUsed.tempoPercent` is no longer applied to a Score never played (R-9). Format version unchanged (every old file is still valid). |
| `003/contracts/grading.md` | 1.2.0 -> **1.2.1** (PATCH, wording) | `settings.tempoPercent` may be fractional; grading formulas unchanged. Golden results unchanged. |
| `005/contracts` library index | none | `tempoBpm` keeps its meaning (quarter notes per minute); a library test pins that every item's first mark counts quarters (R-10). |

The engine ports contract (`src/engine/ports.ts`: `AudioEngine.setTempoPercent(percent: number)`) is unchanged in
shape; its doc comment drops "integer".
