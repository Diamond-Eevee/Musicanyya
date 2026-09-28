/** data-model.md §3, FR-011, FR-012 - pure derivations from a `ProgressRecord`. No DOM, no Web API (Principle V). */
import { compareFigures, percentShown } from './compare.js';
import type { ProgressRecord, ProgressResult } from './types.js';

export type ProgressStatus = 'new' | 'practised' | 'played' | 'mastered';
export type Trend = 'up' | 'down' | 'same' | null;

/** FR-011: mastered outranks played outranks practised outranks new. `masteredAt` is sticky (R-7), so a record
 *  stays *Mastered* even after a later, worse run. */
export function deriveStatus(record: ProgressRecord | null): ProgressStatus {
  if (record === null) return 'new';
  if (record.masteredAt !== null) return 'mastered';
  if (record.attempts > 0) return 'played';
  if (record.lastPractisedAt !== null) return 'practised';
  return 'new';
}

/** FR-012: `results[0]` (last) vs `results[1]` (previous), by the two figures only - no `finishedAt` tie-break, so
 *  an exact figures tie is "same", never arbitrarily "up" by recency. `null` with fewer than two results. */
export function trend(record: ProgressRecord | null): Trend {
  if (record === null) return null;
  const [last, previous] = record.results;
  if (last === undefined || previous === undefined) return null;
  const cmp = compareFigures(last, previous);
  if (cmp > 0) return 'up';
  if (cmp < 0) return 'down';
  return 'same';
}

/** FR-012: the shown delta - the notes-correct percentage difference in points between the newest two results (a
 *  history, newest first), each side rounded down first (R-8), so it always agrees with the two percentages shown next
 *  to it. `null` with fewer than two results. The one implementation: the browser calls it over a row's history. */
export function resultsDeltaPoints(results: readonly ProgressResult[]): number | null {
  const [last, previous] = results;
  if (last === undefined || previous === undefined) return null;
  return (percentShown(last.notesCorrect) ?? 0) - (percentShown(previous.notesCorrect) ?? 0);
}

/** FR-012: `resultsDeltaPoints` of a record's kept results. `null` with fewer than two. */
export function trendDeltaPoints(record: ProgressRecord | null): number | null {
  return record === null ? null : resultsDeltaPoints(record.results);
}
