/** data-model.md §2, research.md R-6 - turns a stored Play run into a `ProgressResult`. Pure (Principle V). */
import type { StoredPerformance } from '../grade/types.js';
import { scopeFromStoredSettings } from './scope.js';
import type { ProgressResult, ResultScope } from './types.js';

/** Copies the two figures and the extra count from the summary (FR-009), tempo and strictness from the settings,
 *  and `complete` straight through (`undefined` becomes `null` - "not recorded", R-6). `scope` is the caller's own
 *  (computed live with the loaded Score, R-7) when given; otherwise the legacy rule for a run with no live Score. */
export function resultFromStoredPerformance(p: StoredPerformance, scope?: ResultScope): ProgressResult {
  return {
    runId: p.runId,
    finishedAt: p.finishedAt,
    notesCorrect: p.summary.notesCorrect,
    notesOnTime: p.summary.notesOnTime,
    extra: p.summary.counts.extra,
    tempoPercent: p.settings.tempoPercent,
    strictness: p.settings.strictness,
    complete: p.complete ?? null,
    scope: scope ?? scopeFromStoredSettings(p.settings),
  };
}
