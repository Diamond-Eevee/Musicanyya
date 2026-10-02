# Data Model: Guide Voice in Play Mode

**Feature**: `020-play-guide-voice` | **Date**: 2026-10-02 | Decisions: [research.md](research.md)

No persisted data changes: no settings field, no storage version, no Performance log field. The Guide voice exists only
in a Play run's compiled schedule.

## 1. `PlayScheduleOptions` (core, `src/core/play/types.ts`)

| Field | Type | Change | Rule |
|---|---|---|---|
| `guide` | `boolean` | **new, required** | `true`: play the graded notes as the Guide voice when the timeline has no Orchestra (R-1, R-2). `false`: today's behaviour (graded notes dropped). |

Callers: `PlaySessionController.start` and `SessionController.prepareStoredRun` pass `true`. Tests that check today's
dropping pass `false`.

## 2. `PlaySchedule` (core, `src/core/schedule/play-schedule.ts`)

| Field | Type | Change | Rule |
|---|---|---|---|
| `guideChannel` | `number \| null` | **new** | The channel the Guide voice plays on; `null` when `guide` is false, the timeline has an Orchestra, no event is graded, or no melodic channel is free. |

## 3. The Guide voice in the run timeline

Derived, never stored. For each `SoundingEvent` `ev` of the Score timeline inside the range whose `members` intersect
`gradedNoteIds`, when `guideChannel !== null`:

| Field | Value |
|---|---|
| `channel` | `guideChannel` |
| `key` | `ev.key` (sounding pitch) |
| `velocity` | `max(1, round(ev.velocity * GUIDE_VELOCITY_SCALE))` (never above 127) |
| `startTick`, `endTick` | `ev.startTick + shift`, `ev.endTick + shift` (the run's count-in shift) |
| `head`, `members`, `part` | copied from `ev` (never read for grading; the schedule encoding ignores them) |

The guide channel's `ChannelSetup` in the run timeline only:
`{ used: true, program: GUIDE_PROGRAM, bankMsb: 0, percussion: false, volume: null, pan: null, orchestra: true }`
(CC7 / CC10 then come from the defaults, §4 and research R-10) - `orchestra: true` here means "governed by the Orchestra level" (it lands in `orchestraMask`).

**Guide channel choice**: the lowest channel `c` in 0..15 with `!timeline.channels[c].used` and `c` not
`PERCUSSION_CHANNEL`, `LIVE_CHANNEL`, `METRONOME_CHANNEL`.

**Has an Orchestra**: `timeline.channels.some((ch) => ch.used && ch.orchestra)`.

### State: whether a run gets a Guide voice

```text
guide option false ------------------------------> no Guide voice (graded notes dropped, as before 020)
guide option true
  |-- timeline has an Orchestra -----------------> no Guide voice; Orchestra plays (019)
  |-- no graded event in range ------------------> no Guide voice (nothing to guide)
  |-- no free melodic channel -------------------> no Guide voice; run unchanged otherwise
  `-- otherwise ---------------------------------> Guide voice on guideChannel, level = Orchestra level
```

## 4. Named constants (`src/core/defaults.ts`)

| Name | Value | Meaning |
|---|---|---|
| `GUIDE_PROGRAM` | `7` | 0-based GM program of the Guide voice: Clavinet (GeneralUser GS 2.0.3); was 4, the mellow "Tine Electric Piano", then 5, "FM Electric Piano", both too mellow next to the piano (R-5, owner 2026-10-02) |
| `GUIDE_VELOCITY_SCALE` | `1` | Guide velocity = written velocity x this, at least 1 (R-5); was 0.6, then 0.9; 1 keeps the Score's own dynamics; the level against the piano was measured only for the tine and FM presets (about 1.5 dB under at 100 % for FM), not yet for the clavinet - by ear first (owner, 2026-10-02, OD-1) |
| `DEFAULT_CHANNEL_VOLUME` | `100` | CC7 sent at tick 0 on every used channel whose setup has no `volume` (GM / synth reset value) (R-10) |
| `DEFAULT_CHANNEL_PAN` | `64` | CC10 sent at tick 0 on every used channel whose setup has no `pan` (centre) (R-10) |
| `GUIDE_QUIETER_MIN_DB` | `6` | Test tolerance for SC-002: at `ORCHESTRA_LEVEL_DEFAULT` the guide is at least this much below the piano |

Unchanged and reused: `ORCHESTRA_LEVEL_DEFAULT` (60), `EXPRESSION_CONTROLLER` (11), `ORCHESTRA_SILENT_TOLERANCE_DBFS`,
`VOICE_HEADROOM_FRACTION`.

## 5. Schedule channel setup (`compileSchedule`, R-10)

For every channel with `used: true` except `METRONOME_CHANNEL` (its CC7 is the session's `channelVolume`, R-10), the
tick-0 control changes are: CC0 = `bankMsb` (only when > 0, unchanged),
program, **CC7 = `volume ?? DEFAULT_CHANNEL_VOLUME`**, **CC10 = `pan ?? DEFAULT_CHANNEL_PAN`** (both now always
present). Unused channels get nothing. No other field changes.

## 6. UI strings (`src/ui/i18n/en.ts`)

| Key | Change | Text |
|---|---|---|
| `levels.noOrchestra` | removed | ("This score has no orchestra") |
| `levels.guideVoice` | new | "No orchestra in this score: sets the guide voice in Play mode" |
