/** data-model.md §2, R-8 - pure comparisons over a `ProgressResult`. No DOM, no Web API (Principle V). */
import type { MasteryThresholds, ProgressResult, StrictnessLevelName } from './types.js';

type Fraction = { count: number; total: number };

/** Loosest to strictest, matching the `StrictnessLevelName` union's own declared order. */
const STRICTNESS_RANK: Record<StrictnessLevelName, number> = { beginner: 0, standard: 1, strict: 2 };

export function strictnessRank(name: StrictnessLevelName): number {
  return STRICTNESS_RANK[name];
}

/** Rounded down, so a shown percentage never overstates (R-8). `null` for 0 of 0 (nothing to show). */
export function percentShown(fig: Fraction): number | null {
  return fig.total === 0 ? null : Math.floor((fig.count * 100) / fig.total);
}

/** `count/total >= percent/100`, by integer cross-multiplication - never a float, so a shown percentage and this
 *  threshold check can never disagree (R-8). 0 of 0 is below every positive threshold. */
export function atLeast(fig: Fraction, percent: number): boolean {
  return fig.total > 0 && fig.count * 100 >= percent * fig.total;
}

function extraWithin(r: ProgressResult, maxExtraPercent: number | null): boolean {
  if (maxExtraPercent === null) return true; // OD-2 declined: no cap
  return r.extra * 100 <= maxExtraPercent * r.notesCorrect.total;
}

/** FR-010, FR-023, OD-1: counts for *best* - complete (or unknown, R-6) and covering the whole Score. */
export function bestEligible(r: ProgressResult): boolean {
  return r.complete !== false && r.scope.kind === 'whole';
}

/** FR-024: counts for *Mastered* - every threshold at once, and never from a legacy run of unknown completeness. */
export function masteryEligible(r: ProgressResult, t: MasteryThresholds): boolean {
  return (
    r.complete === true &&
    r.scope.kind === 'whole' &&
    r.tempoPercent >= t.tempoPercentMin &&
    atLeast(r.notesCorrect, t.notesCorrectMinPercent) &&
    atLeast(r.notesOnTime, t.notesOnTimeMinPercent) &&
    strictnessRank(r.strictness) >= strictnessRank(t.minStrictness) &&
    extraWithin(r, t.maxExtraPercent)
  );
}

/** Cross-multiplies two fractions as if a 0-total one were 0/1 ("0 of 0 counts as 0", R-8) - substituting 1 for a
 *  0 total never changes the result, since validation guarantees `count === 0` whenever `total === 0`. */
function crossCompare(a: Fraction, b: Fraction): number {
  const aTotal = a.total === 0 ? 1 : a.total;
  const bTotal = b.total === 0 ? 1 : b.total;
  return a.count * bTotal - b.count * aTotal;
}

/** The two figures only, no `finishedAt` tie-break: notes correct, then notes on time. Positive when `a` is
 *  better, 0 when the figures genuinely tie, negative when `a` is worse. Used by `compareResults` and, without the
 *  date as a tie-break, by `trend` (FR-012: a same-figures pair is "same", not arbitrarily "up" by recency). */
export function compareFigures(a: ProgressResult, b: ProgressResult): number {
  const notesCorrect = crossCompare(a.notesCorrect, b.notesCorrect);
  if (notesCorrect !== 0) return notesCorrect;
  return crossCompare(a.notesOnTime, b.notesOnTime);
}

/** FR-023, R-8: notes correct, then notes on time, then the later `finishedAt`. Positive when `a` is better than
 *  `b`, 0 when equal, negative when `a` is worse. Exact integer cross-multiplication throughout - never a float
 *  division, so two ratios that would tie or flip under rounding (e.g. 2/3 vs 666666/1000000) compare correctly. */
export function compareResults(a: ProgressResult, b: ProgressResult): number {
  const figures = compareFigures(a, b);
  if (figures !== 0) return figures;
  return Date.parse(a.finishedAt) - Date.parse(b.finishedAt);
}
