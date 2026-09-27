/**
 * T080: Block dispatch tests for `src/engine/worklets/dispatch.ts`
 *
 * The dispatcher is a pure function that, given a ScheduleMessage and a block's
 * frame range [blockStart, blockStart + blockSize), finds all events whose
 * dispatch frame falls within the block and returns them in order, together with
 * the sub-block split points so the processor can render between events.
 *
 * Timing rule (contracts/worklet-protocol.md §Timing rules):
 *   event dispatch frame f = segStartFrame + ceil((t - s.startTick) / ticksPerFrame)
 * where ticksPerFrame = ppq * effectiveQpm / (60 * sampleRate)
 *
 * Concrete values used in these tests:
 *   120 qpm, 480 ppq, 48000 Hz, 100% tempo:
 *   tpf = 480 * 120 / (60 * 48000) = 0.02 ticks/frame
 *   frame of tick t: ceil(t / 0.02) = ceil(t * 50)
 *   tick 48  -> frame 2400
 *   tick 96  -> frame 4800
 *   tick 480 -> frame 24000
 */

import { describe, expect, it } from 'vitest';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import type { TempoBeat } from '../../../src/core/score/model.js';
import { percentForBpm, type TempoDisplaySegment } from '../../../src/core/tempo/tempo-display.js';
import { initialTransport, transportReducer } from '../../../src/core/transport/transport.js';
import {
  type BlockEvent,
  DispatchState,
  dispatchBlock,
  recomputeSegmentFrames,
} from '../../../src/engine/worklets/dispatch.js';

/** Build a minimal ScheduleMessage for tests */
function makeSchedule(opts: {
  ppq: number;
  endTick: number;
  events: Array<{ tick: number; kind: number; channel: number; data1: number; data2: number }>;
  tempo?: Array<{ tick: number; qpmNum: number; qpmDen: number }>;
}): ScheduleMessage {
  const events = opts.events;
  const defaultTempo = opts.tempo ?? [{ tick: 0, qpmNum: 120, qpmDen: 1 }];
  const msg: ScheduleMessage = {
    type: 'schedule',
    ppq: opts.ppq,
    endTick: opts.endTick,
    eventTick: new Int32Array(events.map((e) => e.tick)),
    eventKind: new Uint8Array(events.map((e) => e.kind)),
    eventChannel: new Uint8Array(events.map((e) => e.channel)),
    eventData1: new Uint8Array(events.map((e) => e.data1)),
    eventData2: new Uint8Array(events.map((e) => e.data2)),
    tempoTick: new Int32Array(defaultTempo.map((t) => t.tick)),
    tempoQpmNum: new Int32Array(defaultTempo.map((t) => t.qpmNum)),
    tempoQpmDen: new Int32Array(defaultTempo.map((t) => t.qpmDen)),
    channelSetup: new Uint8Array(64),
  };
  return msg;
}

// Shared baseline: 120 qpm, 480 ppq, 48000 Hz, 100%
// tpf = 480 * 120 / (60 * 48000) = 0.02 ticks/frame
// frame(tick) = ceil(tick / 0.02) = tick * 50
const TPF_120 = 0.02;

describe('recomputeSegmentFrames', () => {
  it('returns one segment at frame 0 for a single-tempo schedule', () => {
    const sched = makeSchedule({ ppq: 480, endTick: 9600, events: [] });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startTick: 0, startFrame: 0 });
    // tpf = 480 * 120 / (60 * 48000) = 0.02
    expect(segs[0]!.ticksPerFrame).toBeCloseTo(TPF_120, 10);
  });

  it('produces two segments for a tempo change, with correct start frames', () => {
    // Seg 0: 60 qpm -> tpf = 480*60/(60*48000) = 0.01
    // Frame of tick 960: ceil(960/0.01) = 96000
    // Seg 1: 120 qpm -> tpf = 0.02
    const sched = makeSchedule({
      ppq: 480,
      endTick: 200000,
      events: [],
      tempo: [
        { tick: 0, qpmNum: 60, qpmDen: 1 },
        { tick: 960, qpmNum: 120, qpmDen: 1 },
      ],
    });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ startTick: 0, startFrame: 0 });
    expect(segs[0]!.ticksPerFrame).toBeCloseTo(0.01, 10);
    // frame of tick 960 at 60 qpm: ceil(960/0.01) = 96000
    expect(segs[1]).toMatchObject({ startTick: 960, startFrame: 96000 });
    expect(segs[1]!.ticksPerFrame).toBeCloseTo(TPF_120, 10);
  });

  it('applies tempoPercent to ticksPerFrame', () => {
    // 120 qpm at 100% -> 0.02; at 200% -> 0.04 ticks/frame
    const sched = makeSchedule({ ppq: 480, endTick: 9600, events: [] });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 200);
    expect(segs[0]!.ticksPerFrame).toBeCloseTo(0.04, 10);
  });

  it('starts segment computation from the given startTick/startFrame (e.g. after seek)', () => {
    const sched = makeSchedule({ ppq: 480, endTick: 9600, events: [] });
    const segs = recomputeSegmentFrames(sched, 480, 1000, 48000, 100);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startTick: 480, startFrame: 1000 });
  });
});

// feature 012 SC-002 / FR-009: the factor the field produces is fractional and must reach the frame arithmetic
// untouched, so a typed BPM that is not a multiple of a step still lands every beat on its exact frame.
describe('a typed BPM dispatches exact frames (feature 012 SC-002)', () => {
  const SAMPLE_RATE = 48000;

  function beatFrames(qpm: number, beatQuarters: number, typedBpm: number, beats: number): number[] {
    const beat: TempoBeat = {
      type: 'quarter',
      dots: beatQuarters === 1.5 ? 1 : 0,
      quartersNum: beatQuarters === 1.5 ? 3 : 1,
      quartersDen: beatQuarters === 1.5 ? 2 : 1,
    };
    const seg: TempoDisplaySegment = {
      startTick: 0,
      qpmNum: qpm,
      qpmDen: 1,
      beat,
      beatSource: 'mark',
      isDefault: false,
    };
    // the app path: typed number -> percentForBpm -> the transport reducer -> the factor sent to the worklet
    const percent = transportReducer(initialTransport(), {
      type: 'tempoPercent',
      value: percentForBpm(seg, typedBpm),
    }).tempoPercent;

    const beatTicks = 480 * beatQuarters;
    const events = Array.from({ length: beats + 1 }, (_, k) => ({
      tick: k * beatTicks,
      kind: EVENT_KIND.noteOn,
      channel: 0,
      data1: 60,
      data2: 80,
    }));
    const sched = makeSchedule({
      ppq: 480,
      endTick: (beats + 1) * beatTicks,
      events,
      tempo: [{ tick: 0, qpmNum: qpm, qpmDen: 1 }],
    });
    const segs = recomputeSegmentFrames(sched, 0, 0, SAMPLE_RATE, percent);
    const state = new DispatchState(beats + 8);
    dispatchBlock(sched, segs, 0, Math.ceil((beats + 2) * SAMPLE_RATE), 0, state);
    expect(state.numEvents).toBe(beats + 1);
    return state.events.slice(0, state.numEvents).map((e) => e.frame);
  }

  it('91 quarter-note beats typed on a 90-qpm Score are 60/91 s apart within one frame at 48 kHz', () => {
    const frames = beatFrames(90, 1, 91, 91);
    const gap = (60 / 91) * SAMPLE_RATE;
    for (let i = 1; i < frames.length; i++) {
      expect(Math.abs((frames[i] as number) - (frames[i - 1] as number) - gap)).toBeLessThanOrEqual(1);
    }
    // and the 91st beat lands at 60 s
    expect(Math.abs((frames[91] as number) - 60 * SAMPLE_RATE)).toBeLessThanOrEqual(1);
  });

  it('61 dotted-quarter beats typed on a 6/8 Score written dotted quarter = 60 span 60 s within one frame', () => {
    // dotted quarter = 60 is 90 qpm
    const frames = beatFrames(90, 1.5, 61, 61);
    const gap = (60 / 61) * SAMPLE_RATE;
    for (let i = 1; i < frames.length; i++) {
      expect(Math.abs((frames[i] as number) - (frames[i - 1] as number) - gap)).toBeLessThanOrEqual(1);
    }
    expect(Math.abs((frames[61] as number) - 60 * SAMPLE_RATE)).toBeLessThanOrEqual(1);
  });
});

describe('dispatchBlock', () => {
  // 120 qpm, 480 ppq, 48000 Hz -> tpf=0.02, frame(tick)=tick*50
  // tick 48 -> frame 2400, tick 96 -> frame 4800, tick 480 -> frame 24000

  function make120qpmSchedule(events: Array<{ tick: number; kind: number; key: number; vel: number }>) {
    return makeSchedule({
      ppq: 480,
      endTick: 960000,
      events: events.map((e) => ({ tick: e.tick, kind: e.kind, channel: 0, data1: e.key, data2: e.vel })),
    });
  }

  function makeSingleNoteSchedule(onTick: number, offTick: number) {
    return make120qpmSchedule([
      { tick: onTick, kind: EVENT_KIND.noteOn, key: 60, vel: 80 },
      { tick: offTick, kind: EVENT_KIND.noteOff, key: 60, vel: 0 },
    ]);
  }

  it('returns no events when block is before first event', () => {
    // noteOn at tick 96 -> frame 4800; block is [0, 128)
    const sched = makeSingleNoteSchedule(96, 9600);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 0, 128, 0, state);
    expect(state.numEvents).toBe(0);
    expect(state.splits[state.numSplits - 1]).toBe(128);
  });

  it('dispatches a single noteOn whose frame falls within the block', () => {
    // noteOn at tick 96: frame = ceil(96/0.02) = 4800. Block [4700, 4700+256).
    const sched = makeSingleNoteSchedule(96, 960000);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 4700, 256, 0, state);
    const events = state.events.slice(0, state.numEvents);
    const noteOns = events.filter((e) => e.kind === EVENT_KIND.noteOn);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]).toMatchObject({ frame: 4800, kind: EVENT_KIND.noteOn, data1: 60, data2: 80 });
  });

  it('dispatches several events that fall within the same frame', () => {
    // Two noteOns at tick 96 -> frame 4800. Block [4700, 4956).
    const sched = make120qpmSchedule([
      { tick: 96, kind: EVENT_KIND.noteOn, key: 60, vel: 80 },
      { tick: 96, kind: EVENT_KIND.noteOn, key: 64, vel: 80 },
      { tick: 96 + 480, kind: EVENT_KIND.noteOff, key: 60, vel: 0 },
    ]);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 4700, 256, 0, state);
    const events = state.events.slice(0, state.numEvents);
    const noteOns = events.filter((e) => e.kind === EVENT_KIND.noteOn);
    expect(noteOns).toHaveLength(2);
    expect(noteOns.every((e) => e.frame === 4800)).toBe(true);
  });

  it('splits the block at event frames', () => {
    // noteOn at tick 96 -> frame 4800. Block [4700, 4956).
    const sched = makeSingleNoteSchedule(96, 960000);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 4700, 256, 0, state);
    const splits = state.splits.slice(0, state.numSplits);
    // splits must contain 4800 (the event frame) and end with 4956
    expect(splits).toContain(4800);
    expect(splits[splits.length - 1]).toBe(4956);
    // splits must be strictly increasing
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i]!).toBeGreaterThan(splits[i - 1]!);
    }
  });

  it('events at a tempo segment boundary are dispatched at the correct frame', () => {
    // Seg 0: 60 qpm -> tpf=0.01, tick 960 at frame ceil(960/0.01)=96000
    // Seg 1 starts at tick 960 / frame 96000, 120 qpm -> tpf=0.02
    // noteOn at tick 960 -> frame 96000 (start of seg 1). Block [95900, 96100).
    const sched = makeSchedule({
      ppq: 480,
      endTick: 200000,
      events: [
        { tick: 960, kind: EVENT_KIND.noteOn, channel: 0, data1: 60, data2: 80 },
        { tick: 960 + 480, kind: EVENT_KIND.noteOff, channel: 0, data1: 60, data2: 0 },
      ],
      tempo: [
        { tick: 0, qpmNum: 60, qpmDen: 1 },
        { tick: 960, qpmNum: 120, qpmDen: 1 },
      ],
    });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 95900, 200, 0, state);
    const events = state.events.slice(0, state.numEvents);
    const noteOns = events.filter((e) => e.kind === EVENT_KIND.noteOn);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.frame).toBe(96000);
  });

  it('events outside the block are not returned', () => {
    // noteOn at tick 9600 -> frame 480000. Block [0, 128).
    const sched = makeSingleNoteSchedule(9600, 192000);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 0, 128, 0, state);
    expect(state.numEvents).toBe(0);
  });

  it('signals endReached when the end tick frame falls within the block', () => {
    // endTick = 48 -> frame ceil(48/0.02) = 2400. Block [2300, 2556).
    const sched = makeSchedule({ ppq: 480, endTick: 48, events: [] });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 2300, 256, 0, state);
    expect(state.endReached).toBe(true);
    expect(state.endFrame).toBe(2400);
  });

  // RT re-review N1 (feature 012): a tempo change that slows playback re-anchors at a fractional tick, and an event or
  // the end just before that tick, not yet dispatched, gets a frame below the block start. It is late, not gone.
  it('an event whose frame is before the block start is dispatched at the block start, not dropped', () => {
    // 120 qpm: frame(tick) = tick * 50. The event at tick 96 is due at frame 4800; the block starts at 4900.
    const sched = makeSingleNoteSchedule(96, 960000);
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 4900, 128, 0, state);
    const noteOns = state.events.slice(0, state.numEvents).filter((e) => e.kind === EVENT_KIND.noteOn);
    expect(noteOns).toHaveLength(1);
    expect(noteOns[0]!.frame).toBe(4900);
    expect(state.nextEventCursor).toBe(1);
  });

  it('an end frame before the block start still ends the run, at the block start', () => {
    const sched = makeSchedule({ ppq: 480, endTick: 48, events: [] }); // end frame 2400
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 2500, 128, 0, state);
    expect(state.endReached).toBe(true);
    expect(state.endFrame).toBe(2500);
  });

  it('does not signal endReached when block ends before the end frame', () => {
    // endTick = 960 -> frame 48000. Block [0, 128).
    const sched = makeSchedule({ ppq: 480, endTick: 960, events: [] });
    const segs = recomputeSegmentFrames(sched, 0, 0, 48000, 100);
    const state = new DispatchState();
    dispatchBlock(sched, segs, 0, 128, 0, state);
    expect(state.endReached).toBe(false);
  });
});
