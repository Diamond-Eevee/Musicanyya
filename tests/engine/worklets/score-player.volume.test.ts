/**
 * 017 T033 (RT review T015 N6; 001 FR-016 "Users MUST be able to set the playback volume"): the `volume` message
 * (0..1 linear, worklet-protocol) changes the loudness of what the worklet renders. The processor ramped a gain but
 * never multiplied it into the output, so the volume control had no audible effect.
 *
 * The fake synth renders a constant 1.0 on both channels, so every output sample is exactly the gain applied to it.
 */

import { describe, expect, it } from 'vitest';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { VOLUME_DEFAULT, VOLUME_RAMP_FRAMES } from '../../../src/engine/config.js';
import {
  createScorePlayerProcessor,
  type ScorePlayerProcessor,
  type SynthInterface,
} from '../../../src/engine/worklets/score-player.processor.js';

const SAMPLE_RATE = 480;
const BLOCK_SIZE = 128;

/** Renders a constant 1.0 into the range it is asked for; records nothing else. */
class ConstantSynth implements SynthInterface {
  noteOn() {}
  noteOff() {}
  process(left: Float32Array, right: Float32Array, startIndex: number, sampleCount: number) {
    left.fill(1, startIndex, startIndex + sampleCount);
    right.fill(1, startIndex, startIndex + sampleCount);
  }
}

/** A note every 100 ticks (several events, so sub-blocks, per block), at 120 qpm = 2 ticks per frame. */
function denseSchedule(): ScheduleMessage {
  const count = 200;
  return {
    type: 'schedule',
    ppq: 480,
    endTick: 1_000_000,
    eventTick: Int32Array.from({ length: count }, (_, k) => k * 100),
    eventKind: new Uint8Array(count).fill(EVENT_KIND.noteOn),
    eventChannel: new Uint8Array(count),
    eventData1: new Uint8Array(count).fill(60),
    eventData2: new Uint8Array(count).fill(80),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: new Int32Array(1).fill(1),
    channelSetup: new Uint8Array(64),
  };
}

function setup(volume?: number): ScorePlayerProcessor {
  return createScorePlayerProcessor({ synth: new ConstantSynth(), sampleRate: SAMPLE_RATE, volume });
}

/** Renders `blocks` blocks and returns every sample of both channels, in order. */
function render(proc: ScorePlayerProcessor, blocks: number): { left: number[]; right: number[] } {
  const out = { left: [] as number[], right: [] as number[] };
  const left = new Float32Array(BLOCK_SIZE);
  const right = new Float32Array(BLOCK_SIZE);
  for (let i = 0; i < blocks; i++) {
    proc.processBlock(left, right);
    out.left.push(...left);
    out.right.push(...right);
  }
  return out;
}

const RAMP_BLOCKS = Math.ceil(VOLUME_RAMP_FRAMES / BLOCK_SIZE);

describe('the volume message scales the rendered output (017 T033, 001 FR-016)', () => {
  it('the initial volume option applies: 50 renders at half amplitude, 100 at full', () => {
    for (const sample of render(setup(50), 2).left) expect(sample).toBeCloseTo(0.5, 6);
    for (const sample of render(setup(100), 2).left) expect(sample).toBeCloseTo(1, 6);
  });

  it('an initial volume option that is not a finite number falls back to the default; one out of range is clamped (017 T034)', () => {
    for (const sample of render(setup(Number.NaN), 1).left) expect(sample).toBeCloseTo(VOLUME_DEFAULT / 100, 6);
    for (const sample of render(setup(250), 1).left) expect(sample).toBeCloseTo(1, 6);
    for (const sample of render(setup(-10), 1).left) expect(sample).toBe(0);
  });

  it('after the ramp, volume 0.5 renders at half the amplitude of 1.0, on both channels', () => {
    const proc = setup(100);
    proc.receiveMessage({ type: 'volume', gain: 0.5 });
    render(proc, RAMP_BLOCKS);
    const after = render(proc, 2);
    for (const sample of after.left) expect(sample).toBeCloseTo(0.5, 6);
    for (const sample of after.right) expect(sample).toBeCloseTo(0.5, 6);
  });

  it('volume 0 is silent', () => {
    const proc = setup(100);
    proc.receiveMessage({ type: 'volume', gain: 0 });
    render(proc, RAMP_BLOCKS);
    for (const sample of render(proc, 2).left) expect(sample).toBe(0);
  });

  it('applies while playing too, across the sub-blocks split at each event', () => {
    const proc = setup(100);
    proc.receiveMessage({ ...denseSchedule() });
    proc.receiveMessage({ type: 'play' });
    proc.receiveMessage({ type: 'volume', gain: 0.25 });
    render(proc, RAMP_BLOCKS);
    for (const sample of render(proc, 4).left) expect(sample).toBeCloseTo(0.25, 6);
  });

  it('a change ramps per sample over VOLUME_RAMP_FRAMES: no step larger than one ramp increment (no click)', () => {
    const proc = setup(100);
    render(proc, 1);
    proc.receiveMessage({ type: 'volume', gain: 0.2 });
    const { left } = render(proc, RAMP_BLOCKS + 1);
    const increment = (1 - 0.2) / VOLUME_RAMP_FRAMES;
    let previous = 1;
    for (const sample of left) {
      expect(previous - sample).toBeGreaterThanOrEqual(-1e-6); // falls monotonically
      expect(previous - sample).toBeLessThanOrEqual(increment + 1e-6);
      previous = sample;
    }
    expect(left[0]).toBeLessThan(1); // the ramp starts at once, not at the next block
    expect(left[VOLUME_RAMP_FRAMES - 1]).toBeCloseTo(0.2, 6);
    expect(left.at(-1)).toBeCloseTo(0.2, 6);
  });
});
