/**
 * Feature 012 T053 (findings of the T036 RT review): the worklet's `tempo` message and the pause / resume path.
 *
 * The tempo factor is now any finite number in [25, 200] and the step controls can send ~30 `tempo` messages a second
 * while the Score plays (FR-013: a change applies live, the position keeps going). The processor is driven directly,
 * block by block, like score-player.timing.test.ts.
 *
 * Timing constants: sampleRate = 480 Hz, ppq = 480, 120 qpm, 100 % -> 2 ticks per frame; a block is 128 frames = 256 ticks.
 */

import { describe, expect, it } from 'vitest';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import {
  createScorePlayerProcessor,
  type ScorePlayerProcessor,
} from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

const SAMPLE_RATE = 480;
const BLOCK_SIZE = 128;
const TICKS_PER_BLOCK = 256; // 2 ticks per frame at 100 %
const FIRST_KEY = 40;
/** Key of note k: distinct for 128 notes in a row, so a repeated or dropped one breaks the sequence. */
const keyOf = (k: number): number => (FIRST_KEY + k) % 128;

interface Report {
  tick: number;
  frame: number;
  ticksPerFrame: number;
  playing: boolean;
}

/** `noteCount` quarter notes, one distinct key each (FIRST_KEY + index), at 120 qpm unless `tempo` says otherwise. */
function makeSchedule(opts: {
  noteCount?: number;
  spacing?: number;
  endTick?: number;
  tempo?: { tick: number; qpm: number }[];
}): ScheduleMessage {
  const { noteCount = 60, spacing = 480, endTick = 1_000_000, tempo = [{ tick: 0, qpm: 120 }] } = opts;
  return {
    type: 'schedule',
    ppq: 480,
    endTick,
    eventTick: Int32Array.from({ length: noteCount }, (_, k) => k * spacing),
    eventKind: new Uint8Array(noteCount).fill(EVENT_KIND.noteOn),
    eventChannel: new Uint8Array(noteCount),
    eventData1: Uint8Array.from({ length: noteCount }, (_, k) => keyOf(k)),
    eventData2: new Uint8Array(noteCount).fill(80),
    tempoTick: Int32Array.from(tempo.map((t) => t.tick)),
    tempoQpmNum: Int32Array.from(tempo.map((t) => t.qpm)),
    tempoQpmDen: new Int32Array(tempo.length).fill(1),
    channelSetup: new Uint8Array(64),
  };
}

function setup(schedule: ScheduleMessage = makeSchedule({})) {
  const synth = new RecordingSynth();
  const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
  const reports: Report[] = [];
  proc.onMessage = (msg) => {
    // The processor reuses one report object (017 T009): keep a copy of what each report said.
    if (msg.type === 'position') reports.push({ ...msg } as unknown as Report);
  };
  proc.receiveMessage({ ...schedule });
  return { synth, proc, reports };
}

function run(proc: ScorePlayerProcessor, blocks: number): void {
  const left = new Float32Array(BLOCK_SIZE);
  const right = new Float32Array(BLOCK_SIZE);
  for (let i = 0; i < blocks; i++) proc.processBlock(left, right);
}

function noteOnKeys(synth: RecordingSynth): number[] {
  return synth.events.filter((e) => e.startsWith('on:')).map((e) => Number(e.split(':')[1]));
}

/** The tempo the processor is running at, in percent, measured from its own last two position reports. */
function measuredPercent(reports: readonly Report[]): number {
  const a = reports[reports.length - 2] as Report;
  const b = reports[reports.length - 1] as Report;
  return ((b.tick - a.tick) / (b.frame - a.frame) / 2) * 100;
}

describe('a tempo message during playback keeps the position (worklet-protocol 1.4.2)', () => {
  it('one fractional tempo message: the tick carries on from where it was, at the new rate', () => {
    const { proc, reports } = setup();
    proc.receiveMessage({ type: 'play' });
    run(proc, 20); // frame 2560 -> tick 5120
    proc.receiveMessage({ type: 'tempo', percent: 101.111 });
    run(proc, 1);
    const last = reports[reports.length - 1] as Report;
    expect(last.tick).toBeCloseTo(5120 + (TICKS_PER_BLOCK * 101.111) / 100, 6);
    expect(last.playing).toBe(true);
  });

  it('30 rapid fractional tempo messages, one per block: continuous, and every note sounds exactly once', () => {
    const { proc, synth, reports } = setup();
    proc.receiveMessage({ type: 'play' });
    run(proc, 20);
    let expected = 5120;
    for (let i = 0; i < 30; i++) {
      const percent = 90 + ((i * 7) % 21) * 1.0037;
      proc.receiveMessage({ type: 'tempo', percent });
      run(proc, 1);
      expected += (TICKS_PER_BLOCK * percent) / 100;
      expect((reports[reports.length - 1] as Report).tick, `after message ${i}`).toBeCloseTo(expected, 6);
    }

    // note k (tick 480 k) sounds once, in order, none repeated and none dropped
    const keys = noteOnKeys(synth);
    expect(keys).toEqual(Array.from({ length: keys.length }, (_, k) => keyOf(k)));
    expect(keys.length).toBeGreaterThanOrEqual(Math.floor(expected / 480));
    expect(keys.length).toBeLessThanOrEqual(Math.ceil(expected / 480) + 1);
  });

  it('the same change with two tempo segments in the Score keeps the position as well', () => {
    const { proc, reports } = setup(
      makeSchedule({
        tempo: [
          { tick: 0, qpm: 120 },
          { tick: 4000, qpm: 60 },
        ],
      }),
    );
    proc.receiveMessage({ type: 'play' });
    run(proc, 20); // 100 %: 4000 ticks in 2000 frames (15.6 blocks), then 1 tick per frame: tick 4000 + 560
    proc.receiveMessage({ type: 'tempo', percent: 150 });
    run(proc, 1);
    expect((reports[reports.length - 1] as Report).tick).toBeCloseTo(4000 + 560 + BLOCK_SIZE * 1 * 1.5, 6);
  });
});

describe('a tempo change that slows playback drops no event (RT re-review N1)', () => {
  // Notes 3 ticks apart (1.5 frames at 100 %), a tempo message before every block alternating 100 % and 30.1 %: the
  // anchor tick at the block start is fractional, and an event just before it, not yet dispatched, gets a frame under
  // the block start when the rate drops. It must sound at the block start, not vanish.
  it('every note sounds exactly once, in order, across 60 alternating 100 % / 30.1234 % changes', () => {
    const { proc, synth, reports } = setup(makeSchedule({ noteCount: 4000, spacing: 3 }));
    proc.receiveMessage({ type: 'play' });
    for (let block = 0; block < 60; block++) {
      proc.receiveMessage({ type: 'tempo', percent: block % 2 === 0 ? 100 : 30.1234 });
      run(proc, 1);
    }
    const keys = noteOnKeys(synth);
    expect(keys).toEqual(Array.from({ length: keys.length }, (_, k) => keyOf(k)));
    const tick = (reports[reports.length - 1] as Report).tick;
    // the note at tick 3k has sounded once the playhead is past it; at most the one being reached is not yet due
    expect(keys.length).toBeGreaterThanOrEqual(Math.floor(tick / 3));
  });

  it('a lower tempo sent while paused, then resume, drops nothing either', () => {
    const { proc, synth } = setup(makeSchedule({ noteCount: 4000, spacing: 3 }));
    proc.receiveMessage({ type: 'play' });
    for (let cycle = 0; cycle < 20; cycle++) {
      run(proc, 3);
      proc.receiveMessage({ type: 'pause' });
      proc.receiveMessage({ type: 'tempo', percent: cycle % 2 === 0 ? 30.1234 : 100 });
      run(proc, 2);
      proc.receiveMessage({ type: 'play' });
    }
    run(proc, 1);
    const keys = noteOnKeys(synth);
    expect(keys).toEqual(Array.from({ length: keys.length }, (_, k) => keyOf(k)));
  });
});

describe('pause, resume and idle blocks keep the playhead (worklet-protocol 1.4.2)', () => {
  it('a tempo message while paused keeps the paused tick and resume continues from it', () => {
    const { proc, reports } = setup();
    proc.receiveMessage({ type: 'play' });
    run(proc, 10); // tick 2560
    proc.receiveMessage({ type: 'pause' });
    run(proc, 10);
    proc.receiveMessage({ type: 'tempo', percent: 50 });
    run(proc, 5);
    expect((reports[reports.length - 1] as Report).tick).toBe(2560);
    proc.receiveMessage({ type: 'play' });
    run(proc, 1);
    expect((reports[reports.length - 1] as Report).tick).toBeCloseTo(2560 + TICKS_PER_BLOCK * 0.5, 6);
  });

  it.each([1, 10, 200])('resuming after %i idle blocks continues from the paused tick', (idle) => {
    const { proc, synth, reports } = setup();
    proc.receiveMessage({ type: 'play' });
    run(proc, 10); // tick 2560
    proc.receiveMessage({ type: 'pause' });
    run(proc, idle);
    const paused = reports[reports.length - 1] as Report;
    expect(paused).toMatchObject({ tick: 2560, playing: false }); // the cursor does not walk on while paused
    proc.receiveMessage({ type: 'play' });
    run(proc, 1);
    expect((reports[reports.length - 1] as Report).tick).toBe(2560 + TICKS_PER_BLOCK);
    // and nothing was skipped or repeated across the pause
    const keys = noteOnKeys(synth);
    expect(keys).toEqual(Array.from({ length: keys.length }, (_, k) => keyOf(k)));
  });

  it('play after idle blocks (schedule loaded, nothing playing) starts at the return tick, not later', () => {
    const { proc, synth, reports } = setup();
    run(proc, 10);
    proc.receiveMessage({ type: 'play' });
    run(proc, 1);
    expect((reports[reports.length - 1] as Report).tick).toBe(TICKS_PER_BLOCK);
    expect(noteOnKeys(synth)[0]).toBe(FIRST_KEY); // the first note is not skipped
  });

  it('play after the Score ended starts again from the return tick and plays the first note again', () => {
    const { proc, synth, reports } = setup(makeSchedule({ noteCount: 3, endTick: 512 }));
    proc.receiveMessage({ type: 'play' });
    run(proc, 5); // ended during block 2
    expect(noteOnKeys(synth)).toEqual([40, 41, 42].slice(0, noteOnKeys(synth).length));
    const firstRun = noteOnKeys(synth).length;
    proc.receiveMessage({ type: 'play' });
    run(proc, 1);
    expect(noteOnKeys(synth).length).toBeGreaterThan(firstRun);
    expect(noteOnKeys(synth)[firstRun]).toBe(FIRST_KEY);
    expect((reports[reports.length - 1] as Report).tick).toBe(TICKS_PER_BLOCK);
  });
});

describe('the end of the Score (RT re-review, dispatch clamp)', () => {
  it('play from a tick at or past the end tick ends in the first block instead of running silently forever', () => {
    const { proc } = setup(makeSchedule({ noteCount: 3, endTick: 512 }));
    let ended = 0;
    const previous = proc.onMessage;
    proc.onMessage = (msg) => {
      previous?.(msg);
      if (msg.type === 'ended') ended++;
    };
    proc.receiveMessage({ type: 'play', fromTick: 2000 });
    run(proc, 3);
    expect(ended).toBe(1);
  });
});

describe('the tempo message is validated by the worklet (worklet-protocol 1.4.2)', () => {
  function percentAfter(message: unknown): number {
    const { proc, reports } = setup();
    proc.receiveMessage({ type: 'play' });
    run(proc, 12);
    proc.receiveMessage({ type: 'tempo', percent: message } as never);
    run(proc, 12);
    for (const r of reports) {
      expect(Number.isFinite(r.tick), 'every reported tick is finite').toBe(true);
      expect(Number.isFinite(r.ticksPerFrame)).toBe(true);
    }
    return measuredPercent(reports);
  }

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a string', '80'],
    ['undefined', undefined],
    ['null', null],
  ])('%s is ignored: the tempo stays at 100 %%', (_name, value) => {
    expect(percentAfter(value)).toBeCloseTo(100, 6);
  });

  it.each([
    [500, 200],
    [10, 25],
    [0, 25],
    [-5, 25],
    [83.3333, 83.3333],
  ])('%s is clamped to the range: %s %%', (sent, expected) => {
    expect(percentAfter(sent)).toBeCloseTo(expected, 6);
  });
});

describe('a position report carries the rate of the segment the tick is in', () => {
  it('120 qpm then 60 qpm: 2 ticks per frame before the change, 1 after', () => {
    const { proc, reports } = setup(
      makeSchedule({
        tempo: [
          { tick: 0, qpm: 120 },
          { tick: 2560, qpm: 60 },
        ],
      }),
    );
    proc.receiveMessage({ type: 'play' });
    run(proc, 4);
    const early = reports[reports.length - 1] as Report;
    expect(early.tick).toBeLessThan(2560);
    expect(early.ticksPerFrame).toBeCloseTo(2, 10);

    run(proc, 12); // well past tick 2560
    const late = reports[reports.length - 1] as Report;
    expect(late.tick).toBeGreaterThan(2560);
    expect(late.ticksPerFrame).toBeCloseTo(1, 10);
  });
});
