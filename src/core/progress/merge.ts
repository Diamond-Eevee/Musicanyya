/** data-model.md §5/§6 - combines a current content hash's progress with older hashes of the same entry (a
 *  library item's `supersedes[].hash`, or a *My files* entry's `earlierHashes`). Mechanics shared by both: attempts
 *  sum over every hash, history merges every result newest first (capped `PROGRESS_RESULTS_MAX`). Status, best,
 *  Mastered and trend differ by caller (data-model.md §5 vs §6) - see `currentOnlyView` and `pooledView` below.
 *  Pure (Principle V): no DOM, no Web API. */
import { PROGRESS_RESULTS_MAX } from '../defaults.js';
import { compareFigures, compareResults } from './compare.js';
import { deriveStatus, type ProgressStatus, type Trend, trend } from './status.js';
import type { ProgressRecord, ProgressResult } from './types.js';

export interface HistoryEntry {
  result: ProgressResult;
  fromCurrentHash: boolean;
}

export interface MergedRecords {
  current: ProgressRecord | null;
  older: readonly ProgressRecord[]; // records found for the given older hashes, in no particular order
  attempts: number;
  history: readonly HistoryEntry[]; // newest first, at most PROGRESS_RESULTS_MAX
}

export function mergeRecords(
  records: ReadonlyMap<string, ProgressRecord>,
  currentHash: string,
  olderHashes: readonly string[],
): MergedRecords {
  const current = records.get(currentHash) ?? null;
  const older = olderHashes
    .map((hash) => records.get(hash))
    .filter((record): record is ProgressRecord => record !== undefined);

  const attempts = (current?.attempts ?? 0) + older.reduce((sum, r) => sum + r.attempts, 0);
  const history = [
    ...(current?.results.map((result) => ({ result, fromCurrentHash: true })) ?? []),
    ...older.flatMap((r) => r.results.map((result) => ({ result, fromCurrentHash: false }))),
  ]
    .sort((a, b) => Date.parse(b.result.finishedAt) - Date.parse(a.result.finishedAt))
    .slice(0, PROGRESS_RESULTS_MAX);

  return { current, older, attempts, history };
}

export interface ProgressView {
  status: ProgressStatus;
  best: ProgressResult | null;
  trend: Trend;
  lastPlayedAt: string | null;
}

/** data-model.md §5 (*My files* `entryProgress`): status, best, *Mastered* and trend come from the current hash
 *  only - an edited file's new content starts over even if its earlier content had progress. */
export function currentOnlyView(merged: MergedRecords): ProgressView {
  return {
    status: deriveStatus(merged.current),
    best: merged.current?.best ?? null,
    trend: trend(merged.current),
    lastPlayedAt: merged.current?.lastPlayedAt ?? null,
  };
}

/** data-model.md §6 (library `supersedes`): a superseded result "counts as current", so status, best, Mastered and
 *  trend are derived over the whole pool - not just the current hash - because the library decided the
 *  replacement is the same piece. `best`/`masteredAt` are each already the sticky maximum/earliest *within* one
 *  record (the reducer maintains them across that record's own trimming), so pooling them across records is a
 *  second `compareResults`/earliest-date reduction, not a re-derivation from raw results. */
export function pooledView(merged: MergedRecords): ProgressView {
  const all = merged.current ? [merged.current, ...merged.older] : merged.older;

  const best = all.reduce<ProgressResult | null>((best, r) => {
    if (r.best === null) return best;
    return best === null || compareResults(r.best, best) > 0 ? r.best : best;
  }, null);

  const mastered = all.filter(
    (r): r is ProgressRecord & { masteredAt: string; masteredBy: string } => r.masteredAt !== null,
  );
  const earliestMastered =
    mastered.length === 0
      ? null
      : mastered.reduce((a, b) => (Date.parse(b.masteredAt) < Date.parse(a.masteredAt) ? b : a));

  const status: ProgressStatus =
    earliestMastered !== null
      ? 'mastered'
      : merged.attempts > 0
        ? 'played'
        : all.some((r) => r.lastPractisedAt !== null)
          ? 'practised'
          : 'new';

  const [last, previous] = merged.history;
  const pooledTrend: Trend =
    last === undefined || previous === undefined
      ? null
      : ((cmp) => (cmp > 0 ? 'up' : cmp < 0 ? 'down' : 'same'))(compareFigures(last.result, previous.result));

  const lastPlayedAt = all.reduce<string | null>((max, r) => {
    if (r.lastPlayedAt === null) return max;
    return max === null || Date.parse(r.lastPlayedAt) > Date.parse(max) ? r.lastPlayedAt : max;
  }, null);

  return { status, best, trend: pooledTrend, lastPlayedAt };
}
