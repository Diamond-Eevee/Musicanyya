import { type MIDIController, SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';

/**
 * Score player processor – offline-testable factory.
 *
 * The actual `AudioWorkletProcessor` subclass lives here but wraps the
 * same logic so that the pure function can be unit-tested in Node via
 * `createScorePlayerProcessor`.
 *
 * See contracts/worklet-protocol.md for the full message protocol.
 * See data-model §5 and research R-10 for design rationale.
 *
 * Constitution I compliance:
 *  - `processBlock()` (= `process()` in the worklet) does NOT allocate,
 *    await, log or throw.  All arrays are pre-allocated.
 *  - The heavy `soundBank` init happens in the message handler (outside
 *    `process()`), which is allowed per contract. So does the channel setup
 *    (drum flag, bank, program, tick-0 controllers): it is stored on `schedule`
 *    and applied in the handler once the sound is ready, never in `process()`
 *    (009 research R-01; worklet-protocol 1.4.0).
 *  - Position reports are bounded to every POSITION_REPORT_BLOCKS blocks.
 */

import {
  LIVE_CHANNEL,
  LIVE_QUEUE_CAPACITY,
  MAX_SETUP_CONTROLLERS,
  POSITION_REPORT_BLOCKS,
  TEMPO_PERCENT_DEFAULT,
  TEMPO_PERCENT_MAX,
  TEMPO_PERCENT_MIN,
  VOLUME_DEFAULT,
  VOLUME_RAMP_FRAMES,
} from '../../core/defaults.js';
import type { ScheduleMessage } from '../../core/schedule/compile.js';
import { EVENT_KIND } from '../../core/schedule/compile.js';
import {
  type BlockEvent,
  DispatchState,
  dispatchBlock,
  frameOfTickInSegs,
  recomputeSegmentFrames,
  type TempoSegmentFrame,
} from './dispatch.js';
import { LIVE_KIND, LiveQueue, liveKindOf } from './live-queue.js';

export interface SynthInterface {
  noteOn(channel: number, key: number, velocity: number, frame?: number): void;
  noteOff(channel: number, key: number, frame?: number): void;
  allNotesOff?(channel?: number): void;
  controllerChange?(channel: number, controller: number, value: number): void;
  /** Selects a channel's instrument (009 R-01). Called from the message handler only, never from `processBlock`. */
  programChange?(channel: number, program: number): void;
  /** Turns a channel into a drum channel or back (the Metronome's, a percussion part's); executes a program change. */
  setDrums?(channel: number, isDrum: boolean): void;
  /**
   * Render `sampleCount` frames starting at `startIndex` of `left`/`right` (T034, research R-02).
   * `processBlock` calls this once per sub-block, split at each event's own dispatch frame, so
   * every note-on/off and Metronome click lands at its exact sample rather than the block edge.
   */
  process?(left: Float32Array, right: Float32Array, startIndex: number, sampleCount: number): void;
}

/** Minimal synth used by RecordingSynth-based tests. */
export interface SimpleSynth {
  noteOn(key: number, velocity: number): void;
  noteOff(key: number): void;
}

export type ProcessorMessage =
  | { type: 'status'; state: 'initialised' | 'soundReady' | 'error' | 'processorFaulted'; detail?: string }
  | {
      type: 'position';
      frame: number;
      contextTime: number;
      tick: number;
      ticksPerFrame: number;
      playing: boolean;
      /** Events that sounded after their own frame (a full block, a tempo re-anchor), since the processor started (1.5.0). */
      lateEvents: number;
    }
  | { type: 'ended'; frame: number }
  | { type: 'liveDropped'; total: number };

/**
 * A live MIDI event forwarded from the main thread while a session runs.
 *
 * Typed rather than `any` so the queue drain in `processBlock` cannot silently read a field that was
 * never sent - the drain is on the real-time path, where a wrong read is a stuck note (tasks.md T139).
 */
export type LiveMessage =
  | { type: 'live'; kind: 'on'; key: number; velocity: number }
  | { type: 'live'; kind: 'off'; key: number }
  | { type: 'live'; kind: 'sustain'; down: boolean }
  | { type: 'live'; kind: 'allOff' };

/**
 * Anything the main thread may post in. The processor switches on `type`, so the envelope is what
 * matters here; each branch narrows to the concrete message it needs (`ScheduleMessage` and friends).
 */
export type InboundMessage = { type: string; [field: string]: unknown };

/**
 * All Sound Off (CC 120) and All Notes Off (CC 123) on one channel, or on all 16 (017 T007, from 001 T163). A plain
 * index loop: the wrapper used to build `[c]` or `[0..15]` on every call, and it is called from the live drain inside
 * `process()` (Constitution I).
 */
export function soundOffChannels(
  controllerChange: (channel: number, controller: number, value: number) => void,
  channel?: number,
): void {
  const first = channel ?? 0;
  const last = channel ?? 15;
  for (let c = first; c <= last; c++) {
    controllerChange(c, 120, 0);
    controllerChange(c, 123, 0);
  }
}

/**
 * Never throws (T161's own catch bodies use this): a hostile thrown value whose `.toString()` throws must not
 * turn the fault-reporting path into the very escape from `process()` the guard exists to prevent.
 */
function safeErrorDetail(err: unknown): string {
  try {
    return err instanceof Error && err.message ? err.message : String(err);
  } catch {
    return 'unknown';
  }
}

export interface ScorePlayerProcessor {
  /** Called by the test harness instead of AudioWorkletProcessor.process(); blockSize = left.length. */
  processBlock(left: Float32Array, right: Float32Array): void;
  /** Deliver an inbound message (plays the role of port.onmessage). */
  receiveMessage(msg: InboundMessage): void;
  /**
   * Tells the processor the sound bank is loaded (the AudioWorklet wrapper calls it after `addSoundBank`, in the message
   * handler). A channel setup that arrived with a schedule before that is applied now, once.
   */
  soundReady(): void;
  /** Outbound message callback (plays the role of port.postMessage). */
  onMessage: ((msg: ProcessorMessage) => void) | null;
}

export interface ScorePlayerOptions {
  synth: SynthInterface;
  sampleRate: number;
  tempoPercent?: number;
  volume?: number;
}

export interface PortMessageDeps {
  /** Hands a message to the processor (`ScorePlayerProcessor.receiveMessage`). */
  receive(msg: InboundMessage): void;
  /** Loads the SoundFont bytes into the synth and marks the sound ready; may throw on a bad file. */
  loadSoundBank(bytes: unknown): void;
  /** Posts to the main thread (`port.postMessage`). */
  post(msg: unknown): void;
}

/**
 * The worklet's `port.onmessage` (017 T011, from 001 T166): the data on the port is untyped, so the envelope is checked
 * before anything reads it - a payload that is not an object with a string `type` is ignored - and every branch runs
 * inside a `try`, so nothing thrown here escapes the handler. Runs off the render quantum.
 */
export function createPortMessageHandler(deps: PortMessageDeps): (data: unknown) => void {
  return (data) => {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return;
    const msg = data as { type?: unknown; [field: string]: unknown };
    if (typeof msg.type !== 'string') return;
    const inbound = msg as InboundMessage;
    try {
      if (inbound.type === 'init') {
        deps.post({ type: 'status', state: 'initialised' });
      } else if (inbound.type === 'soundBank') {
        deps.loadSoundBank(inbound.bytes);
        deps.post({ type: 'status', state: 'soundReady' });
      } else {
        deps.receive(inbound);
      }
    } catch (err) {
      try {
        deps.post({ type: 'status', state: 'error', detail: safeErrorDetail(err) });
      } catch {
        // best-effort diagnostic only: nothing thrown here may leave the handler
      }
    }
  };
}

/** Factory for offline testing (no AudioWorklet globals required). */
export function createScorePlayerProcessor(opts: ScorePlayerOptions): ScorePlayerProcessor {
  const { synth, sampleRate } = opts;

  let schedule: ScheduleMessage | null = null;
  let segs: TempoSegmentFrame[] = [];
  let eventCursor = 0;
  const dispatchState = new DispatchState();

  let playing = false;
  let currentFrame = 0;
  let currentTick = 0;
  let returnTick = 0; // tick to return to on stop
  // Where the playhead sits while nothing plays (stopped, paused, before the first play, after the end). `currentFrame`
  // keeps counting through idle blocks, so the segment frame anchors only describe the position while playing; a
  // resume or a tempo change re-anchors them at this tick (worklet-protocol 1.4.2, feature 012 T054).
  let holdTick = 0;
  let atEnd = false; // the end tick was reached: the next `play` starts again from `returnTick`

  let tempoPercent = opts.tempoPercent ?? TEMPO_PERCENT_DEFAULT;
  // Checked like the `volume` message (017 T034, RT review): finite and within 0..100, else the default.
  const initialVolume =
    typeof opts.volume === 'number' && Number.isFinite(opts.volume)
      ? Math.max(0, Math.min(100, opts.volume))
      : VOLUME_DEFAULT;
  let targetGain = initialVolume / 100;
  let currentGain = targetGain;
  let gainStep = 0;
  let gainRampRemaining = 0;

  let blocksSinceReport = 0;
  let pendingReport = false; // send one extra report after a command

  // The two messages posted from inside the render quantum, allocated once and filled in each time (017 T009, from
  // 001 T164): `postMessage` clones synchronously, so reusing them is safe; a consumer that keeps a report must copy it.
  const positionReport = {
    type: 'position' as const,
    frame: 0,
    contextTime: 0,
    tick: 0,
    ticksPerFrame: 0,
    playing: false,
    lateEvents: 0,
  };
  const endedReport = { type: 'ended' as const, frame: 0 };

  // Held note tracking for all-notes-off on pause/stop/seek
  // One flag per (channel, key), in storage allocated once: noteOn/noteOff run inside process() and the Metronome adds one per beat
  // (Constitution I: no allocation there, which a Set's add/delete may do when it grows).
  const heldNotes = new Uint8Array(16 * 128); // index (channel << 7) | key
  let heldCount = 0;

  // Channel setup (009 R-01, data-model section 4): copied out of the schedule message into pre-allocated storage, applied
  // only from the message handler, when the sound is ready. 16 x [used, program, bankMsb, isPercussion].
  const channelSetup = new Uint8Array(64);
  const setupControllers = new Int16Array(3 * MAX_SETUP_CONTROLLERS); // channel, controller, value
  let setupControllerCount = 0;
  let setupPending = false;
  let soundIsReady = false;

  const liveQueue = new LiveQueue(LIVE_QUEUE_CAPACITY); // pre-allocated slots, nothing per message (017 T031)
  let liveDropped = 0; // T057: counted and shown like the other dropouts (Constitution I)

  let onMessage: ((msg: ProcessorMessage) => void) | null = null;

  function post(msg: ProcessorMessage): void {
    onMessage?.(msg);
  }

  /** The tempo segment the playhead is in: by frame while playing, by `holdTick` otherwise. `segs` is never empty once a
   *  schedule is loaded. Walked backwards by index, not `[...segs].reverse().find(...)`: that copied the array,
   *  reversed the copy and allocated a closure on every call, and this is called from inside the render quantum via
   *  sendPositionReport() - roughly 94 allocations a second at POSITION_REPORT_BLOCKS = 4. Constitution I forbids
   *  allocating in process(). */
  function currentSegment(): TempoSegmentFrame {
    let seg = segs[0]!;
    for (let i = segs.length - 1; i >= 0; i--) {
      const candidate = segs[i]!;
      if (playing ? candidate.startFrame <= currentFrame : candidate.startTick <= holdTick) {
        seg = candidate;
        break;
      }
    }
    return seg;
  }

  /**
   * A tick field of `play`/`stop`/`seek`, checked at the trust boundary like `tempo.percent` (017 T032, from RT review
   * T015 N5): null unless it is a finite number, which is clamped to [0, endTick] (without a schedule, to >= 0). A NaN
   * tick made every segment anchor NaN and the Score silent without an error; a negative one threw.
   */
  function validTick(raw: unknown): number | null {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const clamped = raw < 0 ? 0 : raw;
    return schedule !== null && clamped > schedule.endTick ? schedule.endTick : clamped;
  }

  function computeCurrentTick(): number {
    if (!schedule || segs.length === 0 || !playing) return schedule ? holdTick : returnTick;
    const seg = currentSegment();
    return seg.startTick + (currentFrame - seg.startFrame) * seg.ticksPerFrame;
  }

  function sendPositionReport(): void {
    positionReport.frame = currentFrame;
    positionReport.contextTime = currentFrame / sampleRate;
    positionReport.tick = computeCurrentTick();
    positionReport.ticksPerFrame = segs.length > 0 ? currentSegment().ticksPerFrame : 0;
    positionReport.playing = playing;
    positionReport.lateEvents = dispatchState.lateTotal;
    post(positionReport);
    blocksSinceReport = 0;
    pendingReport = false;
  }

  function allNotesOff(): void {
    if (heldCount === 0) return;
    for (let encoded = 0; encoded < heldNotes.length; encoded++) {
      if (heldNotes[encoded] === 0) continue;
      synth.noteOff((encoded >> 7) & 0xf, encoded & 0x7f);
      heldNotes[encoded] = 0;
    }
    heldCount = 0;
  }

  function noteOn(channel: number, key: number, velocity: number): void {
    synth.noteOn(channel, key, velocity);
    const index = ((channel & 0xf) << 7) | (key & 0x7f);
    if (heldNotes[index] === 0) {
      heldNotes[index] = 1;
      heldCount++;
    }
  }

  function noteOff(channel: number, key: number): void {
    synth.noteOff(channel, key);
    const index = ((channel & 0xf) << 7) | (key & 0x7f);
    if (heldNotes[index] !== 0) {
      heldNotes[index] = 0;
      heldCount--;
    }
  }

  function applyEvent(ev: BlockEvent): void {
    if (ev.kind === EVENT_KIND.noteOn) noteOn(ev.channel, ev.data1, ev.data2);
    else if (ev.kind === EVENT_KIND.noteOff) noteOff(ev.channel, ev.data1);
    // Kinds 2 (programChange) and 3 (controlChange) are never applied here: the compilers emit them only at tick 0, and
    // the message handler applies them as the channel setup (009 R-01, guarded by tests/core/schedule/setup-events.test.ts).
  }

  /**
   * Copies the schedule's channel setup and its tick-0 controller events into the pre-allocated storage. The events are
   * sorted by tick, so the scan stops at the first later one. More than MAX_SETUP_CONTROLLERS: the first ones are kept and
   * one error is reported (never a throw).
   */
  function storeChannelSetup(sched: ScheduleMessage): void {
    channelSetup.fill(0);
    if (sched.channelSetup) channelSetup.set(sched.channelSetup.subarray(0, channelSetup.length));
    setupControllerCount = 0;
    let overflow = false;
    const n = sched.eventTick.length;
    for (let i = 0; i < n && (sched.eventTick[i] ?? 1) <= 0; i++) {
      if (sched.eventKind[i] !== EVENT_KIND.controlChange) continue;
      if (setupControllerCount >= MAX_SETUP_CONTROLLERS) {
        overflow = true;
        continue;
      }
      const at = setupControllerCount * 3;
      setupControllers[at] = sched.eventChannel[i] ?? 0;
      setupControllers[at + 1] = sched.eventData1[i] ?? 0;
      setupControllers[at + 2] = sched.eventData2[i] ?? 0;
      setupControllerCount++;
    }
    if (overflow) {
      post({ type: 'status', state: 'error', detail: `more than ${MAX_SETUP_CONTROLLERS} setup controllers` });
    }
  }

  /**
   * For every channel the schedule uses: drum flag, bank select, program, then the tick-0 controllers (volume, pan, ...).
   * Runs in the message handler, between render blocks, because a program change resolves a preset and may allocate.
   */
  function applyChannelSetup(): void {
    setupPending = false;
    let failure: string | null = null;
    for (let channel = 0; channel < 16; channel++) {
      const at = channel * 4;
      if (channelSetup[at] === 0) continue;
      const isDrum = channelSetup[at + 3] === 1;
      try {
        synth.setDrums?.(channel, isDrum);
        // A drum channel picks its kit by program alone; a bank select there is not sent (the synth resolves drums itself).
        if (!isDrum) synth.controllerChange?.(channel, 0, channelSetup[at + 2] ?? 0);
        synth.programChange?.(channel, channelSetup[at + 1] ?? 0);
        for (let i = 0; i < setupControllerCount; i++) {
          const c = i * 3;
          if (setupControllers[c] !== channel || setupControllers[c + 1] === 0) continue; // bank select is above
          synth.controllerChange?.(channel, setupControllers[c + 1] ?? 0, setupControllers[c + 2] ?? 0);
        }
      } catch (err) {
        // One channel's bad program or bank must not leave the others unconfigured or the sound never announced: go on
        // with the next channel and report once (never a throw out of the handler).
        failure ??= safeErrorDetail(err);
      }
    }
    if (failure !== null) post({ type: 'status', state: 'error', detail: failure });
  }

  function reloadSchedule(): void {
    if (!schedule) return;
    segs = recomputeSegmentFrames(schedule, returnTick, currentFrame, sampleRate, tempoPercent);
    eventCursor = 0;
    // Skip events before the current position
    const n = schedule.eventTick.length;
    while (eventCursor < n) {
      const tick = schedule.eventTick[eventCursor]!;
      const frame = frameOfTickInSegs(tick, segs);
      if (frame >= currentFrame) break;
      eventCursor++;
    }
  }

  /** New segment frames anchored at `tick` = the current frame (a tempo change, a resume): the position does not move
   *  and the event cursor already points at the next event that has not sounded, so it is left alone. */
  function reanchor(tick: number): void {
    if (!schedule) return;
    segs = recomputeSegmentFrames(schedule, tick, currentFrame, sampleRate, tempoPercent);
  }

  function receiveMessage(msg: InboundMessage): void {
    switch (msg.type) {
      case 'schedule': {
        const sched = msg as unknown as ScheduleMessage;
        storeChannelSetup(sched); // first: a malformed schedule throws here, before any state has changed
        schedule = sched;
        playing = false;
        allNotesOff();
        currentTick = 0;
        returnTick = 0;
        holdTick = 0;
        atEnd = false;
        currentFrame = 0;
        reloadSchedule();
        if (soundIsReady) applyChannelSetup();
        else setupPending = true; // applied by soundReady(), once
        break;
      }
      case 'play': {
        const fromTick = validTick(msg.fromTick); // not a finite number: as if absent - play on from where it is
        if (fromTick !== null) {
          allNotesOff();
          returnTick = fromTick;
          holdTick = fromTick;
          atEnd = false;
          currentFrame = 0; // simplified: reset frame to 0 at seek
          reloadSchedule();
        } else if (atEnd) {
          // Played to the end and asked to play again: start over, the event cursor is at the end of the schedule.
          atEnd = false;
          allNotesOff();
          holdTick = returnTick;
          currentFrame = 0;
          reloadSchedule();
        } else if (!playing) {
          reanchor(holdTick); // resume (or first play after idle blocks): continue from the held tick
        }
        playing = true;
        pendingReport = true;
        break;
      }
      case 'pause': {
        holdTick = computeCurrentTick(); // before `playing` goes false: the tick the playhead is at now
        playing = false;
        allNotesOff();
        pendingReport = true;
        break;
      }
      case 'stop': {
        playing = false;
        allNotesOff();
        returnTick = validTick(msg.returnTick) ?? 0; // not a finite number: as if absent
        holdTick = returnTick;
        atEnd = false;
        currentFrame = 0;
        if (schedule) reloadSchedule();
        pendingReport = true;
        break;
      }
      case 'seek': {
        const tick = validTick(msg.tick);
        if (tick === null) break; // not a finite number: nothing to seek to
        allNotesOff();
        returnTick = tick;
        holdTick = tick;
        atEnd = false;
        currentFrame = 0; // simplified: reset frame to 0 on seek; in real processor this is audio-clock based
        if (schedule) reloadSchedule();
        pendingReport = true;
        break;
      }
      case 'tempo': {
        // Validated here, at the trust boundary: NaN or Infinity would make every frame anchor NaN and silence the
        // Score without a throw. A finite value outside the range is clamped like the main thread does.
        const raw = msg.percent;
        if (typeof raw !== 'number' || !Number.isFinite(raw)) break;
        tempoPercent = Math.min(TEMPO_PERCENT_MAX, Math.max(TEMPO_PERCENT_MIN, raw));
        // Position-preserving: the new rate starts at the tick the playhead is at now (feature 012 FR-013). Only the
        // tempo segments are recomputed (a handful of objects); the event schedule is not rescanned.
        reanchor(computeCurrentTick());
        pendingReport = true;
        break;
      }
      case 'volume': {
        const raw = msg.gain as number;
        targetGain = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
        gainStep = (targetGain - currentGain) / VOLUME_RAMP_FRAMES;
        gainRampRemaining = VOLUME_RAMP_FRAMES;
        break;
      }
      case 'channelVolume': {
        // CC7 on one channel, applied here (off the hot path) rather than queued, so it takes
        // effect at the very next block per contracts/worklet-protocol.md 1.2.0 - used to mute the
        // Metronome without touching the schedule (research R-02). `gain` is 0..1 linear, the same
        // convention as the `volume` message above.
        const channel = msg.channel as number;
        const rawGain = msg.gain as number;
        const gain = Number.isFinite(rawGain) ? Math.max(0, Math.min(1, rawGain)) : 0;
        synth.controllerChange?.(channel, 7, Math.round(gain * 127));
        break;
      }
      case 'live': {
        // Checked here, off the render quantum, and written into a pre-allocated slot: no object per message (017 T031).
        const kind = liveKindOf(msg);
        const queued =
          kind !== 0 &&
          liveQueue.push(
            kind,
            typeof msg.key === 'number' ? msg.key : 0,
            typeof msg.velocity === 'number' ? msg.velocity : 0,
            msg.down === true,
          );
        if (!queued) {
          // Malformed (017 T005) or past the queue's capacity: dropped, not queued. A stuck note or a missed release
          // is worse than briefly not knowing about it, but it must still be counted and shown (Constitution I,
          // R-16). Posted here, not from process(): this handler already runs off the per-block hot path, same as
          // the 'status' and 'ended' messages.
          liveDropped++;
          post({ type: 'liveDropped', total: liveDropped });
        }
        break;
      }
    }
  }

  function renderSegment(left: Float32Array, right: Float32Array, startIndex: number, sampleCount: number): void {
    if (sampleCount > 0) synth.process?.(left, right, startIndex, sampleCount);
  }

  let faulted = false; // T161: once true, stay silent rather than risk repeating whatever just threw

  /**
   * Guards `processBlockInner` (T161): an uncaught throw from the synth or the dispatch math inside `process()`
   * would otherwise escape the AudioWorkletProcessor's `process()` and permanently silence it with no
   * diagnostic - the host stops calling `process()` once it throws. Caught here instead, reported once via the
   * existing message channel (already used for `position`/`ended`/`liveDropped`, all posted synchronously from
   * inside a block like this one), and the processor goes quiet on purpose from then on rather than risk
   * corrupting audio by continuing from unknown state.
   */
  function processBlock(left: Float32Array, right: Float32Array): void {
    if (faulted) return;
    try {
      processBlockInner(left, right);
    } catch (err) {
      faulted = true;
      // Nested: post() ultimately reaches structured clone, which could itself throw; the fault-reporting path
      // must never become the throw that escapes process() (rt-audio-reviewer finding on this task).
      try {
        post({ type: 'status', state: 'processorFaulted', detail: safeErrorDetail(err) });
      } catch {
        // best-effort diagnostic only - the processor is already faulted and staying silent either way
      }
    }
  }

  function processBlockInner(left: Float32Array, right: Float32Array): void {
    const blockSize = left.length;

    // Live input first, at the block start. Reads the queued slots by position and then consumes exactly the ones it
    // applied (017 T031; T014's invariant): an early stop would leave the rest queued, never lose them. The handler cannot
    // add entries meanwhile: port messages run between render quanta, never during one (run-to-completion).
    const liveCount = liveQueue.size;
    for (let i = 0; i < liveCount; i++) {
      const kind = liveQueue.kindAt(i);
      if (kind === LIVE_KIND.on) {
        synth.noteOn(LIVE_CHANNEL, liveQueue.keyAt(i), liveQueue.velocityAt(i));
      } else if (kind === LIVE_KIND.off) {
        synth.noteOff(LIVE_CHANNEL, liveQueue.keyAt(i));
      } else if (kind === LIVE_KIND.sustain) {
        synth.controllerChange?.(LIVE_CHANNEL, 64, liveQueue.downAt(i) ? 127 : 0);
      } else if (kind === LIVE_KIND.allOff) {
        synth.allNotesOff?.(LIVE_CHANNEL);
      }
    }
    liveQueue.consume(liveCount);

    renderBlock(left, right, blockSize);
    applyGain(left, right, blockSize);
  }

  /**
   * The playback volume (017 T033, from RT review T015 N6; 001 FR-016): the `volume` message set a ramped gain that was
   * never applied, so the volume control had no effect. Scales the rendered block in place, sample by sample, ramping
   * over `VOLUME_RAMP_FRAMES` from the moment the message arrived (no click). No allocation (Constitution I).
   */
  function applyGain(left: Float32Array, right: Float32Array, blockSize: number): void {
    if (gainRampRemaining <= 0 && currentGain === 1) return;
    for (let i = 0; i < blockSize; i++) {
      if (gainRampRemaining > 0) {
        gainRampRemaining--;
        currentGain = gainRampRemaining === 0 ? targetGain : currentGain + gainStep;
      }
      left[i] = (left[i] as number) * currentGain;
      right[i] = (right[i] as number) * currentGain;
    }
  }

  /** Renders one block of the Score (or silence-with-live-input while idle), splitting at each event's frame. */
  function renderBlock(left: Float32Array, right: Float32Array, blockSize: number): void {
    if (!playing || !schedule) {
      renderSegment(left, right, 0, blockSize);
      currentFrame += blockSize;
      if (pendingReport) sendPositionReport();
      return;
    }

    dispatchBlock(schedule, segs, currentFrame, blockSize, eventCursor, dispatchState);
    eventCursor = dispatchState.nextEventCursor;

    // Render each sub-block bounded by dispatchState.splits, applying every event at its own
    // frame before rendering past it - not all at once at the block boundary (T034, research R-02).
    let renderStart = 0; // block-relative
    let evIdx = 0;
    for (let i = 0; i < dispatchState.numSplits; i++) {
      const splitFrame = dispatchState.splits[i]!; // absolute frame
      const splitOffset = splitFrame - currentFrame; // block-relative
      renderSegment(left, right, renderStart, splitOffset - renderStart);
      renderStart = splitOffset;
      while (evIdx < dispatchState.numEvents && dispatchState.events[evIdx]!.frame === splitFrame) {
        applyEvent(dispatchState.events[evIdx]!);
        evIdx++;
      }
    }

    currentFrame += blockSize;
    blocksSinceReport++;

    if (dispatchState.endReached) {
      holdTick = computeCurrentTick(); // where the end was reached, before `playing` goes false
      playing = false;
      atEnd = true;
      allNotesOff();
      endedReport.frame = dispatchState.endFrame ?? currentFrame;
      post(endedReport);
      sendPositionReport();
      return;
    }

    if (pendingReport || blocksSinceReport >= POSITION_REPORT_BLOCKS) {
      sendPositionReport();
    }
  }

  function soundReady(): void {
    soundIsReady = true;
    if (setupPending) applyChannelSetup();
  }

  const processor: ScorePlayerProcessor = {
    processBlock,
    receiveMessage,
    soundReady,
    get onMessage() {
      return onMessage;
    },
    set onMessage(v) {
      onMessage = v;
    },
  };

  return processor;
}

if (typeof AudioWorkletProcessor !== 'undefined') {
  class ScorePlayerAudioWorklet extends AudioWorkletProcessor {
    private inner: ScorePlayerProcessor;
    private synth: SpessaSynthProcessor;
    private soundReady = false;
    private faulted = false; // T161 backstop: processBlockInner already guards itself; this covers anything else

    constructor() {
      super();
      // sampleRate is a global in AudioWorkletGlobalScope
      this.synth = new SpessaSynthProcessor(sampleRate);
      // One bound callback for every notes-off, made here, not per call (017 T007).
      // Our port takes a plain CC number; spessasynth types its parameter as the MIDIController union of the
      // controllers it knows. The cast is the narrow one, not `any` (tasks.md T139).
      const controllerChange = (c: number, ctrl: number, v: number) =>
        this.synth.controllerChange(c, ctrl as MIDIController, v);

      this.inner = createScorePlayerProcessor({
        synth: {
          noteOn: (c, k, v) => this.synth.noteOn(c, k, v),
          noteOff: (c, k) => this.synth.noteOff(c, k),
          allNotesOff: (c?: number) => soundOffChannels(controllerChange, c),
          controllerChange,
          programChange: (c, program) => this.synth.programChange(c, program),
          setDrums: (c, isDrum) => this.synth.midiChannels[c]?.setDrums(isDrum),
          process: (left, right, startIndex, sampleCount) => this.synth.process(left, right, startIndex, sampleCount),
        },
        sampleRate: sampleRate,
      });

      this.inner.onMessage = (msg) => {
        // `msg.frame` from the factory is a playback-local counter that resets on schedule/stop/seek/play(fromTick)
        // (needed for its own tick<->frame segment math); the contract's `frame`/`contextTime` must instead be the
        // real, monotonic AudioWorkletGlobalScope clock (never reset) so the main thread's getOutputTimestamp()
        // mapping (position-sync.ts, R-10/R-11) stays on one clock (Constitution II). Rewrite at the point of
        // emission, which happens synchronously within this block's process() call, so these globals still hold
        // this block's start values.
        // The factory's position/ended messages are its reused objects (017 T009): overwrite their clock fields in place
        // rather than spread a new object per report.
        if (msg.type === 'position') {
          msg.frame = currentFrame;
          msg.contextTime = currentTime;
          this.port.postMessage(msg);
        } else if (msg.type === 'ended') {
          msg.frame = currentFrame;
          this.port.postMessage(msg);
        } else {
          this.port.postMessage(msg);
        }
      };

      const handle = createPortMessageHandler({
        receive: (msg) => this.inner.receiveMessage(msg),
        loadSoundBank: (bytes) => {
          const bank = SoundBankLoader.fromArrayBuffer(bytes as ArrayBuffer);
          this.synth.soundBankManager.addSoundBank(bank, 'default');
          this.soundReady = true;
          // A schedule that arrived before the SoundFont gets its programs now (009 R-01), in this handler, not in process().
          this.inner.soundReady();
        },
        post: (msg) => this.port.postMessage(msg),
      });
      this.port.onmessage = (e: MessageEvent<unknown>) => handle(e.data);
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
      const output = outputs[0];
      if (!output) return true;
      const left = output[0];
      const right = output[1];
      if (!left || !right) return true;

      if (!this.soundReady || this.faulted) {
        return true;
      }

      try {
        this.inner.processBlock(left, right);
      } catch (err) {
        // processBlockInner already guards its own throws (T161) and posts a `processorFaulted` status; this
        // only fires if something outside it (a future change, not today's code) throws directly in process().
        this.faulted = true;
        try {
          this.port.postMessage({ type: 'status', state: 'processorFaulted', detail: safeErrorDetail(err) });
        } catch {
          // best-effort diagnostic only - nothing left to do if even this throws
        }
      }
      return true;
    }
  }

  registerProcessor('musicanyya-score-player', ScorePlayerAudioWorklet);
}
