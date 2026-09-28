// SC-004: the reducer's `best`/last/previous/`attempts` must equal a naive recomputation over the *full*
// untrimmed event history, even though `results` itself keeps only the newest PROGRESS_RESULTS_MAX (data-model.md
// §3 invariants). Fixed seeds, deterministic (no real randomness).
import { describe, expect, it } from 'vitest';
import { PROGRESS_RESULTS_MAX } from '../../../src/core/defaults.js';
import { bestEligible, compareResults } from '../../../src/core/progress/compare.js';
import { applyProgressEvent } from '../../../src/core/progress/reduce.js';
import {
  DEFAULT_MASTERY_THRESHOLDS,
  type ProgressEvent,
  type ProgressResult,
} from '../../../src/core/progress/types.js';
import { historyOf } from '../../fakes/progress-builders.js';

const KEY = 'b'.repeat(64);
const T = DEFAULT_MASTERY_THRESHOLDS;
const SEEDS = 200;
const EVENTS_PER_HISTORY = 40;

interface Naive {
  attempts: number;
  best: ProgressResult | null;
  last: ProgressResult | null;
  previous: ProgressResult | null;
}

/** An independent (differently structured, not reusing `reduce.ts`'s own incremental shortcuts) walk of the same
 *  data-model.md §3/§4 rules, to cross-check `applyProgressEvent`'s folded-and-trimmed result. `resultRemoved`
 *  only ever acts "if found in results" (data-model.md §4, literally) - a run trimmed out of the kept 20 can no
 *  longer be removed by runId, so `best`/`masteredBy` pointing at an already-trimmed result is sticky exactly as
 *  the real reducer leaves it (matches R-12's own "at least as many results as the attempts list shows", which
 *  makes removing an already-trimmed run impossible through the real UI in the first place). */
function naiveRecompute(events: readonly ProgressEvent[]): Naive {
  let results: ProgressResult[] = [];
  let attempts = 0;
  let best: ProgressResult | null = null;

  for (const event of events) {
    if (event.type === 'played') {
      const duplicate = results.some((r) => r.runId === event.result.runId) || best?.runId === event.result.runId;
      if (duplicate) continue;
      attempts++;
      results = [...results, event.result]
        .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
        .slice(0, PROGRESS_RESULTS_MAX);
      if (bestEligible(event.result) && (best === null || compareResults(event.result, best) > 0)) best = event.result;
    } else if (event.type === 'resultRemoved') {
      if (!results.some((r) => r.runId === event.runId)) continue; // not found in the kept results: no change
      results = results.filter((r) => r.runId !== event.runId);
      attempts--;
      if (best?.runId === event.runId) {
        best = results
          .filter(bestEligible)
          .reduce<ProgressResult | null>((b, r) => (b === null || compareResults(r, b) > 0 ? r : b), null);
      }
    } else if (event.type === 'reset') {
      results = [];
      attempts = 0;
      best = null;
    }
  }
  return { attempts, best, last: results[0] ?? null, previous: results[1] ?? null };
}

describe('applyProgressEvent matches a naive full-history recomputation (SC-004 property test)', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    it(`seed ${seed}`, () => {
      const events = historyOf(seed, EVENTS_PER_HISTORY);
      let record = null as ReturnType<typeof applyProgressEvent>;
      for (const event of events) {
        record = applyProgressEvent(record, KEY, event, T);
      }
      const naive = naiveRecompute(events);

      expect(record?.attempts ?? 0).toBe(naive.attempts);
      expect(record?.best ?? null).toEqual(naive.best);
      expect(record?.results[0] ?? null).toEqual(naive.last);
      expect(record?.results[1] ?? null).toEqual(naive.previous);
    });
  }
});
