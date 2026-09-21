# Contract: persisted performances and run settings

**Version**: Performance log format `1`, IndexedDB schema `1` -> **`2`**, play-settings format `1`.
Research R-04, R-05, R-09. All data stays on the musician's device; nothing is uploaded (FR-016).

## IndexedDB database `musicanyya` (version 2)

Version 2 **adds** the object store `performances` and leaves `recentScores` exactly as feature 001 defined it.
`onupgradeneeded` must create the new store only when it is missing, so an existing database upgrades without
touching a stored Score.

Object store `performances`, keyPath `runId`, index `byScoreFinished` on `[scoreId, finishedAt]`.

```ts
interface StoredPerformanceRecord {
  runId: string;                 // crypto.randomUUID()
  scoreId: string;               // the content hash used by recentScores
  finishedAt: string;            // ISO 8601
  settings: RunSettings;         // data-model section 7
  latency: LatencyProfile;       // data-model section 8
  appVersion: string;            // from the build, so an old log is recognisable (FR-014)
  log: PerformanceLog;           // below
  summary: GradeSummary;         // denormalised for the attempt list; the Grade itself is never stored
  schema: 1;
}
```

**Retention** (FR-041): on every write, the performances of that `scoreId` are counted and the oldest are removed
until at most `PERFORMANCES_PER_SCORE_MAX = 20` remain. Deleting a performance removes its record and therefore
its recording (FR-043). Removing a Score from the recent list does **not** remove its performances; they are
removed with the Score only when the musician deletes the Score.

**Failure behaviour**: exactly as feature 001's store - a `StoreResult` with `unavailable`, `quotaExceeded` or
`notFound`, reported once as a non-blocking notice. A run that cannot be stored still produces its Grade; the
notice says the attempt was not kept.

## Performance log

```ts
interface PerformanceLog {
  version: 1;
  messages: RecordedMessage[];
  droppedMessages: number;
}

interface RecordedMessage {
  kind: "noteOn" | "noteOff" | "sustain";
  key: number;          // 0..127 (0 for sustain)
  velocity: number;     // 0..127 (0 for noteOff and sustain)
  down: boolean;        // sustain only
  audioTimeSec: number; // on the audio clock (R-04); what grading uses
  timeStampMs: number;  // raw MIDIMessageEvent.timeStamp, kept for provenance
  deviceId: string;
}
```

Normative rules:

1. Messages are stored in **recorded order** and never reordered on disk. Grading sorts a copy by
   `(audioTimeSec, key)`; the stored order is the raw fact.
2. `audioTimeSec` is produced by `clockMap.toAudioTime(timeStampMs)` at the moment of receipt, never later, so a
   log remains interpretable when the mapping drifts.
3. Everything received is recorded, including pedal and velocity, although neither is graded (FR-012, FR-023).
4. Messages received during the count-in are recorded. They are excluded from matching **except** where the first
   expected note's early claim window reaches back into the count-in: the filter is "no press earlier than
   `firstOnsetTick - claimEarly(first)`" (data-model sections 1 and 2, FR-003, D-4). Symmetrically, recording and
   matching continue for the last expected note's late claim window past the final onset.
5. `droppedMessages` counts input the app could not record (FR-015); it appears on the Grade as a reliability
   warning.
6. **Once stored, `audioTimeSec` is run-relative** (0 = the run's own tick 0, i.e. `PlayRun.startAudioTimeSec`
   already subtracted, research R-20) - the live in-memory log a running `PlayRun` accumulates is on the
   `AudioContext` clock, exactly as `GradeInput.startAudioTimeSec` expects, but that clock does not survive the
   run, so `src/app/play-session.ts` rebases the copy that reaches `PerformanceStore.put`. Regrading and replay
   both pass `startAudioTimeSec: 0` (`GradeInput`/`ReplayOptions`) to a stored log; only a *live* `GradeInput` (a
   run just finished, not yet stored) uses `PlayRun.startAudioTimeSec` itself.

## Play settings (`localStorage`)

Key `musicanyya.play.v1`, the same shape and cap as feature 002's `musicanyya.practice.v1`:

```ts
interface PlaySettingsFile {
  version: 1;
  lastUsed: RunSettings;                      // defaults for a Score never played
  byScore: Record<string, RunSettings>;       // at most PLAY_SETTINGS_MAX = 20 entries, oldest evicted
}
```

Invalid or unparsable content falls back to the built-in defaults and is overwritten on the next write; a storage
failure is reported once and never throws (feature 001's `storage.md` rule).

## Latency profile (`localStorage`)

Key `musicanyya.latency.v1`, one profile for the device:

```ts
interface LatencyProfileFile {
  version: 1;
  profile: LatencyProfile;   // data-model section 8
}
```

A stored profile is `source: "measured"`. When the key is missing, the engine reports an `assumed` profile built
from `AudioEngine.latency()`, and every Grade computed with it says so and offers to measure (FR-034).
