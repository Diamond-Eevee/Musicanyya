import { describe, expect, it } from 'vitest';
import { EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { DispatchState, dispatchBlock, recomputeSegmentFrames } from '../../../src/engine/worklets/dispatch.js';
import {
  createScorePlayerProcessor,
  type ProcessorMessage,
} from '../../../src/engine/worklets/score-player.processor.js';

/**
 * 017 T012 (from 001 T167, Constitution I): a block holding more events than the dispatch state can take does not
 * lose them - they sound in the next block - but they are late, and each late event is counted once, when it
 * sounds, and reported, not silent.
 */

const SAMPLE_RATE = 48000;
const BLOCK = 128;

/** `count` note-ons all at tick 0 (one block), then nothing until `endTick`. */
function chord(count: number, endTick = 480 * 8): ScheduleMessage {
  return {
    type: 'schedule',
    ppq: 480,
    endTick,
    eventTick: new Int32Array(count),
    eventKind: new Uint8Array(count).fill(EVENT_KIND.noteOn),
    eventChannel: Uint8Array.from({ length: count }, (_, i) => i % 16),
    eventData1: Uint8Array.from({ length: count }, (_, i) => i % 128),
    eventData2: new Uint8Array(count).fill(80),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: Int32Array.from([1]),
    channelSetup: new Uint8Array(64),
  };
}

describe('dispatch overflow: late events are counted once, when they sound', () => {
  it('a full block leaves the rest for the next block, where they sound late and are counted', () => {
    const schedule = chord(6);
    const segs = recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, 100);
    const state = new DispatchState(4);

    dispatchBlock(schedule, segs, 0, BLOCK, 0, state);
    expect(state.numEvents).toBe(4);
    expect(state.nextEventCursor).toBe(4); // not skipped: the next block starts from the first left-over event
    expect(state.lateInBlock).toBe(0); // these four sound on time
    expect(state.lateTotal).toBe(0);

    dispatchBlock(schedule, segs, BLOCK, BLOCK, state.nextEventCursor, state);
    expect(state.numEvents).toBe(2); // the two left over, at this block's start
    expect(state.events[0]?.frame).toBe(BLOCK);
    expect(state.lateInBlock).toBe(2);
    expect(state.lateTotal).toBe(2);
  });

  it('a backlog longer than two blocks counts each late event exactly once (RT review N1)', () => {
    const schedule = chord(10); // limit 4: sounds 4 on time, then 4 late, then 2 late
    const segs = recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, 100);
    const state = new DispatchState(4);
    let cursor = 0;
    for (let block = 0; block < 4; block++) {
      dispatchBlock(schedule, segs, block * BLOCK, BLOCK, cursor, state);
      cursor = state.nextEventCursor;
    }
    expect(cursor).toBe(10);
    expect(state.lateTotal).toBe(6);
  });

  it('counts nothing when every block fits', () => {
    const schedule = chord(4);
    const state = new DispatchState(4);
    dispatchBlock(schedule, recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, 100), 0, BLOCK, 0, state);
    expect(state.lateInBlock).toBe(0);
    expect(state.lateTotal).toBe(0);
  });

  it('the processor reports the running total in its position report', () => {
    const played: number[] = [];
    const proc = createScorePlayerProcessor({
      synth: { noteOn: (_c, key) => played.push(key), noteOff: () => {} },
      sampleRate: SAMPLE_RATE,
    });
    const reports: Array<ProcessorMessage & { type: 'position' }> = [];
    proc.onMessage = (msg) => {
      if (msg.type === 'position') reports.push({ ...msg });
    };
    proc.receiveMessage({ ...chord(1100) }); // the worklet's state holds 1024 per block
    proc.receiveMessage({ type: 'play' });
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    for (let i = 0; i < 8; i++) proc.processBlock(left, right);

    expect(played).toHaveLength(1100); // nothing lost
    expect(reports.at(-1)?.lateEvents).toBe(1100 - 1024);
  });
});
