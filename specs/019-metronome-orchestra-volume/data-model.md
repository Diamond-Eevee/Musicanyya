# Data Model: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Feature**: `019-metronome-orchestra-volume` | **Date**: 2026-10-01 | Decisions: [research.md](research.md)

Additive changes to existing entities, plus two new content formats. Nothing here changes Note IDs, ticks, tempo
maps or Grades of existing Scores.

## 1. Score model (`src/core/score/model.ts`)

| Entity | Field | Type | Rule |
|---|---|---|---|
| `Part` | `orchestra` | `boolean` | `true` iff every staff of the part has `<staff-details print-object="no">` in force from its first measure (R-1). Default `false`. |
| `Note` | `printed` | `boolean` (existing, 017) | `false` for every note of an Orchestra part (in addition to `<note print-object="no">`). |
| `LoadReport` entry codes | `hiddenStaffIgnored` | warning | A staff hidden in any other way (some staves only, from a later measure, shown again): the part is treated as printed. One entry per part. |
| | `orchestraChannelsShared` | warning | More Orchestra instruments than free melodic channels; the extra ones share the last Orchestra channel (R-4). |
| | `orchestraInstrumentMissing` | warning | An Orchestra instrument without a usable `<midi-program>`: its notes are not played (never piano, FR-014). |

Validation: an Orchestra part may have any number of staves and instruments; percussion instruments in an Orchestra
part play on `PERCUSSION_CHANNEL` and are not affected by the Orchestra level (the percussion channel is shared with
printed percussion; documented limitation, no library item uses it). They sound in Listen and Play only: Practice
leaves them out of `ExpectedEvent.orchestra` (orchestra-score §5).

## 2. Timeline and schedule (`src/core/timeline/types.ts`, `src/core/schedule/compile.ts`)

| Entity | Field | Type | Rule |
|---|---|---|---|
| `ChannelSetup` | `orchestra` | `boolean` | Channel carries Orchestra instruments only. Never `true` for a channel shared with a printed part (R-4). |
| `PlaybackTimeline.spans` | (content) | `VisualSpan[]` | Excludes notes of Orchestra parts (R-3). `events` still contains them. |
| `ScheduleMessage` | `orchestraMask` | `number` (0..0xFFFF), optional, default 0 | Bit *c* set iff `channels[c].orchestra`. Kept by `mergeSchedules` (replay). |

Channel assignment order (`assignChannels`): percussion, then printed melodic instruments (existing rules), then
Orchestra instruments on free channels never used by a printed instrument (sharing a channel only with another
Orchestra instrument of the same program, or - when none is free - the last Orchestra channel).

## 3. Practice (`src/core/practice/types.ts`)

| Entity | Field / variant | Type | Rule |
|---|---|---|---|
| `OrchestraRef` | new | `SoundingRef & { channel: number }` | One Orchestra note occurrence. |
| `ExpectedEvent` | `orchestra` | `readonly OrchestraRef[]` | Orchestra notes whose onset lies in [this event's onset, next event's onset), like `accompaniment` (R-8). Never in `required` or `accompaniment`. |
| `PracticeSession` | `soundingOrchestra` | `Map<string, Ticks>` | Key `"<channel>:<key>"` -> end tick. Released by the accompaniment's rules, regardless of `accompaniment`. |
| `PracticeEffect` | `orchestraOn` | `{ channel, key, velocity, noteId }` | Start one Orchestra note on its channel. |
| | `orchestraOff` | `{ channel, key }` | Stop it. |

## 4. Play and grading

- `compilePlaySchedule`: an event on a channel with `channels[c].orchestra` is kept whatever `options.accompaniment`
  is; it is never in `gradedNoteIds` (its notes are `printed: false`).
- `buildExpectedEvents` / `buildExpectedNotes` / `buildPlayedAlongSpans`: Orchestra notes are never expected and never
  excused (R-10). No change to `RunSettings`, `Grade`, `PerformanceLog` or their stored formats.

## 5. Levels (user settings and engine)

| Entity | Field | Type | Rule |
|---|---|---|---|
| `UserSettings` (`src/engine/ports.ts`) | `version` | `3` | Reads 1, 2, 3; writes 3 (R-13). |
| | `metronomeLevel` | integer 0..100 | Default `METRONOME_LEVEL_DEFAULT` (100). Invalid -> default. |
| | `orchestraLevel` | integer 0..100 | Default `ORCHESTRA_LEVEL_DEFAULT` (60). Invalid -> default. |
| `TransportState` (`src/ui/state/transportState.ts`) | `metronomeLevel`, `orchestraLevel` | integer 0..100 | Mirrors the settings; changed by the Levels panel; persisted debounced with `volume` and `follow`. |
| `ScoreSummary.parts[]` (worker message) | `orchestra` | `boolean` | Lets the UI know whether the open Score has an Orchestra (FR-010) and name its instruments. |
| `AudioEngine` | `setOrchestraLevel(level)` | 0..100 | Held by the engine, re-sent to a new worklet node; worklet message `orchestraLevel { gain: level / 100 }`. |
| | `liveNoteOn(key, velocity, channel?)`, `liveNoteOff(key, channel?)` | | `channel` defaults to `LIVE_CHANNEL`. |

Mapping to sound:

- Metronome: CC7 on `METRONOME_CHANNEL` = `metronomeChannelVolume(muted, level)` = `muted ? 0 : level` (scaled to
  0..127 by the existing `channelVolume` message).
- Orchestra: CC11 on every channel in `orchestraMask` = `round(level / 100 * 127)`; CC11 = 127 on every other used
  channel when a schedule's setup is applied.
- Main Volume: unchanged (output gain). Final loudness = main Volume x level x the Score's own part volume.

## 6. Library content

### 6.1 Item facts (`src/core/library/types.ts` `ItemFacts`, library-index 1.3.0)

| Field | Type | Rule |
|---|---|---|
| `orchestra` | `readonly string[]`, optional | Instrument names of the Orchestra parts, in Score order; absent when the item has none. |
| all other facts | | Derived from printed parts only (Orchestra parts ignored), so `parts` counts printed parts. |
| `maxArpeggiatedSpanSemitones` | `number`, optional (conditional, R-17) | Widest one-hand chord whose notes all carry `<arpeggiate>`; such chords are left out of `maxSpanSemitones`. |

### 6.2 Orchestration definition (`content/library/orchestra/<item-slug>.json`, new, contract 1.0.0)

```text
OrchestrationDefinition
  version: 1
  itemId: string                       # e.g. "repertoire/advanced/grieg-morning-mood"
  reviewedBy, reviewedOn: string
  instruments: Instrument[]            # 1..8
    id: string                         # part id in the MusicXML, e.g. "orch-oboe"
    name: string                       # shown in the browser detail, e.g. "Oboe"
    program: 1..128                    # GM program, 1-based as in <midi-program>
    dynamics: 1..141                   # MusicXML <sound dynamics> (percent of forte) for its passages
    range: { low: midi, high: midi }   # every generated note must lie inside
  passages: Passage[]                  # ordered, non-overlapping per instrument
    instrument: string                 # an Instrument.id
    bars: { from: int, to: int }       # 1-based printed bar numbers, inclusive
    doubles: { staff: 1 | 2, pick: "top" | "bottom" | "all" }   # which piano notes, per onset (1 = right hand)
    minQuarters?: number               # only notes at least this long (e.g. 1.5 = dotted quarter); default 0
    octaves: int[]                     # 1..3 shifts in -2..2, one doubled note per shift (e.g. [0, -1] = in octaves)
    fitRange: boolean                  # true: a shifted note outside `range` moves by whole octaves into it
                                       # (false: such a note is an error)
                                       # durations are always as written (ties merged), never extended
                                       # grace notes and ornaments (trills) are never doubled
    dynamics?: 1..141                  # overrides the instrument's for this passage
```

Validation: unknown instrument ids, overlapping passages of one instrument, bars outside the piece, or a generated
note outside `range` are errors (the tool writes nothing).

### 6.3 Source manifests (source-manifest 1.2.0)

| Field | Type | Rule |
|---|---|---|
| `origin` | `"downloaded" \| "transcription"`, optional, default `"downloaded"` | `"transcription"`: our own CC0 reading of a public-domain print (`url` = that print); used for transcription B (R-15). |

### 6.3a Licences (owner decision 2026-10-01, research R-19; library-index 1.4.0, source-manifest 1.3.0)

| Item | Rule |
|---|---|
| `LIBRARY_LICENCES` (`src/core/library/licences.ts`) | `public-domain`, `CC0-1.0`, and the attribution licences `CC-BY-{2.0,2.5,3.0,4.0}`, `CC-BY-SA-{2.0,2.5,3.0,4.0}` |
| `licenceName(id)` / `licenceUrl(id)` | "CC BY-SA 4.0" / `https://creativecommons.org/licenses/by-sa/4.0/`; public domain and CC0 have a name, CC0 a URL |
| sidecar `provenance` (`downloaded`) with an attribution licence | `credit` required; `unmodified` required (boolean); `sourcePath` names a source whose manifest has the same licence |
| sidecar `provenance` (`authored`) | unchanged: `CC0-1.0` only; `basedOn` names only public-domain or CC0 sources |
| source manifest with an attribution licence | `credit` required |

### 6.4 Library item `grieg-morning-mood`

| Field | Value |
|---|---|
| id | `repertoire/<level>/grieg-morning-mood` (level from `computeLevel`; expected Advanced) |
| title / subtitle | "Morning Mood" / "Peer Gynt Suite No. 1, Op. 46 No. 1 - the composer's piano arrangement, with orchestra" |
| composer / arranger | "Edvard Grieg" / "Edvard Grieg" (the app shows "arr. Edvard Grieg"; the subtitle says it is his piano arrangement) |
| arrangement | `false` (the piano part is Grieg's own published arrangement, transcribed unchanged) |
| provenance | `origin: "downloaded"`, `licence: "public-domain"`, `source`: the IA item URL, `credit`: Schirmer 1899, fingering by Louis Oesterle; `note`: transcription method (R-15) and that the Orchestra is our own CC0 orchestration after the piano part (R-16) |
| parts | P1 Piano (2 staves, printed); then one Orchestra part per definition instrument |

## 7. Named constants (`src/core/defaults.ts`)

| Constant | Value | Used by |
|---|---|---|
| `METRONOME_LEVEL_DEFAULT` | 100 | settings, metronome |
| `ORCHESTRA_LEVEL_DEFAULT` | 60 | settings, engine (tuned at SC-007) |
| `MIXER_LEVEL_STEP` | 5 | Levels panel sliders |
| `EXPRESSION_CONTROLLER` | 11 | worklet (Orchestra level) |
| `ORCHESTRA_SILENT_TOLERANCE_DBFS` | -90 | SC-002 test |
| `VOICE_HEADROOM_FRACTION` | 0.5 | voice-count test (R-11) |

## 8. State

No new state machine. The Orchestra level and Metronome level are plain values; a change is applied immediately in
every transport phase (stopped, playing, paused) and every mode, and survives Score changes and mode switches.
