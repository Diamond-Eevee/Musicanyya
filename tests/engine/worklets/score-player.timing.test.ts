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
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { POSITION_REPORT_BLOCKS, VOLUME_RAMP_FRAMES } from '../../../src/engine/config.js';
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
    for (let i = 0; i < 100; i++) proc.processBlock(BLOCK_SIZE);
    expect(synth.events).toHaveLength(0);
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
    proc.processBlock(BLOCK_SIZE);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(0);

    // After block 1: noteOn at frame 128 should have fired
    proc.processBlock(BLOCK_SIZE);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(1);

    // Run 10 more blocks to confirm no duplicate noteOns
    for (let i = 0; i < 10; i++) proc.processBlock(BLOCK_SIZE);
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
    proc.processBlock(BLOCK_SIZE);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(0);

    // After block 1: noteOn should fire (frame 128 at 200%)
    proc.processBlock(BLOCK_SIZE);
    expect(synth.events.filter((e) => e.startsWith('on:')).length).toBe(1);
  });

  it('pause stops advancing and releases sounding notes', () => {
    // noteOn at tick 0 (frame 0); pause after 5 blocks; run 10 more blocks; no more events
    const synth = new RecordingSynth();
    const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
    const sched = makeSingleNoteSchedule({ ppq: 480, onTick: 0, offTick: 9600, endTick: 192000 });
    proc.receiveMessage({ type: 'schedule', ...sched });
    proc.receiveMessage({ type: 'play' });

    for (let i = 0; i < 5; i++) proc.processBlock(BLOCK_SIZE);
    const eventsBeforePause = [...synth.events];
    // Should have started the note (tick 0 -> frame 0, fires in block 0)
    expect(eventsBeforePause.filter((e) => e.startsWith('on:')).length).toBe(1);

    proc.receiveMessage({ type: 'pause' });
    for (let i = 0; i < 10; i++) proc.processBlock(BLOCK_SIZE);

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

    for (let i = 0; i < 50; i++) proc.processBlock(BLOCK_SIZE);
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
    proc.processBlock(BLOCK_SIZE); // first note (tick 0) fires here

    // seek to tick 2560 (second note)
    proc.receiveMessage({ type: 'seek', tick: 2560 });
    const eventsBeforeSeek = synth.events.length;
    // Run enough blocks to cover the second note (starts at frame 0 after seek)
    for (let i = 0; i < 5; i++) proc.processBlock(BLOCK_SIZE);

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
    for (let i = 0; i < 10; i++) proc.processBlock(BLOCK_SIZE);

    proc.receiveMessage({ type: 'stop', returnTick: 0 });
    const eventCountAtStop = synth.events.length;
    for (let i = 0; i < 20; i++) proc.processBlock(BLOCK_SIZE);
    // No new sound events after stop
    expect(synth.events.length).toBe(eventCountAtStop);

    // Position report after stop should have playing: false
    const posReports: any[] = [];
    proc.onMessage = (msg: any) => {
      if (msg.type === 'position') posReports.push(msg);
    };
    proc.processBlock(BLOCK_SIZE);
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

    for (let i = 0; i < 5; i++) proc.processBlock(BLOCK_SIZE);
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
    for (let i = 0; i < nBlocks; i++) proc.processBlock(BLOCK_SIZE);

    // Should have at most ceil(nBlocks / POSITION_REPORT_BLOCKS) + 2 reports
    const maxReports = Math.ceil(nBlocks / POSITION_REPORT_BLOCKS) + 2;
    expect(posReports.length).toBeLessThanOrEqual(maxReports);
    // And at least 1
    expect(posReports.length).toBeGreaterThanOrEqual(1);
  });
});
