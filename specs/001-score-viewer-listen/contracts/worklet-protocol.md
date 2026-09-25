# Contract: `score-player` AudioWorklet protocol

**Version**: `1.4.0`. Messages between `WebAudioEngine` (main thread) and the `ScorePlayerProcessor`
(`src/engine/worklets/score-player.processor.ts`, registered as `"musicanyya-score-player"`). Research R-10.
`1.1.0` (feature 002, T057, 2026-09-20): adds the `liveDropped` message, posted from `port.onmessage`'s `'live'`
case (not from `process()`) whenever the 64-entry live queue is full - a dropped `noteOn`/`noteOff` would otherwise
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
  (1.1.0) is unbounded in principle but fires only when the 64-entry live queue overflows - an exceptional condition,
  not a per-block event - and is posted from `port.onmessage`, the same off-hot-path handler as `status`/`ended`.
- A throw inside `process()` is prevented by construction (bounds checks); a caught failure in a message handler
  sends `status: error` and keeps the processor alive, returning `true` from `process()`.

## Main thread -> processor

| `type` | Payload | Effect |
|---|---|---|
| `init` | `{ protocol: "1.0.0", sampleRate: number, maxBlock: 128 }` | Allocate buffers, reply `status: initialised` |
| `soundBank` | `{ bytes: ArrayBuffer }` (transferred) | Build the SoundFont bank, reply `status: soundReady` or `status: error` |
| `schedule` | `ScheduleMessage` (below, buffers transferred) | Stop, all notes off, replace schedule, position = start tick, apply the channel setup (1.4.0) |
| `play` | `{ fromTick?: number }` | Start/resume at current (or given) tick at the next block |
| `pause` | `{}` | Stop advancing; release sounding scheduled notes (note-off with release) |
| `stop` | `{ returnTick: number }` | Pause + position = `returnTick` |
| `seek` | `{ tick: number }` | All scheduled notes off (release), jump; keeps playing state |
| `tempo` | `{ percent: number }` | 25..200; new ticks-per-frame from the next block |
| `volume` | `{ gain: number }` | 0..1 linear target; ramped over `VOLUME_RAMP_FRAMES = 256` |
| `channelVolume` | `{ channel: number; gain: number }` | CC7 = `round(gain * 127)` on `channel`, applied in `port.onmessage`, effective at the next block (1.2.0) |
| `live` | `{ kind: "on" | "off" | "sustain" | "allOff", key?: number, velocity?: number, down?: boolean }` | Applied at the start of the next block on `LIVE_CHANNEL = 15` (piano) |

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
}
```

## Processor -> main thread

| `type` | Payload | When |
|---|---|---|
| `status` | `{ state: "initialised" | "soundReady" | "error" | "processorFaulted", detail?: string }` | After `init` / `soundBank`, on handler failure, or once if `process()`'s own call into `processBlock` faults (T161) |
| `position` | `{ frame: number, contextTime: number, tick: number, ticksPerFrame: number, playing: boolean }` | Every 4 blocks while playing; once after `play`/`pause`/`stop`/`seek`/`tempo`/`schedule` |
| `ended` | `{ frame: number }` | The end tick was reached; the processor paused itself |
| `liveDropped` | `{ total: number }` | A `live` message arrived while the 64-entry queue was already full (1.1.0) |

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
