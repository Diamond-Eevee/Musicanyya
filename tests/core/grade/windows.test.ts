import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_LEVELS } from '../../../src/core/defaults.js';
import type { ExpectedNote, StrictnessLevelName, Window } from '../../../src/core/grade/types.js';
import { resolveWindows } from '../../../src/core/grade/windows.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';
import { loadFixture } from './helpers.js';

const PPQ = 960;

function ticksToMs(ticks: number, qpm: number): number {
  return (ticks / PPQ) * (60 / qpm) * 1000;
}

function measure(time: { beats: string; beatType: number } | null): MeasureInfo {
  return {
    index: 0,
    id: 'm-0' as MeasureInfo['id'],
    label: '1',
    startTick: 0,
    lengthTicks: 0,
    nominalTicks: 0,
    implicit: false,
    beatOffsetTicks: 0,
    time,
  };
}

function expectedNote(onsetTick: number, overrides: Partial<ExpectedNote> = {}): ExpectedNote {
  return {
    index: 0,
    noteIds: ['n1'],
    key: 60,
    onsetTick,
    measureIndex: 0,
    passIndex: 0,
    chordSize: 1,
    arpeggiated: false,
    ...overrides,
  };
}

function singleTempo(qpm: number): TempoSegment[] {
  return [{ startTick: 0, qpmNum: qpm * 100, qpmDen: 100 }];
}

function clampMs(beats: number, floorMs: number, capMs: number, bpm: number): number {
  const beatMs = 60000 / bpm;
  return Math.min(Math.max(beats * beatMs, floorMs), capMs);
}

const LEVEL_NAMES: readonly StrictnessLevelName[] = ['beginner', 'standard', 'strict'];
const WINDOW_KEYS = ['onTimeEarly', 'onTimeLate', 'claim', 'chordSpread', 'arpeggioSpread'] as const;

describe('grade/windows - strictness level invariants (data-model.md section 6, SC-014)', () => {
  it('clamp inertness: floorMs <= beats*375 and capMs >= beats*1000 for every window, over the whole record', () => {
    for (const name of LEVEL_NAMES) {
      const level = PLAY_STRICTNESS_LEVELS[name];
      for (const key of WINDOW_KEYS) {
        const w: Window = level[key];
        expect(w.floorMs, `${name}.${key}.floorMs`).toBeLessThanOrEqual(w.beats * 375);
        expect(w.capMs, `${name}.${key}.capMs`).toBeGreaterThanOrEqual(w.beats * 1000);
      }
    }
  });

  it('no clamp bites between 60 and 160 bpm: the clamped value equals the raw beats*beatMs value', () => {
    for (const bpm of [60, 90, 100, 120, 140, 160]) {
      for (const name of LEVEL_NAMES) {
        const level = PLAY_STRICTNESS_LEVELS[name];
        for (const key of WINDOW_KEYS) {
          const w = level[key];
          const beatMs = 60000 / bpm;
          expect(clampMs(w.beats, w.floorMs, w.capMs, bpm), `${name}.${key} at ${bpm} bpm`).toBeCloseTo(
            w.beats * beatMs,
            6,
          );
        }
      }
    }
  });

  it('onTime <= claim after every clamp, at every strictness level and across the tempo range', () => {
    for (const bpm of [40, 60, 120, 160, 208]) {
      for (const name of LEVEL_NAMES) {
        const level = PLAY_STRICTNESS_LEVELS[name];
        const claim = clampMs(level.claim.beats, level.claim.floorMs, level.claim.capMs, bpm);
        const onTimeEarly = clampMs(level.onTimeEarly.beats, level.onTimeEarly.floorMs, level.onTimeEarly.capMs, bpm);
        const onTimeLate = clampMs(level.onTimeLate.beats, level.onTimeLate.floorMs, level.onTimeLate.capMs, bpm);
        expect(onTimeEarly, `${name} onTimeEarly <= claim at ${bpm} bpm`).toBeLessThanOrEqual(claim);
        expect(onTimeLate, `${name} onTimeLate <= claim at ${bpm} bpm`).toBeLessThanOrEqual(claim);
      }
    }
  });
});

describe('resolveWindows (contracts/grading.md §2)', () => {
  it('the beat is the dotted quarter in 6/8, not the eighth (window-beat-unit-6-8)', () => {
    const { score, timeline } = loadFixture('window-beat-unit-6-8.musicxml', {
      preset: 'both',
      partIndex: 0,
      staves: [1],
    });
    const resolved = resolveWindows(
      timeline.events.map((_, i) => expectedNote(i * 480, { index: i, chordSize: 1 })),
      score.measures,
      timeline.tempo,
      PPQ,
      100,
      'beginner',
    );
    // Beginner onTime, 6/8 dotted-quarter beat (1440 ticks) at 90 qpm: 1/6 * 1440 = 240 ticks raw, unclamped
    // (floor 86.4, cap 259.2). Claim raw is 720 ticks, clamped by the 480-tick neighbour gap to 240 ticks -
    // exactly matching onTime, for a note with a neighbour on both sides.
    const interior = resolved[2]!;
    expect(interior.onTimeEarlyTicks).toBeCloseTo(240, 5);
    expect(interior.claimEarlyTicks).toBeCloseTo(240, 5);
  });

  it('the neighbour clamp gives +-46.9ms for sixteenths at 160bpm (neighbour-clamp-sixteenths-160)', () => {
    const { score, timeline } = loadFixture('neighbour-clamp-sixteenths-160.musicxml', {
      preset: 'both',
      partIndex: 0,
      staves: [1],
    });
    const resolved = resolveWindows(
      timeline.events.map((_, i) => expectedNote(i * 240, { index: i, chordSize: 1 })),
      score.measures,
      timeline.tempo,
      PPQ,
      100,
      'beginner',
    );
    const interior = resolved[3]!;
    expect(interior.claimEarlyTicks).toBeCloseTo(120, 3);
    expect(ticksToMs(interior.claimEarlyTicks, 160)).toBeCloseTo(46.9, 0);
    expect(interior.claimLateTicks).toBeCloseTo(120, 3);
  });

  it('floor and cap bite only outside 60-160 bpm, for a note far from its neighbours', () => {
    const measures = [measure({ beats: '4', beatType: 4 })];
    for (const bpm of [40, 60, 90, 160, 208]) {
      const expected = [expectedNote(0), expectedNote(100000)]; // neighbours far enough away to never clamp
      const resolved = resolveWindows(expected, measures, singleTempo(bpm), PPQ, 100, 'beginner');
      const raw = PLAY_STRICTNESS_LEVELS.beginner.claim;
      const rawTicks = raw.beats * PPQ;
      const floorTicks = (raw.floorMs / 1000) * (bpm / 60) * PPQ;
      const capTicks = (raw.capMs / 1000) * (bpm / 60) * PPQ;
      const expectedClamped = Math.min(Math.max(rawTicks, floorTicks), capTicks);
      expect(resolved[0]!.claimLateTicks, `${bpm} bpm`).toBeCloseTo(expectedClamped, 3);
      if (bpm >= 60 && bpm <= 160) {
        expect(resolved[0]!.claimLateTicks, `${bpm} bpm should be unclamped`).toBeCloseTo(rawTicks, 3);
      }
    }
  });

  it('adjacent claim windows meet exactly at the midpoint, no gap and no overlap, at 40/60/120/160/208 bpm (SC-014)', () => {
    const measures = [measure({ beats: '4', beatType: 4 })];
    const gapTicks = PPQ / 4; // sixteenth notes: close enough that the neighbour clamp always binds
    const expected = Array.from({ length: 5 }, (_, i) => expectedNote(i * gapTicks, { index: i }));
    for (const bpm of [40, 60, 120, 160, 208]) {
      for (const strictness of ['beginner', 'standard', 'strict'] as const) {
        const resolved = resolveWindows(expected, measures, singleTempo(bpm), PPQ, 100, strictness);
        for (let i = 0; i < resolved.length - 1; i++) {
          const meet = resolved[i]!.claimLateTicks + resolved[i + 1]!.claimEarlyTicks;
          expect(meet, `${strictness} at ${bpm} bpm, notes ${i}/${i + 1}`).toBeCloseTo(gapTicks, 5);
        }
      }
    }
  });

  it('a chord member never shrinks its own members windows (chord-spread-rolled, unmarked)', () => {
    const { score, timeline } = loadFixture('chord-spread-rolled.musicxml', {
      preset: 'both',
      partIndex: 0,
      staves: [1],
    });
    const chordNotes = [
      expectedNote(0, { chordSize: 3 }),
      expectedNote(0, { chordSize: 3 }),
      expectedNote(0, { chordSize: 3 }),
    ];
    const resolved = resolveWindows(chordNotes, score.measures, timeline.tempo, PPQ, 100, 'beginner');
    const plainNote = resolveWindows(
      [expectedNote(0, { chordSize: 1 })],
      score.measures,
      timeline.tempo,
      PPQ,
      100,
      'beginner',
    );
    // The chord spread is ADDED to the on-time window, never subtracted; the chord's own members share one
    // onset, so gapBefore/gapAfter (Infinity here, the only onset) never shrinks it either.
    expect(resolved[0]!.onTimeEarlyTicks).toBeGreaterThan(plainNote[0]!.onTimeEarlyTicks);
  });
});
