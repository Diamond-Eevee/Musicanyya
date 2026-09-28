import { describe, expect, it } from 'vitest';
import {
  atLeast,
  bestEligible,
  compareResults,
  masteryEligible,
  percentShown,
  strictnessRank,
} from '../../../src/core/progress/compare.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { result } from '../../fakes/progress-builders.js';

describe('compareResults (data-model.md §2, FR-023, R-8)', () => {
  it('orders by notes correct first', () => {
    const worse = result({ notesCorrect: { count: 70, total: 100 } });
    const better = result({ notesCorrect: { count: 80, total: 100 } });
    expect(compareResults(better, worse)).toBeGreaterThan(0);
    expect(compareResults(worse, better)).toBeLessThan(0);
  });

  it('then by notes on time, when notes correct ties', () => {
    const worse = result({ notesCorrect: { count: 80, total: 100 }, notesOnTime: { count: 50, total: 80 } });
    const better = result({ notesCorrect: { count: 80, total: 100 }, notesOnTime: { count: 70, total: 80 } });
    expect(compareResults(better, worse)).toBeGreaterThan(0);
  });

  it('then by later finishedAt, when both figures tie', () => {
    const earlier = result({ finishedAt: '2026-01-01T00:00:00.000Z' });
    const later = result({ finishedAt: '2026-01-02T00:00:00.000Z' });
    expect(compareResults(later, earlier)).toBeGreaterThan(0);
    expect(compareResults(earlier, earlier)).toBe(0);
  });

  it('uses exact integer cross-multiplication - a float division tie or flip never happens', () => {
    // 2/3 = 0.6666..., 666666/1000000 = 0.666666: as floats these can compare either way depending on rounding,
    // but 2*1000000 (2000000) > 666666*3 (1999998), so 2/3 is genuinely (if very slightly) larger.
    const a = result({ notesCorrect: { count: 2, total: 3 } });
    const b = result({ notesCorrect: { count: 666666, total: 1000000 } });
    expect(compareResults(a, b)).toBeGreaterThan(0);
    expect(compareResults(b, a)).toBeLessThan(0);
  });

  it('0 of 0 counts as 0, not a tie-breaking float NaN', () => {
    const zero = result({ notesCorrect: { count: 0, total: 0 } });
    const some = result({ notesCorrect: { count: 1, total: 100 } });
    expect(compareResults(some, zero)).toBeGreaterThan(0);
    expect(compareResults(zero, zero)).toBe(0);
  });
});

describe('percentShown (R-8: rounds down, null for 0 of 0)', () => {
  it('rounds down', () => {
    expect(percentShown({ count: 89, total: 100 })).toBe(89);
    expect(percentShown({ count: 895, total: 1000 })).toBe(89); // 89.5% shown as 89, never rounded up
  });

  it('returns null for 0 of 0', () => {
    expect(percentShown({ count: 0, total: 0 })).toBeNull();
  });

  it('is 0 for 0 of some', () => {
    expect(percentShown({ count: 0, total: 10 })).toBe(0);
  });
});

describe('atLeast (integer threshold, R-8)', () => {
  it('is true exactly at the threshold', () => {
    expect(atLeast({ count: 90, total: 100 }, 90)).toBe(true);
  });

  it('is false one point below the threshold', () => {
    expect(atLeast({ count: 89, total: 100 }, 90)).toBe(false);
  });

  it('is true one point above the threshold', () => {
    expect(atLeast({ count: 91, total: 100 }, 90)).toBe(true);
  });

  it('is false for 0 of 0 against any positive threshold', () => {
    expect(atLeast({ count: 0, total: 0 }, 1)).toBe(false);
  });

  it('never disagrees with percentShown at the threshold (R-8: a shown "90%" is never paired with "not eligible")', () => {
    // Every count/total pair whose floored percentage is >= 90 must also satisfy atLeast(..., 90), and vice versa
    // in the only direction that matters here (percentShown >= threshold implies atLeast).
    for (let total = 1; total <= 37; total++) {
      for (let count = 0; count <= total; count++) {
        const shown = percentShown({ count, total });
        if (shown !== null && shown >= 90) {
          expect(atLeast({ count, total }, 90), `${count}/${total} shows ${shown}%`).toBe(true);
        }
      }
    }
  });
});

describe('bestEligible (FR-010, FR-023, OD-1)', () => {
  it('accepts a complete whole-Score run', () => {
    expect(bestEligible(result({ complete: true, scope: { kind: 'whole' } }))).toBe(true);
  });

  it('accepts a legacy run whose completeness is unknown (R-6)', () => {
    expect(bestEligible(result({ complete: null, scope: { kind: 'whole' } }))).toBe(true);
  });

  it('rejects a stopped run', () => {
    expect(bestEligible(result({ complete: false, scope: { kind: 'whole' } }))).toBe(false);
  });

  it('rejects a partial-scope run even when complete (OD-1)', () => {
    expect(
      bestEligible(result({ complete: true, scope: { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: null } })),
    ).toBe(false);
  });
});

describe('masteryEligible (FR-024, OD-1, OD-2)', () => {
  const eligible = () =>
    result({
      complete: true,
      scope: { kind: 'whole' },
      tempoPercent: 100,
      notesCorrect: { count: 90, total: 100 },
      notesOnTime: { count: 80, total: 100 },
      strictness: 'beginner',
      extra: 0,
    });

  it('accepts a run that exactly meets every threshold', () => {
    expect(masteryEligible(eligible(), DEFAULT_MASTERY_THRESHOLDS)).toBe(true);
  });

  it('rejects complete: null (legacy runs never grant Mastered, R-6)', () => {
    expect(masteryEligible({ ...eligible(), complete: null }, DEFAULT_MASTERY_THRESHOLDS)).toBe(false);
  });

  it('rejects complete: false', () => {
    expect(masteryEligible({ ...eligible(), complete: false }, DEFAULT_MASTERY_THRESHOLDS)).toBe(false);
  });

  it('rejects a partial scope', () => {
    expect(
      masteryEligible(
        { ...eligible(), scope: { kind: 'partial', fromMeasure: null, toMeasure: null, hands: 'right' } },
        DEFAULT_MASTERY_THRESHOLDS,
      ),
    ).toBe(false);
  });

  it('rejects tempo just below the minimum', () => {
    expect(masteryEligible({ ...eligible(), tempoPercent: 99 }, DEFAULT_MASTERY_THRESHOLDS)).toBe(false);
  });

  it('accepts tempo above the minimum', () => {
    expect(masteryEligible({ ...eligible(), tempoPercent: 120 }, DEFAULT_MASTERY_THRESHOLDS)).toBe(true);
  });

  it('rejects notes correct one point below the minimum', () => {
    expect(
      masteryEligible({ ...eligible(), notesCorrect: { count: 89, total: 100 } }, DEFAULT_MASTERY_THRESHOLDS),
    ).toBe(false);
  });

  it('rejects notes on time one point below the minimum', () => {
    expect(masteryEligible({ ...eligible(), notesOnTime: { count: 79, total: 100 } }, DEFAULT_MASTERY_THRESHOLDS)).toBe(
      false,
    );
  });

  it('rejects strictness below the minimum', () => {
    // beginner is the loosest MASTERY_MIN_STRICTNESS, so nothing is actually below it - use a raised threshold.
    const stricter = { ...DEFAULT_MASTERY_THRESHOLDS, minStrictness: 'standard' as const };
    expect(masteryEligible(eligible(), stricter)).toBe(false);
    expect(masteryEligible({ ...eligible(), strictness: 'standard' }, stricter)).toBe(true);
  });

  it('rejects extra notes over the OD-2 cap and accepts at the cap', () => {
    // 10% of 100 notes total = 10; the cap compares extra against notesCorrect.total (the "notes total").
    expect(masteryEligible({ ...eligible(), extra: 10 }, DEFAULT_MASTERY_THRESHOLDS)).toBe(true);
    expect(masteryEligible({ ...eligible(), extra: 11 }, DEFAULT_MASTERY_THRESHOLDS)).toBe(false);
  });

  it('never rejects on extra notes when the cap is disabled (OD-2 declined, maxExtraPercent: null)', () => {
    const noCap = { ...DEFAULT_MASTERY_THRESHOLDS, maxExtraPercent: null };
    expect(masteryEligible({ ...eligible(), extra: 1000 }, noCap)).toBe(true);
  });
});

describe('strictnessRank (ordering for the mastery threshold, FR-024)', () => {
  it('orders beginner < standard < strict', () => {
    expect(strictnessRank('beginner')).toBeLessThan(strictnessRank('standard'));
    expect(strictnessRank('standard')).toBeLessThan(strictnessRank('strict'));
  });
});
