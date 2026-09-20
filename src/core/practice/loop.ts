import type { ExpectedEvent, LoopPassSpan, LoopRange, ResolvedLoop } from './types.js';

/** The part of a timeline pass a loop needs: which written measure it plays. `PlaybackTimeline.passes` fits. */
export interface LoopPass {
  measureIndex: number;
}

/** One time through a range on the unrolled timeline: a pass span and the events inside it. */
interface Occurrence {
  fromPassIndex: number;
  toPassIndex: number;
  fromEventIndex: number;
  toEventIndex: number;
}

/**
 * Passes of a written range, one run per time it is played. A run is a maximal stretch of consecutive passes that
 * stay inside the range - a repeat sign inside the range therefore stays inside the run (R-06) - trimmed to begin at
 * the range's first written measure and end at its last, so a loop over measures 1-2 does not slide on into the
 * second ending that follows measure 2.
 */
function passRuns(passes: readonly LoopPass[], from: number, to: number): { from: number; to: number }[] {
  const inRange = (i: number) => {
    const measure = passes[i]?.measureIndex;
    return measure !== undefined && measure >= from && measure <= to;
  };

  const runs: { from: number; to: number }[] = [];
  let i = 0;
  while (i < passes.length) {
    if (!inRange(i)) {
      i++;
      continue;
    }
    let end = i;
    while (inRange(end + 1)) end++;

    let head = i;
    while (head <= end && passes[head]?.measureIndex !== from) head++;
    if (head > end) head = i;
    let tail = end;
    while (tail >= head && passes[tail]?.measureIndex !== to) tail--;
    if (tail < head) tail = end;

    runs.push({ from: head, to: tail });
    i = end + 1;
  }
  return runs;
}

/** The occurrences of a range that hold at least one expected event, in the order they are played. */
function occurrencesOf(
  events: readonly ExpectedEvent[],
  passes: readonly LoopPass[],
  from: number,
  to: number,
): Occurrence[] {
  const found: Occurrence[] = [];
  for (const run of passRuns(passes, from, to)) {
    let first = -1;
    let last = -1;
    for (let i = 0; i < events.length; i++) {
      const passIndex = events[i]?.passIndex ?? -1;
      if (passIndex < run.from) continue;
      if (passIndex > run.to) break;
      if (first === -1) first = i;
      last = i;
    }
    if (first !== -1) {
      found.push({ fromPassIndex: run.from, toPassIndex: run.to, fromEventIndex: first, toEventIndex: last });
    }
  }
  return found;
}

/**
 * Turns the written measure range the musician set into the slice of the unrolled event list a session loops over
 * (R-06, PRACTICE_LOOP_OCCURRENCE = "current-pass"): the occurrence the cursor is in, otherwise the first one at or
 * after the cursor, otherwise the first one in the Score. A reversed range is corrected, not refused (AS-3.4).
 *
 * Returns null when the range holds no required event for the practised hand; the caller raises
 * `practiceLoopEmpty` and keeps whatever loop it had.
 */
export function resolveLoop(
  events: readonly ExpectedEvent[],
  passes: readonly LoopPass[],
  range: LoopRange,
  currentEventIndex: number,
): ResolvedLoop | null {
  if (events.length === 0) return null;

  const from = Math.min(range.fromMeasureIndex, range.toMeasureIndex);
  const to = Math.max(range.fromMeasureIndex, range.toMeasureIndex);
  const occurrences = occurrencesOf(events, passes, from, to);
  if (occurrences.length === 0) return null;

  const cursor = Math.min(Math.max(currentEventIndex, 0), events.length - 1);
  let pick = occurrences.findIndex((o) => o.fromEventIndex <= cursor && cursor <= o.toEventIndex);
  if (pick === -1) pick = occurrences.findIndex((o) => o.fromEventIndex >= cursor);
  if (pick === -1) pick = 0;

  const chosen = occurrences[pick];
  if (!chosen) return null;
  return {
    ...chosen,
    occurrence: occurrences.length > 1 ? { index: pick + 1, count: occurrences.length } : null,
  };
}

/** The stored form of a loop: the pass span of the occurrence, which - unlike a written measure range - says which
 *  time through a repeat it is. `null` in the settings means no loop. */
export function loopRangeToPassIndices(loop: ResolvedLoop): LoopPassSpan {
  return { fromPassIndex: loop.fromPassIndex, toPassIndex: loop.toPassIndex };
}

/**
 * The written measure range a stored pass span covers on the current timeline, or null when it no longer fits (for
 * example after a Score was edited): a span that starts outside the timeline, or reversed, is dropped; one that
 * merely ends past it is clamped to the last pass (contracts/practice-settings.md, "Loop validation on load").
 */
export function passIndicesToLoopRange(passes: readonly LoopPass[], span: LoopPassSpan): LoopRange | null {
  if (!Number.isInteger(span.fromPassIndex) || !Number.isInteger(span.toPassIndex)) return null;
  const last = passes.length - 1;
  const toPassIndex = Math.min(span.toPassIndex, last);
  if (span.fromPassIndex < 0 || span.fromPassIndex > toPassIndex) return null;

  const first = passes[span.fromPassIndex];
  const end = passes[toPassIndex];
  if (!first || !end) return null;
  return { fromMeasureIndex: first.measureIndex, toMeasureIndex: end.measureIndex };
}
