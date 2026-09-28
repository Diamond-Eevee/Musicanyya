/** data-model.md §4 - the one way a `ProgressRecord` changes. Pure (Principle V): no DOM, no Web API, no clock -
 *  every event carries its own time. */
import { PROGRESS_FORMAT_VERSION, PROGRESS_RESULTS_MAX } from '../defaults.js';
import { bestEligible, compareResults, masteryEligible } from './compare.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord, ProgressResult } from './types.js';

function maxTime(a: string | null, b: string): string {
  return a === null || Date.parse(b) > Date.parse(a) ? b : a;
}

function emptyRecord(scoreKey: string, at: string): ProgressRecord {
  return {
    format: PROGRESS_FORMAT_VERSION,
    scoreKey,
    updatedAt: at,
    firstOpenedAt: null,
    lastOpenedAt: null,
    openedAs: null,
    lastPractisedAt: null,
    practisedBars: null,
    attempts: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
    best: null,
    masteredAt: null,
    masteredBy: null,
    results: [],
  };
}

/** The best of the given eligible results, or null if none are eligible - `compareResults` decides "best". */
function recomputeBest(results: readonly ProgressResult[]): ProgressResult | null {
  return results
    .filter(bestEligible)
    .reduce<ProgressResult | null>((best, r) => (best === null || compareResults(r, best) > 0 ? r : best), null);
}

/** The earliest (by `finishedAt`) mastering result, or null if none of the given results master (R-12: after a
 *  removal, mastery is recomputed from what remains, keeping "first mastering result" as the record of when it
 *  was first earned). */
function recomputeMastering(
  results: readonly ProgressResult[],
  thresholds: MasteryThresholds,
): { at: string; by: string } | null {
  const mastering = results.filter((r) => masteryEligible(r, thresholds));
  if (mastering.length === 0) return null;
  const earliest = mastering.reduce((a, b) => (Date.parse(b.finishedAt) < Date.parse(a.finishedAt) ? b : a));
  return { at: earliest.finishedAt, by: earliest.runId };
}

function applyOpened(record: ProgressRecord, event: Extract<ProgressEvent, { type: 'opened' }>): ProgressRecord {
  const isNewest = record.lastOpenedAt === null || Date.parse(event.at) >= Date.parse(record.lastOpenedAt);
  return {
    ...record,
    firstOpenedAt: record.firstOpenedAt ?? event.at,
    lastOpenedAt: maxTime(record.lastOpenedAt, event.at),
    openedAs: isNewest ? event.as : record.openedAs,
  };
}

function applyPractised(record: ProgressRecord, event: Extract<ProgressEvent, { type: 'practised' }>): ProgressRecord {
  const isNewest = record.lastPractisedAt === null || Date.parse(event.at) >= Date.parse(record.lastPractisedAt);
  return {
    ...record,
    lastPractisedAt: maxTime(record.lastPractisedAt, event.at),
    practisedBars: isNewest ? { fromMeasure: event.fromMeasure, toMeasure: event.toMeasure } : record.practisedBars,
  };
}

function applyPlayed(
  record: ProgressRecord,
  event: Extract<ProgressEvent, { type: 'played' }>,
  thresholds: MasteryThresholds,
): ProgressRecord {
  const { result } = event;
  const alreadyRecorded = record.results.some((r) => r.runId === result.runId) || record.best?.runId === result.runId;
  if (alreadyRecorded) return record;

  const results = [...record.results, result]
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    .slice(0, PROGRESS_RESULTS_MAX);
  const best =
    bestEligible(result) && (record.best === null || compareResults(result, record.best) > 0) ? result : record.best;
  const mastering =
    record.masteredAt === null && masteryEligible(result, thresholds)
      ? { at: result.finishedAt, by: result.runId }
      : null;

  return {
    ...record,
    attempts: record.attempts + 1,
    firstPlayedAt: record.firstPlayedAt ?? event.at,
    lastPlayedAt: maxTime(record.lastPlayedAt, event.at),
    results,
    best,
    masteredAt: mastering?.at ?? record.masteredAt,
    masteredBy: mastering?.by ?? record.masteredBy,
  };
}

function applyResultRemoved(
  record: ProgressRecord,
  event: Extract<ProgressEvent, { type: 'resultRemoved' }>,
  thresholds: MasteryThresholds,
): ProgressRecord {
  const found = record.results.some((r) => r.runId === event.runId);
  if (!found) return record; // unknown runId: no change at all (data-model.md §4)

  const results = record.results.filter((r) => r.runId !== event.runId);
  const best = record.best?.runId === event.runId ? recomputeBest(results) : record.best;
  const mastering = record.masteredBy === event.runId ? recomputeMastering(results, thresholds) : undefined;

  return {
    ...record,
    attempts: record.attempts - 1,
    results,
    best,
    ...(mastering !== undefined ? { masteredAt: mastering?.at ?? null, masteredBy: mastering?.by ?? null } : {}),
  };
}

/** data-model.md §4: the one way a `ProgressRecord` changes. `reset` deletes it (returns null); every other event
 *  on a null record starts a fresh one. `updatedAt` is the max of every event time seen, applied or not (except
 *  `resultRemoved` of an unknown `runId`, which changes nothing at all - not even that). */
export function applyProgressEvent(
  record: ProgressRecord | null,
  scoreKey: string,
  event: ProgressEvent,
  thresholds: MasteryThresholds,
): ProgressRecord | null {
  if (event.type === 'reset') return null;
  if (event.type === 'resultRemoved' && record === null) return null;

  const base = record ?? emptyRecord(scoreKey, event.at);
  const updated =
    event.type === 'opened'
      ? applyOpened(base, event)
      : event.type === 'practised'
        ? applyPractised(base, event)
        : event.type === 'played'
          ? applyPlayed(base, event, thresholds)
          : applyResultRemoved(base, event, thresholds);

  if (updated === base && record !== null) return record; // resultRemoved, unknown runId: genuinely unchanged
  return { ...updated, updatedAt: maxTime(updated.updatedAt, event.at) };
}
