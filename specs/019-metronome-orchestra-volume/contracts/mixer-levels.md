# Contract: Metronome and Orchestra levels (UI, settings, engine, worklet)

**Version**: `1.0.0` (new, feature 019). Owners: `src/ui/elements/mx-transport.ts`, new
`src/ui/elements/mx-levels-panel.ts`, `src/ui/state/transportState.ts`, `src/app/session.ts`,
`src/app/play-session.ts`, `src/engine/audio/web-audio-engine.ts`, `src/engine/worklets/score-player.processor.ts`,
`src/engine/storage/local-settings-store.ts`. Decisions: research R-5 to R-7, R-11 to R-13.

## 1. UI

- Toolbar: a button **Levels** right after the Volume slider (`aria-haspopup="dialog"`, `aria-expanded`), opening the
  panel `'sound'` (ui-shell 1.5.0: a non-modal `popover="auto"` panel like the others; open/close never pauses or stops
  playback or a session).
- Panel content, in order:
  1. `<label>Metronome <input type="range" data-id="metronome-level" min="0" max="100" step="5"> <output>100 %</output></label>`
     with the hint "Heard in Play mode".
  2. `<label>Orchestra <input type="range" data-id="orchestra-level" ...> <output>60 %</output></label>`; when the open
     Score has no Orchestra (or no Score is open): `disabled`, `aria-describedby` -> "This score has no orchestra".
     Disabling never changes the stored value.
- `input` events apply the level at once; values are persisted debounced with the other user settings
  (`SettingsStore.save`, flushed on `pagehide`).
- Keyboard: Tab reaches both sliders; arrows step by `MIXER_LEVEL_STEP`; Escape closes the panel and returns focus to
  the Levels button.
- User-visible strings live in `src/ui/i18n/en.ts` (`transport.levels`, `levels.metronome`, `levels.orchestra`,
  `levels.metronomeHint`, `levels.noOrchestra`, `levels.valuePercent`).

## 2. Settings (view-settings 2.2.0, storage table)

`musicanyya.settings.v1`, object version **3**:

```ts
interface UserSettings {
  version: 3;
  volume: number;          // unchanged
  scale: number;           // unchanged
  follow: boolean;         // unchanged
  overlays: OverlayFlags;  // unchanged
  metronomeLevel: number;  // integer 0..100, default METRONOME_LEVEL_DEFAULT
  orchestraLevel: number;  // integer 0..100, default ORCHESTRA_LEVEL_DEFAULT
}
```

Reading: versions 1 and 2 as today plus the two defaults; a value that is not an integer in 0..100 -> its default.
Writing: always version 3. One stored value for all Scores (FR-007).

## 3. Engine port (ports 2.2.0)

```ts
interface AudioEngine {
  // existing ...
  /** 0..100. Held by the engine; sent now and to every new worklet node; applied as CC11 on Orchestra channels. */
  setOrchestraLevel(level: number): void;
  liveNoteOn(key: number, velocity: number, channel?: number): void;   // channel defaults to LIVE_CHANNEL
  liveNoteOff(key: number, channel?: number): void;
}
```

The Metronome level uses the existing `setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(muted, level))`,
called when a run's schedule is loaded, when the mute changes and when the level changes.

## 4. Worklet protocol (1.5.1 -> 1.6.0, MINOR)

| `type` | Payload | Effect |
|---|---|---|
| `orchestraLevel` | `{ gain: number }` | New. 0..1; a non-finite gain is ignored, others clamped. Held in pre-allocated state; CC11 = `round(gain * 127)` on every channel of the current `orchestraMask`, in `port.onmessage`, effective at the next block. |
| `schedule` | `ScheduleMessage` + optional `orchestraMask: number` | When the channel setup is applied, also CC11: held Orchestra level on mask channels, 127 on every other used channel. A missing or non-integer mask = 0. |
| `live` | adds optional `channel: number` | 0..15, default `LIVE_CHANNEL`; the `LiveQueue` stores it in a pre-allocated `Uint8Array`. A channel outside 0..15, `PERCUSSION_CHANNEL` or `METRONOME_CHANNEL` -> dropped and counted in `liveDropped` (Practice never sends Orchestra notes on the percussion
channel, orchestra-score §5, so a drop here is always a fault). `allOff` also releases every channel in `orchestraMask`. |

Real-time rules (Constitution I): nothing new runs in `process()` except reading the channel slot of a queued live
event; no allocation per message or per block. Reviewed by `rt-audio-reviewer`.

## 5. Behaviour

| Situation | Result |
|---|---|
| Level change while playing / paused / stopped | Applied at the next block; sounding Orchestra notes follow; nothing retriggered; no timing change. |
| New Score loaded | Orchestra level re-applied to its mask; non-Orchestra channels CC11 = 127. |
| Metronome muted | Silent at any level; un-muting plays at the current level. |
| Audio device change / new worklet node | Engine re-sends `volume` and `orchestraLevel`; the session re-sends the Metronome channel volume with the run schedule. |
| Level 0 | Silent (CC 0); everything else unchanged. |

## 6. Tests (minimum)

Settings round trip and migration (v1, v2, invalid values); worklet: `orchestraLevel` sets CC11 on mask channels only,
schedule setup resets other channels to 127, live channel field validated and applied, no allocation (existing
no-alloc harness); offline render: Orchestra level 0 vs piano-only within `ORCHESTRA_SILENT_TOLERANCE_DBFS`, a
sustained note's level follows a mid-note change, onsets identical at 0 / 50 / 100 (SC-001, SC-002); Metronome level
50 halves the click channel's CC7 and leaves other channels; e2e: panel opens without pausing, sliders work, disabled
state on a Score without Orchestra, values survive a reload (browser and Electron).
