import { describe, expect, it } from 'vitest';
import type { RunSettings } from '../../../src/core/play/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { resultScope, scopeFromStoredSettings } from '../../../src/core/progress/scope.js';
import { loadScoreFixture } from './helpers.js';

function settings(overrides: Partial<RunSettings> = {}): RunSettings {
  return {
    range: null,
    tempoPercent: 100,
    selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
    strictness: 'beginner',
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
    ...overrides,
  };
}

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };

describe('resultScope (data-model.md §2, R-7, OD-1) - live, from the loaded Score', () => {
  it('is whole for range null + preset both on a two-staff piano Score', () => {
    const score = loadScoreFixture('grand-staff-two-voices-per-staff.musicxml');
    expect(resultScope(score, settings({ selection: BOTH }))).toEqual({ kind: 'whole' });
  });

  it('is partial with fromMeasure/toMeasure for a range, regardless of hands', () => {
    const score = loadScoreFixture('grand-staff-two-voices-per-staff.musicxml');
    const scope = resultScope(score, settings({ selection: BOTH, range: { fromMeasureIndex: 0, toMeasureIndex: 0 } }));
    expect(scope).toEqual({ kind: 'partial', fromMeasure: 1, toMeasure: 1, hands: null });
  });

  it('a reversed range still gives fromMeasure <= toMeasure in written (1-based) numbers', () => {
    const score = loadScoreFixture('eight-measure-melody.musicxml');
    const scope = resultScope(score, settings({ range: { fromMeasureIndex: 3, toMeasureIndex: 1 } }));
    expect(scope).toEqual({ kind: 'partial', fromMeasure: 2, toMeasure: 4, hands: null });
  });

  it('is partial with hands: "right" for right-hand-only on a two-staff Score whose other staff has notes', () => {
    const score = loadScoreFixture('grand-staff-two-voices-per-staff.musicxml');
    expect(resultScope(score, settings({ selection: RIGHT }))).toEqual({
      kind: 'partial',
      fromMeasure: null,
      toMeasure: null,
      hands: 'right',
    });
  });

  it('is whole for "right" on a one-staff Score (there is no other staff to leave out)', () => {
    const score = loadScoreFixture('eight-measure-melody.musicxml');
    expect(resultScope(score, settings({ selection: { preset: 'right', partIndex: 0, staves: [1] } }))).toEqual({
      kind: 'whole',
    });
  });

  it('is whole for "right" on a two-staff Score whose other (left-hand) staff has no notes at all', () => {
    const score = loadScoreFixture('grand-staff-right-hand-only.musicxml');
    expect(resultScope(score, settings({ selection: RIGHT }))).toEqual({ kind: 'whole' });
  });

  it('a custom selection covering every staff with notes is also whole', () => {
    const score = loadScoreFixture('grand-staff-right-hand-only.musicxml');
    expect(resultScope(score, settings({ selection: { preset: 'custom', partIndex: 0, staves: [1] } }))).toEqual({
      kind: 'whole',
    });
  });
});

describe('scopeFromStoredSettings (R-6, legacy migration - no live Score to check for an empty staff)', () => {
  it('gives whole only for range null + preset both', () => {
    expect(scopeFromStoredSettings(settings({ selection: BOTH }))).toEqual({ kind: 'whole' });
  });

  it('gives partial for any range, even with preset both', () => {
    expect(
      scopeFromStoredSettings(settings({ selection: BOTH, range: { fromMeasureIndex: 0, toMeasureIndex: 1 } })),
    ).toEqual({ kind: 'partial', fromMeasure: 1, toMeasure: 2, hands: null });
  });

  it('gives partial for a non-both preset, even on a one-staff Score it cannot see', () => {
    expect(scopeFromStoredSettings(settings({ selection: RIGHT }))).toEqual({
      kind: 'partial',
      fromMeasure: null,
      toMeasure: null,
      hands: 'right',
    });
  });
});
