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
 *    `process()`), which is allowed per contract.
 *  - Position reports are bounded to every POSITION_REPORT_BLOCKS blocks.
 */

import { POSITION_REPORT_BLOCKS, TEMPO_PERCENT_DEFAULT, VOLUME_RAMP_FRAMES } from '../../core/defaults.js';
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

export interface SynthInterface {
  noteOn(channel: number, key: number, velocity: number, frame?: number): void;
  noteOff(channel: number, key: number, frame?: number): void;
  allNotesOff?(channel?: number): void;
  controllerChange?(channel: number, controller: number, value: number): void;
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
  | { type: 'status'; state: 'initialised' | 'soundReady' | 'error'; detail?: string }
  | { type: 'position'; frame: number; contextTime: number; tick: number; ticksPerFrame: number; playing: boolean }
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

export interface ScorePlayerProcessor {
  /** Called by the test harness instead of AudioWorkletProcessor.process(); blockSize = left.length. */
  processBlock(left: Float32Array, right: Float32Array): void;
  /** Deliver an inbound message (plays the role of port.onmessage). */
  receiveMessage(msg: InboundMessage): void;
  /** Outbound message callback (plays the role of port.postMessage). */
  onMessage: ((msg: ProcessorMessage) => void) | null;
}

export interface ScorePlayerOptions {
  synth: SynthInterface;
  sampleRate: number;
  tempoPercent?: number;
  volume?: number;
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

  let tempoPercent = opts.tempoPercent ?? TEMPO_PERCENT_DEFAULT;
  let targetGain = (opts.volume ?? 80) / 100;
  let currentGain = targetGain;
  let gainStep = 0;
  let gainRampRemaining = 0;

  let blocksSinceReport = 0;
  let pendingReport = false; // send one extra report after a command

  // Held note tracking for all-notes-off on pause/stop/seek
  const heldNotes: Set<number> = new Set(); // encoded as (channel << 7) | key

  const liveQueue: LiveMessage[] = [];
  let liveDropped = 0; // T057: counted and shown like the other dropouts (Constitution I)

  let onMessage: ((msg: ProcessorMessage) => void) | null = null;

  function post(msg: ProcessorMessage): void {
    onMessage?.(msg);
  }

  function computeCurrentTick(): number {
    if (!schedule || segs.length === 0) return returnTick;
    // Walked backwards by index, not `[...segs].reverse().find(...)`: that copied the array, reversed
    // the copy and allocated a closure on every call, and this is called from inside the render
    // quantum via sendPositionReport() - roughly 94 allocations a second at
    // POSITION_REPORT_BLOCKS = 4. Constitution I forbids allocating in process().
    let seg = segs[0]!;
    for (let i = segs.length - 1; i >= 0; i--) {
      const candidate = segs[i]!;
      if (candidate.startFrame <= currentFrame) {
        seg = candidate;
        break;
      }
    }
    return seg.startTick + (currentFrame - seg.startFrame) * seg.ticksPerFrame;
  }

  function sendPositionReport(): void {
    const tpf = segs.length > 0 ? segs[segs.length - 1]!.ticksPerFrame : 0;
    post({
      type: 'position',
      frame: currentFrame,
      contextTime: currentFrame / sampleRate,
      tick: computeCurrentTick(),
      ticksPerFrame: tpf,
      playing,
    });
    blocksSinceReport = 0;
    pendingReport = false;
  }

  function allNotesOff(): void {
    for (const encoded of heldNotes) {
      const key = encoded & 0x7f;
      const channel = (encoded >> 7) & 0xf;
      synth.noteOff(channel, key);
    }
    heldNotes.clear();
  }

  function noteOn(channel: number, key: number, velocity: number): void {
    synth.noteOn(channel, key, velocity);
    heldNotes.add((channel << 7) | key);
  }

  function noteOff(channel: number, key: number): void {
    synth.noteOff(channel, key);
    heldNotes.delete((channel << 7) | key);
  }

  function applyEvent(ev: BlockEvent): void {
    if (ev.kind === EVENT_KIND.noteOn) noteOn(ev.channel, ev.data1, ev.data2);
    else if (ev.kind === EVENT_KIND.noteOff) noteOff(ev.channel, ev.data1);
    // programChange and controlChange would be forwarded to synth in the real processor
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

  function receiveMessage(msg: InboundMessage): void {
    switch (msg.type) {
      case 'schedule': {
        const sched = msg as unknown as ScheduleMessage;
        schedule = sched;
        playing = false;
        allNotesOff();
        currentTick = 0;
        returnTick = 0;
        currentFrame = 0;
        reloadSchedule();
        break;
      }
      case 'play': {
        const fromTick = msg.fromTick as number | undefined;
        if (fromTick !== undefined) {
          allNotesOff();
          returnTick = fromTick;
          currentFrame = 0; // simplified: reset frame to 0 at seek
          reloadSchedule();
        }
        playing = true;
        pendingReport = true;
        break;
      }
      case 'pause': {
        playing = false;
        allNotesOff();
        pendingReport = true;
        break;
      }
      case 'stop': {
        playing = false;
        allNotesOff();
        returnTick = (msg.returnTick as number | undefined) ?? 0;
        currentFrame = 0;
        if (schedule) reloadSchedule();
        pendingReport = true;
        break;
      }
      case 'seek': {
        const tick = msg.tick as number;
        allNotesOff();
        returnTick = tick;
        currentFrame = 0; // simplified: reset frame to 0 on seek; in real processor this is audio-clock based
        if (schedule) reloadSchedule();
        pendingReport = true;
        break;
      }
      case 'tempo': {
        tempoPercent = msg.percent as number;
        if (schedule) reloadSchedule();
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
        if (liveQueue.length < 64) {
          liveQueue.push(msg as LiveMessage);
        } else {
          // Dropped, not queued: a stuck note or a missed release is worse than briefly not knowing about it, but
          // it must still be counted and shown (Constitution I, R-16). Posted here, not from process(): this
          // handler already runs off the per-block hot path, same as the 'status' and 'ended' messages.
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

  function processBlock(left: Float32Array, right: Float32Array): void {
    const blockSize = left.length;

    // Process live inputs immediately
    const LIVE_CHANNEL = 15;
    const liveCount = liveQueue.length;
    for (let i = 0; i < liveCount; i++) {
      const msg = liveQueue[i];
      if (msg === undefined) continue;
      if (msg.kind === 'on') {
        synth.noteOn(LIVE_CHANNEL, msg.key, msg.velocity);
      } else if (msg.kind === 'off') {
        synth.noteOff(LIVE_CHANNEL, msg.key);
      } else if (msg.kind === 'sustain') {
        synth.controllerChange?.(LIVE_CHANNEL, 64, msg.down ? 127 : 0);
      } else if (msg.kind === 'allOff') {
        synth.allNotesOff?.(LIVE_CHANNEL);
      }
    }
    liveQueue.length = 0;

    // Volume ramp
    if (gainRampRemaining > 0) {
      const steps = Math.min(gainRampRemaining, blockSize);
      currentGain += gainStep * steps;
      gainRampRemaining -= steps;
      if (gainRampRemaining <= 0) currentGain = targetGain;
    }

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
      playing = false;
      allNotesOff();
      post({ type: 'ended', frame: dispatchState.endFrame! });
      sendPositionReport();
      return;
    }

    if (pendingReport || blocksSinceReport >= POSITION_REPORT_BLOCKS) {
      sendPositionReport();
    }
  }

  const processor: ScorePlayerProcessor = {
    processBlock,
    receiveMessage,
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

    constructor() {
      super();
      // sampleRate is a global in AudioWorkletGlobalScope
      this.synth = new SpessaSynthProcessor(sampleRate);

      this.inner = createScorePlayerProcessor({
        synth: {
          noteOn: (c, k, v) => this.synth.noteOn(c, k, v),
          noteOff: (c, k) => this.synth.noteOff(c, k),
          allNotesOff: (c?: number) => {
            const channels = c !== undefined ? [c] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            for (const ch of channels) {
              this.synth.controllerChange(ch, 120, 0); // All Sound Off
              this.synth.controllerChange(ch, 123, 0); // All Notes Off
            }
          },
          // Our port takes a plain CC number; spessasynth types its parameter as the MIDIController
          // union of the controllers it knows. The cast is the narrow one, not `any` (tasks.md T139).
          controllerChange: (c, ctrl, v) => this.synth.controllerChange(c, ctrl as MIDIController, v),
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
        if (msg.type === 'position') {
          this.port.postMessage({ ...msg, frame: currentFrame, contextTime: currentTime });
        } else if (msg.type === 'ended') {
          this.port.postMessage({ ...msg, frame: currentFrame });
        } else {
          this.port.postMessage(msg);
        }
      };

      this.port.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'init') {
          this.port.postMessage({ type: 'status', state: 'initialised' });
          return;
        }
        if (msg.type === 'soundBank') {
          try {
            const bank = SoundBankLoader.fromArrayBuffer(msg.bytes);
            this.synth.soundBankManager.addSoundBank(bank, 'default');
            this.soundReady = true;
            this.port.postMessage({ type: 'status', state: 'soundReady' });
          } catch (err) {
            const detail = err instanceof Error && err.message ? err.message : String(err);
            this.port.postMessage({ type: 'status', state: 'error', detail });
          }
          return;
        }

        try {
          this.inner.receiveMessage(msg);
        } catch (err) {
          const detail = err instanceof Error && err.message ? err.message : String(err);
          this.port.postMessage({ type: 'status', state: 'error', detail });
        }
      };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
      const output = outputs[0];
      if (!output) return true;
      const left = output[0];
      const right = output[1];
      if (!left || !right) return true;

      if (!this.soundReady) {
        return true;
      }

      this.inner.processBlock(left, right);
      return true;
    }
  }

  registerProcessor('musicanyya-score-player', ScorePlayerAudioWorklet);
}
