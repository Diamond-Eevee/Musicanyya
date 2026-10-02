# Contract: `score-player` AudioWorklet protocol

**Version**: `1.7.0` (MINOR, feature 020-play-guide-voice, no message shape and no worklet change; research
[020 R-10](../../020-play-guide-voice/research.md), contract [020 guide-voice.md](../../020-play-guide-voice/contracts/guide-voice.md)):
(a) the tick-0 setup of every used channel except `METRONOME_CHANNEL` always contains CC7 (`volume ?? DEFAULT_CHANNEL_VOLUME`
= 100) and CC10 (`pan ?? DEFAULT_CHANNEL_PAN` = 64), so no channel keeps the volume or pan a previous schedule left on it
(spec 020 FR-015); the Metronome channel's CC7 stays the session's `channelVolume` (a deferred setup, `setupPending`,
must never override it); at most 16 x 3 = 48 setup controllers, under `MAX_SETUP_CONTROLLERS`; (b) wording:
`orchestraMask` = the channels the Orchestra level governs - Orchestra instruments, or the Guide voice's channel in a Play
run. `1.6.1` (PATCH, feature 019 T080: `LIVE_QUEUE_CAPACITY` 64 -> 256 - one Practice input on *Morning Mood* sends up to 94 `live` messages (the Orchestra's offs and ons plus the accompaniment), and the queue must hold that twice over; no message changes). `1.6.0` (MINOR, feature 019-metronome-orchestra-volume, additive; full text:
[019 mixer-levels.md](../../019-metronome-orchestra-volume/contracts/mixer-levels.md) section 4): new message
`orchestraLevel { gain }` (CC11 = `round(gain * 127)` on every channel of the schedule's `orchestraMask`, applied in
`port.onmessage`); `ScheduleMessage.orchestraMask?` (bit *c* = channel *c* is an Orchestra channel; a missing or
non-integer mask is 0) and, when the channel setup is applied, CC11 = the held Orchestra level on the mask channels and
127 on every other used channel; `live` gains optional `channel` (0..15, default `LIVE_CHANNEL`, stored in the
pre-allocated queue; a channel outside 0..15, `PERCUSSION_CHANNEL` or `METRONOME_CHANNEL` is dropped and counted in
`liveDropped`); `allOff` also releases every channel of `orchestraMask`. Nothing new runs in `process()` except reading
the channel slot of a queued live event.
`1.5.1` (PATCH, feature 017-leftover-sweep T031-T033, from the RT review T015; no message shape change):
the tick fields `play.fromTick`, `stop.returnTick` and `seek.tick` are **validated** like `tempo.percent` - one that
is not a finite number counts as absent (`play` plays on from the held tick, `stop` returns to 0, `seek` is ignored),
a finite one is clamped to [0, `endTick`] (a NaN tick used to silence the Score, a negative one threw in the handler).
The `volume` gain is now **applied** to the rendered output, per sample (it was ramped but never multiplied in, so the
volume control had no effect, 001 FR-016); a `volume` message whose `gain` is not a finite number is ignored - it used
to set the target to 0 and, now that the gain is applied, would have muted the output (T029). `live` messages are queued in a pre-allocated ring of
`LIVE_QUEUE_CAPACITY` slots (no object per message); the behaviour is unchanged.
Tests: `score-player.tick-validation.test.ts`, `score-player.volume.test.ts`, `live-queue.test.ts`.
`1.5.0` (MINOR, feature 017-leftover-sweep T013, from 001 T167; additive): `position` gains `lateEvents`,
the running count of schedule events that sounded after their own frame, at the start of a later render block - late,
never lost: events left over from a block whose dispatch state was full (1024 per block), or re-anchored before the block
by a tempo change. Each late event is counted once, when it sounds (RT review T015 N1; named `dispatchDeferred` before
that review, never released). Carried in the existing report (no new message, nothing extra
posted from `process()`); the main thread shows it in diagnostics (Constitution I: late events are counted and shown).
The `position` and `ended` messages are one pre-allocated object each, filled in per report (017 T009): a consumer that
keeps one must copy it. A `live` message is validated in the port handler (017 T005): one that is malformed (unknown
`kind`, `key`/`velocity` not an integer in 0..127) is dropped and counted in `liveDropped`, like a full queue.
Tests: `tests/engine/worklets/dispatch-overflow.test.ts`, `score-player.no-alloc.test.ts`,
`score-player.live-validation.test.ts`.
`1.4.2` (PATCH, feature 012-tempo-bpm-field, T054, found by the RT review T036; no message shape change):
a `tempo` message is **position-preserving** - the new rate starts at the tick the playhead is at (it used to re-anchor at the
seek/stop tick, restarting the piece on every message while playing) - and **validated**: a non-number or non-finite `percent` is
ignored, a finite one is clamped to [25, 200]. The playhead is held while nothing plays: `pause` keeps the tick it paused at, a bare
`play` resumes from it however long the pause or the idle time was (it used to skip ahead by that time), a `tempo` while
paused/stopped keeps it, and `play` after `ended` starts again from the return tick. `position.ticksPerFrame` is the rate of the
segment the reported tick is in (it was the last segment's). Tests: `tests/engine/worklets/score-player.tempo.test.ts`.
`1.4.1` (PATCH, wording, feature 012-tempo-bpm-field: `tempo.percent` is any finite number in [25, 200],
no longer an integer multiple of 5 - the message shape and the processor's handling are unchanged, R-11). `1.4.0`. Messages between `WebAudioEngine` (main thread) and the `ScorePlayerProcessor`
(`src/engine/worklets/score-player.processor.ts`, registered as `"musicanyya-score-player"`). Research R-10.
`1.1.0` (feature 002, T057, 2026-09-20): adds the `liveDropped` message, posted from `port.onmessage`'s `'live'`
case (not from `process()`) whenever the live queue (`LIVE_QUEUE_CAPACITY` entries, 64 until 1.6.1, now 256) is full - a dropped `noteOn`/`noteOff` would otherwise
leave the matcher believing a key was released that never actually reached the synth, and Practice mode's
accompaniment roughly doubles the live message rate (specs/002-practice-wait-mode/research.md R-16).
`1.2.0` (feature 003, T034/T036, 2026-09-21): `process()` now renders each block in the sub-blocks `dispatch.ts`'s
`DispatchState.splits` marks out, applying every event at its own frame instead of at the block boundary (research
R-02, SC-002) - no message shape changed for this. Adds the `channelVolume` message (also R-02), CC7 on one
channel applied in `port.onmessage`, used to mute the Play mode Metronome without touching the schedule.
`1.3.0` (feature 001, T161, 2026-09-25): adds `status: { state: "processorFaulted", detail? }`. A throw from the
synth or the dispatch math inside `process()` previously escaped uncaught and permanently silenced the processor
(the host stops calling `process()` once it throws) with no diagnostic. `processBlock` now catches it, sets an
internal `faulted` flag (never cleared - the processor stays quiet for the rest of the session rather than risk
continuing from unknown state) and posts this message exactly once.
`1.4.0` (feature 009, T022/T024, 2026-09-25, no message shape change): the processor now APPLIES a schedule's channel setup,
which it used to drop (research 009 R-01, B-1/B-2: every part and the Play Metronome sounded as piano). On `schedule` it copies
`channelSetup` and the tick-0 `controlChange` events into pre-allocated state (`MAX_SETUP_CONTROLLERS = 64`) and, once the sound
bank is loaded, applies them in `port.onmessage`: for each channel with `used = 1`, in this order, drum flag (`isPercussion`), bank
select (CC0 = `bankMsb`), program, then the other tick-0 controllers (volume, pan). A schedule that arrives before the bank is
loaded is applied once, when the sound becomes ready: the AudioWorklet wrapper calls the factory's `soundReady()` right after
`addSoundBank`, in the same handler. `process()` still never applies event kinds 2 and 3: the compilers emit them only at tick 0
(pinned by `tests/core/schedule/setup-events.test.ts`), so the handler is the only place they are needed. More than
`MAX_SETUP_CONTROLLERS` tick-0 controllers: the first 64 are applied and `status: error` is posted once (no throw). The synth port
(`createScorePlayerProcessor` options) gains the optional `programChange(channel, program)` and `setDrums(channel, isDrum)`,
which the wrapper maps to spessasynth_core's `programChange` and `midiChannels[channel].setDrums`. Consequence: a Score's own
`<volume>` and `<pan>` now take effect too (001 research: CC7 / CC10), where they were dropped before.

Constitution I rules for the processor (checked by `rt-audio-reviewer`):

- `process()` never allocates, awaits, logs or throws, except for the bounded `postMessage` reports described
  below. Scratch buffers are allocated in the constructor; schedule arrays and the sound bank are set in the message
  handler, never in `process()`.
- Messages *to* the processor are handled in `port.onmessage` (between render blocks) and only update pre-allocated
  state; the heavy exception is `soundBank` (builds the bank; happens before sound is needed).
- Messages *from* the processor are bounded: `position` at most every `POSITION_REPORT_BLOCKS = 4` blocks while
  playing (and once after each command), `ended`, `status`. `postMessage` clones the payload (a small allocation in
  the worklet's GC heap); this bounded rate is the constitution's "bounded, batched messages" allowance. `liveDropped`
  (1.1.0) is unbounded in principle but fires only when the live queue (`LIVE_QUEUE_CAPACITY` entries) overflows - an exceptional condition,
  not a per-block event - and is posted from `port.onmessage`, the same off-hot-path handler as `status`/`ended`.
- A throw inside `process()` is prevented by construction (bounds checks); a caught failure in a message handler
  sends `status: error` and keeps the processor alive, returning `true` from `process()`.

## Main thread -> processor

| `type` | Payload | Effect |
|---|---|---|
| `init` | `{ protocol: "1.0.0", sampleRate: number, maxBlock: 128 }` | Allocate buffers, reply `status: initialised` |
| `soundBank` | `{ bytes: ArrayBuffer }` (transferred) | Build the SoundFont bank, reply `status: soundReady` or `status: error` |
| `schedule` | `ScheduleMessage` (below, buffers transferred) | Stop, all notes off, replace schedule, position = start tick, apply the channel setup (1.4.0), then CC11: the held Orchestra level on `orchestraMask` channels and 127 on every other used channel (1.6.0) |
| `play` | `{ fromTick?: number }` | Start/resume at the held tick (after `pause`, `stop`, `seek`, a new schedule; the return tick after `ended`) or at `fromTick`, at the next block (1.4.2); `fromTick` clamped to [0, `endTick`], ignored unless finite (1.5.1) |
| `pause` | `{}` | Stop advancing; release sounding scheduled notes (note-off with release) |
| `stop` | `{ returnTick: number }` | Pause + position = `returnTick` (clamped to [0, `endTick`]; 0 unless finite, 1.5.1) |
| `seek` | `{ tick: number }` | All scheduled notes off (release), jump; keeps playing state. `tick` clamped to [0, `endTick`]; a non-finite one is ignored (1.5.1) |
| `tempo` | `{ percent: number }` | any finite number in [25, 200] (1.4.1), otherwise ignored / clamped (1.4.2); new ticks-per-frame from the next block, at the current position (1.4.2) |
| `orchestraLevel` | `{ gain: number }` | 0..1; a non-finite gain is ignored, others clamped; held in pre-allocated state; CC11 = `round(gain * 127)` on every channel of the current `orchestraMask`, in `port.onmessage`, effective at the next block (1.6.0, feature 019) |
| `volume` | `{ gain: number }` | 0..1 linear target; ramped over `VOLUME_RAMP_FRAMES = 256`, applied to the output per sample; a non-finite or non-number `gain` is ignored (1.5.1) |
| `channelVolume` | `{ channel: number; gain: number }` | CC7 = `round(gain * 127)` on `channel`, applied in `port.onmessage`, effective at the next block (1.2.0) |
| `live` | `{ kind: "on" | "off" | "sustain" | "allOff", key?: number, velocity?: number, down?: boolean, channel?: number }` | Applied at the start of the next block on `channel` (0..15, default `LIVE_CHANNEL = 15`, piano; 1.6.0); a malformed one, or one whose `channel` is outside 0..15, `PERCUSSION_CHANNEL` or `METRONOME_CHANNEL`, is dropped and counted in `liveDropped` (1.5.0, 1.6.0); `allOff` also releases every channel of `orchestraMask` (1.6.0) |

```ts
interface ScheduleMessage {
  type: "schedule";
  ppq: number;                              // integer ticks per quarter note of this Score
  endTick: number;                          // < 2^31
  // events sorted by (tick, kind: noteOff before noteOn, then program changes first at equal tick)
  eventTick: Int32Array;                    // length n
  eventKind: Uint8Array;                    // 0 = noteOff, 1 = noteOn, 2 = programChange, 3 = controlChange
  eventChannel: Uint8Array;                 // 0..15 (9 = percussion, 14 reserved for the Play mode Metronome, 15 reserved for live input)
  eventData1: Uint8Array;                   // key / program / controller
  eventData2: Uint8Array;                   // velocity / value
  // tempo segments sorted by tick, first at tick 0; exact tempo = qpmNum / qpmDen quarter notes per minute
  tempoTick: Int32Array; tempoQpmNum: Int32Array; tempoQpmDen: Int32Array;
  channelSetup: Uint8Array;                 // 16 x [used, program, bankMsb, isPercussion]
  orchestraMask?: number;                   // 0..0xFFFF, bit c = channel c is governed by the Orchestra level (an Orchestra
                                            // instrument, or the Guide voice in a Play run, 1.7.0); missing = 0 (1.6.0)
}
```

## Processor -> main thread

| `type` | Payload | When |
|---|---|---|
| `status` | `{ state: "initialised" | "soundReady" | "error" | "processorFaulted", detail?: string }` | After `init` / `soundBank`, on handler failure, or once if `process()`'s own call into `processBlock` faults (T161) |
| `position` | `{ frame: number, contextTime: number, tick: number, ticksPerFrame: number, playing: boolean, lateEvents: number }` (`lateEvents` 1.5.0) | Every 4 blocks while playing; once after `play`/`pause`/`stop`/`seek`/`tempo`/`schedule` |
| `ended` | `{ frame: number }` | The end tick was reached; the processor paused itself |
| `liveDropped` | `{ total: number }` | A `live` message arrived while the queue (`LIVE_QUEUE_CAPACITY` = 256 entries since 1.6.1) was already full (1.1.0), or was malformed (1.5.0) |

`frame` is the processor's block-start frame counter (`currentFrame` of the AudioWorkletGlobalScope), `contextTime`
the matching `currentTime`; the main thread maps them to audible time with `getOutputTimestamp()` (R-11).

## Timing rules

- An event at tick `t` in segment `s` is dispatched at frame
  `f = s.startFrame + ceil((t - s.startTick) / ticksPerFrame)`, within the block containing `f`, by rendering the
  block in pieces split at each such `f`. Dispatch order within one frame follows the sorted schedule.
- `ticksPerFrame = ppq * qpm * tempoPercent / (60 * 100 * sampleRate)`, computed by `src/core/tempo/rate.ts`
  (the same function used by core tests). Segment start frames are recomputed when tempo percentage changes or on
  seek; there is no floating accumulation across blocks.
- Commands take effect at the start of the next block (<= 128 frames).
