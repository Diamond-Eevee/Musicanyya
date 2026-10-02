/**
 * Feature 019, US1 (spec FR-003 to FR-005, SC-001, SC-002 Metronome half, SC-009 Metronome half; mixer-levels.md
 * section 5): the Metronome level only scales the click. A Play run of `repertoire/beginner/ode-to-joy` is rendered
 * offline through the real score-player processor, the real SpessaSynth and the shipped SoundFont, the click channel set
 * the way `PlaySessionController.start()` sets it, at levels 100, 50 and 0.
 */
import { describe, expect, it } from 'vitest';
import {
  METRONOME_CHANNEL,
  METRONOME_LEVEL_DEFAULT,
  ORCHESTRA_SILENT_TOLERANCE_DBFS as SILENT_DBFS,
} from '../../src/core/defaults.js';
import { metronomeChannelVolume } from '../../src/core/play/metronome.js';
import { renderPlayRun, SAMPLE_RATE } from './helpers/listen-render.js';

const FILE = 'repertoire/beginner/ode-to-joy.musicxml';
const RUN_SECONDS = 8;
const SWEEP_SECONDS = 10;
const BLOCK = 128;

// Test-only thresholds, not product settings.
const ONSET_SILENT = 1e-6; // the first sample louder than this is where a click is heard to start
const ROUNDING = 1e-5; // float32 rounding between two sums of the same voices
const ms = (n: number) => Math.round((n / 1000) * SAMPLE_RATE);

function rms(left: Float32Array, right: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < left.length; i++) sum += (left[i] as number) ** 2 + (right[i] as number) ** 2;
  return Math.sqrt(sum / (2 * left.length));
}

/** The first frame at or after `from` and before `to` that is audible, or -1. */
function onsetIn(left: Float32Array, right: Float32Array, from: number, to: number): number {
  for (let i = from; i < Math.min(to, left.length); i++) {
    if (Math.abs(left[i] as number) > ONSET_SILENT || Math.abs(right[i] as number) > ONSET_SILENT) return i;
  }
  return -1;
}

function maxAbsDifference(a: Float32Array, b: Float32Array): number {
  expect(a.length).toBe(b.length);
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs((a[i] as number) - (b[i] as number)));
  return max;
}

const clickOnly = (level: number, muted = false) =>
  renderPlayRun(FILE, {
    seconds: RUN_SECONDS,
    accompaniment: false,
    metronomeVolume: metronomeChannelVolume(muted, level),
  });
const withMusic = (level: number, muted = false) =>
  renderPlayRun(FILE, {
    seconds: RUN_SECONDS,
    accompaniment: true,
    metronomeVolume: metronomeChannelVolume(muted, level),
  });

describe('the Metronome level, offline (019 US1)', () => {
  it('every click starts at the same frame at levels 100, 50 and 0, and the click RMS falls with the level (SC-001)', () => {
    const full = clickOnly(100);
    const half = clickOnly(50);
    const off = clickOnly(0);

    expect(full.clickFrames.length).toBeGreaterThan(8); // the count-in and several bars of clicks are in the span
    expect(half.clickFrames).toEqual(full.clickFrames); // the schedule itself does not depend on the level
    expect(off.clickFrames).toEqual(full.clickFrames);

    full.clickFrames.forEach((frame, index) => {
      const next = full.clickFrames[index + 1] ?? Number.POSITIVE_INFINITY;
      const window = Math.min(frame + ms(50), next);
      const fullOnset = onsetIn(full.left, full.right, frame, window);
      const halfOnset = onsetIn(half.left, half.right, frame, window);
      expect(fullOnset, `click ${index} sounds at 100 %`).toBeGreaterThanOrEqual(frame);
      expect(halfOnset, `click ${index} sounds at 50 %`).toBeGreaterThanOrEqual(frame);
      // heard to start within 1 sample of each other (SC-001), and within a few ms of its scheduled frame
      expect(Math.abs(halfOnset - fullOnset), `click ${index} onset, 100 % vs 50 %`).toBeLessThanOrEqual(1);
      expect((fullOnset - frame) / SAMPLE_RATE, `click ${index} onset delay`).toBeLessThanOrEqual(0.003);
    });

    const rmsFull = rms(full.left, full.right);
    const rmsHalf = rms(half.left, half.right);
    expect(rmsFull).toBeGreaterThan(0.001);
    expect(rmsHalf).toBeGreaterThan(0);
    expect(rmsHalf).toBeLessThan(rmsFull);
    expect(20 * Math.log10(rms(off.left, off.right) + Number.MIN_VALUE)).toBeLessThan(SILENT_DBFS); // CC7 = 0 is silent
  }, 180_000);

  it('level 0 equals a muted run sample for sample (SC-002, Metronome part)', () => {
    const levelZero = clickOnly(0);
    const muted = clickOnly(METRONOME_LEVEL_DEFAULT, true);
    expect(maxAbsDifference(levelZero.left, muted.left)).toBe(0);
    expect(maxAbsDifference(levelZero.right, muted.right)).toBe(0);

    const levelZeroMusic = withMusic(0);
    const mutedMusic = withMusic(METRONOME_LEVEL_DEFAULT, true);
    expect(rms(levelZeroMusic.left, levelZeroMusic.right)).toBeGreaterThan(0.001); // the accompaniment is audible
    expect(maxAbsDifference(levelZeroMusic.left, mutedMusic.left)).toBe(0);
    expect(maxAbsDifference(levelZeroMusic.right, mutedMusic.right)).toBe(0);
  }, 180_000);

  it('with the accompaniment on, everything but the click is the same at every level', () => {
    const reference = withMusic(0); // the click is silent: this is the non-click part
    for (const level of [100, 50]) {
      const mixed = withMusic(level);
      const click = clickOnly(level);
      const rest = new Float32Array(mixed.left.length);
      const restRight = new Float32Array(mixed.right.length);
      for (let i = 0; i < rest.length; i++) {
        rest[i] = (mixed.left[i] as number) - (click.left[i] as number);
        restRight[i] = (mixed.right[i] as number) - (click.right[i] as number);
      }
      expect(maxAbsDifference(rest, reference.left), `left channel at ${level} %`).toBeLessThan(ROUNDING);
      expect(maxAbsDifference(restRight, reference.right), `right channel at ${level} %`).toBeLessThan(ROUNDING);
    }
  }, 180_000);

  it('moving the level every render block for 10 s adds no late event and no dropped message (SC-009, Metronome half)', () => {
    // a triangle between 0 and 1 with a period of 2 s, a new value in every block
    const gainAt = (frame: number) => {
      const phase = ((frame / SAMPLE_RATE) % 2) / 2;
      return phase < 0.5 ? phase * 2 : 2 - phase * 2;
    };
    const sweep = (frame: number, send: (msg: { type: string; [field: string]: unknown }) => void) =>
      send({ type: 'channelVolume', channel: METRONOME_CHANNEL, gain: gainAt(frame) });

    const steady = renderPlayRun(FILE, { seconds: SWEEP_SECONDS, accompaniment: true, metronomeVolume: 100 });
    const swept = renderPlayRun(FILE, {
      seconds: SWEEP_SECONDS,
      accompaniment: true,
      metronomeVolume: 100,
      beforeBlock: sweep,
    });
    expect(SWEEP_SECONDS * SAMPLE_RATE).toBeGreaterThan(BLOCK * 1000); // a message in each of well over a thousand blocks
    expect(swept.lateEvents).toBe(steady.lateEvents);
    expect(swept.messages.some((m) => m.type === 'liveDropped')).toBe(false);
    expect(swept.messages.some((m) => m.type === 'status')).toBe(false); // no fault, no error

    // the clicks that are loud enough to be heard start where they start without the sweep (SC-001)
    const steadyClicks = renderPlayRun(FILE, { seconds: SWEEP_SECONDS, accompaniment: false, metronomeVolume: 100 });
    const sweptClicks = renderPlayRun(FILE, {
      seconds: SWEEP_SECONDS,
      accompaniment: false,
      metronomeVolume: 100,
      beforeBlock: sweep,
    });
    let compared = 0;
    steadyClicks.clickFrames.forEach((frame, index) => {
      if (gainAt(frame) < 0.5) return;
      const next = steadyClicks.clickFrames[index + 1] ?? Number.POSITIVE_INFINITY;
      const window = Math.min(frame + ms(50), next);
      const steadyOnset = onsetIn(steadyClicks.left, steadyClicks.right, frame, window);
      const sweptOnset = onsetIn(sweptClicks.left, sweptClicks.right, frame, window);
      expect(sweptOnset, `click ${index} is heard while the level moves`).toBeGreaterThanOrEqual(frame);
      expect(Math.abs(sweptOnset - steadyOnset), `click ${index} onset`).toBeLessThanOrEqual(1);
      compared++;
    });
    expect(compared).toBeGreaterThan(4);
  }, 300_000);
});
