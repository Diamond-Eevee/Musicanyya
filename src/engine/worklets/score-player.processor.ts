import { SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';

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
}

/** Minimal synth used by RecordingSynth-based tests. */
export interface SimpleSynth {
  noteOn(key: number, velocity: number): void;
  noteOff(key: number): void;
}

export type ProcessorMessage =
  | { type: 'status'; state: 'initialised' | 'soundReady' | 'error'; detail?: string }
  | { type: 'position'; frame: number; contextTime: number; tick: number; ticksPerFrame: number; playing: boolean }
  | { type: 'ended'; frame: number };

export interface ScorePlayerProcessor {
  /** Called by the test harness instead of AudioWorkletProcessor.process(). */
  processBlock(blockSize: number): void;
  /** Deliver an inbound message (plays the role of port.onmessage). */
  receiveMessage(msg: any): void;
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

  const liveQueue: any[] = [];

  let onMessage: ((msg: ProcessorMessage) => void) | null = null;

  function post(msg: ProcessorMessage): void {
    onMessage?.(msg);
  }

  function computeCurrentTick(): number {
    if (!schedule || segs.length === 0) return returnTick;
    // Compute tick from the current frame position
    const seg = [...segs].reverse().find((s) => s.startFrame <= currentFrame) ?? segs[0]!;
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

  function receiveMessage(msg: any): void {
    switch (msg.type) {
      case 'schedule': {
        const sched = msg as ScheduleMessage;
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
        const gain = msg.gain as number;
        targetGain = Math.max(0, Math.min(1, gain));
        gainStep = (targetGain - currentGain) / VOLUME_RAMP_FRAMES;
        gainRampRemaining = VOLUME_RAMP_FRAMES;
        break;
      }
      case 'live': {
        liveQueue.push(msg);
        break;
      }
    }
  }

  function processBlock(blockSize: number): void {
    // Process live inputs immediately
    const LIVE_CHANNEL = 15;
    for (const msg of liveQueue) {
      if (msg.kind === 'on') {
        synth.noteOn(LIVE_CHANNEL, msg.key as number, msg.velocity as number);
      } else if (msg.kind === 'off') {
        synth.noteOff(LIVE_CHANNEL, msg.key as number);
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
      currentFrame += blockSize;
      if (pendingReport) sendPositionReport();
      return;
    }

    dispatchBlock(schedule, segs, currentFrame, blockSize, eventCursor, dispatchState);
    eventCursor = dispatchState.nextEventCursor;

    for (let i = 0; i < dispatchState.numEvents; i++) {
      applyEvent(dispatchState.events[i]!);
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
          controllerChange: (c, ctrl, v) => this.synth.controllerChange(c, ctrl as any, v),
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
          } catch (err: any) {
            this.port.postMessage({ type: 'status', state: 'error', detail: err?.message || String(err) });
          }
          return;
        }

        try {
          this.inner.receiveMessage(msg);
        } catch (err: any) {
          this.port.postMessage({ type: 'status', state: 'error', detail: err?.message || String(err) });
        }
      };
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
      const output = outputs[0];
      if (!output) return true;
      const left = output[0];
      const right = output[1];
      if (!left || !right) return true;

      const blockSize = left.length;

      if (!this.soundReady) {
        return true;
      }

      this.inner.processBlock(blockSize);
      this.synth.process(left, right, 0, blockSize);
      return true;
    }
  }

  registerProcessor('musicanyya-score-player', ScorePlayerAudioWorklet);
}
