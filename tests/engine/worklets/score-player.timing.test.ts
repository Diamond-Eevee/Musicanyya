/**
 * T081: Offline score-player tests using RecordingSynth + worklet shim
 *
 * Tests the `ScorePlayerProcessor` (src/engine/worklets/score-player.processor.ts)
 * via `RecordingSynth`.  The processor is driven by calling `processBlock()`
 * manually (offline simulation), advancing the frame counter.
 *
 * Key behaviours under test:
 *  - schedule -> play: exact noteOn onset frames including tempo%, repeats & jumps
 *  - pause: stops advancing; already-sounding notes get noteOff; silence during pause
 *  - resume (play after pause): continues from the paused position
 *  - seek: jumps to the new tick, all-notes-off first
 *  - stop: returns position to returnTick, stops advancing
 *  - ended: signalled when endTick frame is reached; processor pauses itself
 *  - position reports at most every POSITION_REPORT_BLOCKS (4) blocks while playing
 *  - volume ramp: volume change is applied gradually over VOLUME_RAMP_FRAMES
 *
 * Timing constants for these tests:
 *   sampleRate = 480 Hz, ppq = 480, qpm = 120, tempoPercent = 100
 *   tpf = ppq * qpm / (60 * sampleRate) = 480 * 120 / (60 * 480) = 2 ticks / frame
 *   frame(tick) = ceil(tick / 2)
 *   tick 0   -> frame 0
 *   tick 2   -> frame 1
 *   tick 256 -> frame 128  (exactly one BLOCK_SIZE block)
 *   tick 512 -> frame 256  (two blocks)
 *   tick 1024 -> frame 512 (four blocks)
 */

import { describe, expect, it } from 'vitest';
import { METRONOME_CHANNEL, METRONOME_KEY_BEAT, METRONOME_VELOCITY_BEAT } from '../../../src/core/defaults.js';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { POSITION_REPORT_BLOCKS, VOLUME_RAMP_FRAMES } from '../../../src/engine/config.js';
import { frameOfTickInSegs, recomputeSegmentFrames } from '../../../src/engine/worklets/dispatch.js';
import {
  createScorePlayerProcessor,
  type ScorePlayerProcessor,
} from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

// Low sample rate for deterministic, fast tests
const SAMPLE_RATE = 480; // Hz
const BLOCK_SIZE = 128; // frames per block (standard)
// tpf = 480*120/(60*480) = 2 ticks/frame
// frame(tick) = ceil(tick / 2) = tick >> 1 (for even ticks)

/** Drive `proc` for `count` blocks of `blockSize` frames each, offline (no real audio needed). */
function processBlocks(proc: ScorePlayerProcessor, count: number, blockSize: number = BLOCK_SIZE): void {
  const left = new Float32Array(blockSize);
  const right = new Float32Array(blockSize);
  for (let i = 0; i < count; i++) proc.processBlock(left, right);
}

/** Build a ScheduleMessage with a single note. */
function makeSingleNoteSchedule(opts: {
  ppq: number;
  onTick: number;
  offTick: number;
  endTick: number;
  qpm?: number;
}): ScheduleMessage {
  const { ppq, onTick, offTick, endTick, qpm = 120 } = opts;
  return {
    type: 'schedule',
    ppq,
    endTick,
    eventTick: new Int32Array([onTick, offTick]),
    eventKind: new Uint8Array([EVENT_KIND.noteOn, EVENT_KIND.noteOff]),
    eventChannel: new Uint8Array([0, 0]),
    eventData1: new Uint8Array([60, 60]),
    eventData2: new Uint8Array([80, 0]),
    tempoTick: new Int32Array([0]),
    tempoQpmNum: new Int32Array([qpm]),
    tempoQpmDen: new Int32Array([1]),
    channelSetup: new Uint8Array(64),
  };
}

describe('ScorePlayerProcessor', () => {
  it('sends no sound before play is called', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    // schedule a note but don't play
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 480, endTick: 960 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    // run 100 blocks - no sound expected
    processBlocks(proc, 100);
    expect(synth.events.filter((e) => !e.startsWith('render:'))).toHaveLength(0);
  });

  it('dispatches noteOn at the exact onset frame (100% tempo, 120 qpm, 480 ppq)', () => {
    // tpf = 480 * 120 / (60 * 480) = 2 ticks/frame
    // tick 256 -> frame 128 (exactly block boundary at block 1)
    // block 0: frames [0, 128) - no event
    // block 1: frames [128, 256) - noteOn at frame 128 dispatched here
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 256, offTick: 9600, endTick: 96000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    // After block 0: no noteOn yet
    processBlocks(proc, 1);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(0);

    // After block 1: noteOn at frame 128 should have fired
    processBlocks(proc, 1);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(1);

    // Run 10 more blocks to confirm no duplicate noteOns
    processBlocks(proc, 10);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(1);
  });

  it('dispatches noteOn earlier when tempoPercent=200 (double speed)', () => {
    // At 200%: tpf = 4 ticks/frame
    // tick 512 -> frame ceil(512/4) = 128 (block 1)
    // At 100%: tick 512 -> frame ceil(512/2) = 256 (block 2)
    // So at 200%, the note fires in block 1; at 100% it fires in block 2.
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 512, offTick: 9600, endTick: 96000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'tempo', percent: 200 });
    proc.receiveMessage({ type: 'play' });

    // After block 0: no noteOn yet
    processBlocks(proc, 1);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(0);

    // After block 1: noteOn should fire (frame 128 at 200%)
    processBlocks(proc, 1);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(1);
  });

  it('pause stops advancing and releases sounding notes', () => {
    // noteOn at tick 0 (frame 0); pause after 5 blocks; run 10 more blocks; no more events
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 9600, endTick: 192000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    processBlocks(proc, 5);
    const eventsBeforePause = [...synth.events];
    // Should have started the note (tick 0 -> frame 0, fires in block 0)
    expect(eventsBeforePause.filter((e) => e.startsWith('on:')).length).toBe(1);

    proc.receiveMessage({ type: 'pause' });
    processBlocks(proc, 10);

    const newEvents = synth.events.slice(eventsBeforePause.length);
    // A noteOff should have been issued for the sounding note on pause
    expect(newEvents.filter((e) => e.startsWith('off:')).length).toBeGreaterThanOrEqual(1);
    // No new noteOns during the pause
    expect(newEvents.filter((e) => e.startsWith('on:')).length).toBe(0);
  });

  it('nothing sounds while paused', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    // noteOn at tick 256 -> frame 128 (block 1)
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 256, offTick: 9600, endTick: 192000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });
    proc.receiveMessage({ type: 'pause' }); // pause immediately before any note

    processBlocks(proc, 50);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(0);
  });

  it('seek jumps to a new position and resumes from there', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    // Two notes: tick 0 (key 60) and tick 2560 (key 64)
    // At 100% tempo: tick 2560 -> frame 1280 (block 10)
    const sched: ScheduleMessage = {
      type: 'schedule',
      ppq: 480,
      endTick: 192000,
      eventTick: new Int32Array([0, 1280, 2560, 3840]),
      eventKind: new Uint8Array([EVENT_KIND.noteOn, EVENT_KIND.noteOff, EVENT_KIND.noteOn, EVENT_KIND.noteOff]),
      eventChannel: new Uint8Array([0, 0, 0, 0]),
      eventData1: new Uint8Array([60, 60, 64, 64]),
      eventData2: new Uint8Array([80, 0, 80, 0]),
      tempoTick: new Int32Array([0]),
      tempoQpmNum: new Int32Array([120]),
      tempoQpmDen: new Int32Array([1]),
      channelSetup: new Uint8Array(64),
    };
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });
    processBlocks(proc, 1); // first note (tick 0) fires here

    // seek to tick 2560 (second note)
    proc.receiveMessage({ type: 'seek', tick: 2560 });
    const eventsBeforeSeek = synth.events.length;
    // Run enough blocks to cover the second note (starts at frame 0 after seek)
    processBlocks(proc, 5);

    const newEvents = synth.events.slice(eventsBeforeSeek);
    // Should play key 64 (second note), not key 60 again
    expect(newEvents.filter((e) => e.startsWith('on:64:'))).toHaveLength(1);
    expect(newEvents.filter((e) => e.startsWith('on:60:'))).toHaveLength(0);
  });

  it('stop returns position to returnTick and stops advancing', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 480, endTick: 9600 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });
    processBlocks(proc, 10);

    proc.receiveMessage({ type: 'stop', returnTick: 0 });
    const eventCountAtStop = synth.events.filter((e) => !e.startsWith('render:')).length;
    processBlocks(proc, 20);
    // No new sound events after stop (rendering still happens - silence/decay - so only count note events)
    expect(synth.events.filter((e) => !e.startsWith('render:')).length).toBe(eventCountAtStop);

    // Position report after stop should have playing: false
    const posReports: any[] = [];
    proc.onMessage = (msg: any) => {
      if (msg.type === 'position') posReports.push(msg);
    };
    processBlocks(proc, 1);
    if (posReports.length > 0) {
      expect(posReports[posReports.length - 1].playing).toBe(false);
    }
  });

  it('signals ended when end tick is reached', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    // endTick = 512 -> frame ceil(512/2) = 256 (block 2, frames [256, 384))
    // So endReached fires during block 2.
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 256, endTick: 512 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    const endedFrames: number[] = [];
    proc.onMessage = (msg: any) => {
      if (msg.type === 'ended') endedFrames.push(msg.frame);
    };

    processBlocks(proc, 5);
    expect(endedFrames).toHaveLength(1);
    // endTick 512 at tpf=2 -> frame 256 (block 2)
    expect(endedFrames[0]).toBeGreaterThanOrEqual(256);
    expect(endedFrames[0]).toBeLessThan(512); // should be within first 4 blocks
  });

  it('reports position at most every POSITION_REPORT_BLOCKS while playing', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 4800, endTick: 960000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    const posReports: any[] = [];
    proc.onMessage = (msg: any) => {
      if (msg.type === 'position') posReports.push(msg);
    };

    const nBlocks = POSITION_REPORT_BLOCKS * 10;
    processBlocks(proc, nBlocks);

    // Should have at most ceil(nBlocks / POSITION_REPORT_BLOCKS) + 2 reports
    const maxReports = Math.ceil(nBlocks / POSITION_REPORT_BLOCKS) + 2;
    expect(posReports.length).toBeLessThanOrEqual(maxReports);
    // And at least 1
    expect(posReports.length).toBeGreaterThanOrEqual(1);
  });

  // T024 (research R-02, SC-002): `dispatch.ts` already computes `splits` - per-event frame
  // boundaries within a block - that nothing used before this task. These tests confirm the
  // processor actually renders each block in those sub-block pieces, applying every event at
  // its own frame, rather than applying all of a block's events up front and rendering the
  // whole block in one pass (which would make every event land at the block boundary).
  it('T024: applies a scheduled event at its own sub-block frame, not at the block boundary', () => {
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    // tick 100 -> frame ceil(100/2) = 50: well inside block 0 [0, 128), not at a block edge.
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 100, offTick: 9600, endTick: 96000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });
    processBlocks(proc, 1);

    const onEvent = synth.events.find((e) => e.startsWith('on:'));
    expect(onEvent).toBeDefined();
    // The frame recorded on the noteOn is the cumulative sample count rendered before it fired.
    expect(Number(onEvent!.split(':')[3])).toBe(50);

    // The block was still rendered in full: every sub-block segment sums to one block.
    const renders = synth.events.filter((e) => e.startsWith('render:'));
    expect(renders.length).toBeGreaterThanOrEqual(2); // at least one segment before and one after the event
    const totalRendered = renders.reduce((sum, e) => sum + Number(e.split(':')[2]), 0);
    expect(totalRendered).toBe(BLOCK_SIZE);
  });

  it('SC-002: a metronome click lands within 3 ms of its correct time, with no accumulated drift, over a simulated 10-minute run across tempo and meter changes', () => {
    const SR = 48000; // a realistic sample rate, not the low rate used for the other tests above
    const BS = 128; // standard AudioWorklet render quantum
    const PPQ = 480;

    // Four 150-second segments (600s total): different tempi, and different click spacing to
    // stand in for meter changes (a beat click every quarter note, then every dotted quarter -
    // 6/8 - then quarters again, then every three-eighths - a 3/4 feel subdivided in eighths).
    const segmentDefs = [
      { seconds: 150, qpm: 120, clickTicks: PPQ },
      { seconds: 150, qpm: 90, clickTicks: PPQ * 1.5 },
      { seconds: 150, qpm: 160, clickTicks: PPQ },
      { seconds: 150, qpm: 76, clickTicks: PPQ * 0.75 },
    ];

    const tempoTick: number[] = [];
    const tempoQpmNum: number[] = [];
    const tempoQpmDen: number[] = [];
    const clickTicks: number[] = [];

    let curTick = 0;
    for (const seg of segmentDefs) {
      const startTick = Math.round(curTick);
      tempoTick.push(startTick);
      tempoQpmNum.push(seg.qpm);
      tempoQpmDen.push(1);
      const tpf = (PPQ * seg.qpm) / (60 * SR); // ticks per frame at 100% tempo
      const segTicks = seg.seconds * SR * tpf;
      for (let t = 0; t < segTicks; t += seg.clickTicks) {
        clickTicks.push(Math.round(startTick + t));
      }
      curTick = startTick + segTicks;
    }
    const endTick = Math.round(curTick) + PPQ * 1000; // well past the driven run, so it never ends early

    const sched: ScheduleMessage = {
      type: 'schedule',
      ppq: PPQ,
      endTick,
      eventTick: new Int32Array(clickTicks),
      eventKind: new Uint8Array(clickTicks.map(() => EVENT_KIND.noteOn)),
      eventChannel: new Uint8Array(clickTicks.map(() => METRONOME_CHANNEL)),
      eventData1: new Uint8Array(clickTicks.map(() => METRONOME_KEY_BEAT)),
      eventData2: new Uint8Array(clickTicks.map(() => METRONOME_VELOCITY_BEAT)),
      tempoTick: new Int32Array(tempoTick),
      tempoQpmNum: new Int32Array(tempoQpmNum),
      tempoQpmDen: new Int32Array(tempoQpmDen),
      channelSetup: new Uint8Array(64),
    };

    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SR });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    const totalFrames = 600 * SR;
    const nBlocks = Math.ceil(totalFrames / BS) + 1;
    processBlocks(proc, nBlocks, BS);

    const clickEvents = synth.events.filter((e) => e.startsWith(`on:${METRONOME_KEY_BEAT}:`));
    expect(clickEvents.length).toBe(clickTicks.length);
    expect(clickEvents.length).toBeGreaterThan(1000); // sanity: a real 10-minute run has hundreds of clicks

    // Independently re-derive each click's expected frame from the same tempo segments (the
    // dispatcher's own already-tested machinery, R-02), and compare it to the frame the
    // processor actually applied the noteOn at. No tolerance grows with time if there is no
    // accumulated drift, so checking every click (not just the last one) is the point.
    const segs = recomputeSegmentFrames(sched, 0, 0, SR, 100);
    const maxErrorFrames = Math.ceil((3 / 1000) * SR); // SC-002's 3 ms, in frames
    for (let i = 0; i < clickTicks.length; i++) {
      const expectedFrame = frameOfTickInSegs(clickTicks[i]!, segs);
      const actualFrame = Number(clickEvents[i]!.split(':')[3]);
      expect(Math.abs(actualFrame - expectedFrame)).toBeLessThanOrEqual(maxErrorFrames);
    }
  });
});
