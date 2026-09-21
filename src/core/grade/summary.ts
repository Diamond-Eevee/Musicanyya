import type { ReliabilityEvent } from '../play/types.js';
import type { MeasurePass } from '../timeline/types.js';
import type {
  ExpectedNote,
  ExtraNote,
  GradeSummary,
  MeasureOverview,
  NoteResult,
  ReliabilityWarning,
} from './types.js';

/** A reliability event already placed on the timeline tick axis (the caller does the audio-time conversion). */
export interface TickedReliabilityEvent {
  kind: ReliabilityEvent['kind'];
  tick: number;
}

export interface SummaryResult {
  summary: GradeSummary;
  measures: readonly MeasureOverview[];
  reliability: readonly ReliabilityWarning[];
}

const EMPTY_COUNTS = { correct: 0, wrongPitch: 0, missed: 0, extra: 0, early: 0, late: 0 };

function passIndexAtTick(passes: readonly MeasurePass[], tick: number): number | null {
  for (let i = 0; i < passes.length; i++) {
    const pass = passes[i];
    if (pass && tick >= pass.startTick && tick < pass.startTick + pass.lengthTicks) return i;
  }
  return null;
}

/**
 * Computes a Grade's summary (FR-028), the per-measure-pass overview (R-14, a repeated measure counted
 * separately for each occurrence) and the reliability warnings (R-12). `results` must be aligned 1:1 with
 * `expected` (FR-018 guarantees exactly one result per expected note). `playedAlong` presses are not a
 * parameter here at all: they are counted in nothing, by construction (FR-024).
 */
export function computeSummary(
  expected: readonly ExpectedNote[],
  results: readonly NoteResult[],
  extras: readonly ExtraNote[],
  reliability: readonly TickedReliabilityEvent[],
  passes: readonly MeasurePass[],
  windowNotResolvable: readonly boolean[], // aligned 1:1 with expected/results
): SummaryResult {
  const counts = { ...EMPTY_COUNTS };
  let playedCount = 0;
  let onTimeCount = 0;
  let asynchronySum = 0;
  let asynchronyCount = 0;

  const byPass = new Map<number, { measureIndex: number; counts: typeof EMPTY_COUNTS }>();
  function passRow(passIndex: number, measureIndex: number) {
    let row = byPass.get(passIndex);
    if (!row) {
      row = { measureIndex, counts: { ...EMPTY_COUNTS } };
      byPass.set(passIndex, row);
    }
    return row;
  }

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const note = expected[i];
    if (!result || !note) continue;
    const row = passRow(note.passIndex, note.measureIndex);

    if (result.pitch === 'correct') {
      counts.correct++;
      row.counts.correct++;
    } else if (result.pitch === 'wrongPitch') {
      counts.wrongPitch++;
      row.counts.wrongPitch++;
    } else {
      counts.missed++;
      row.counts.missed++;
    }

    if (result.timing !== null) {
      playedCount++;
      if (result.timing === 'onTime') onTimeCount++;
      else if (result.timing === 'early') {
        counts.early++;
        row.counts.early++;
      } else if (result.timing === 'late') {
        counts.late++;
        row.counts.late++;
      }
      if (result.deltaMs !== null) {
        asynchronySum += result.deltaMs;
        asynchronyCount++;
      }
    }
  }

  for (const extra of extras) {
    counts.extra++;
    passRow(extra.passIndex, extra.measureIndex).counts.extra++;
  }

  const unreliablePasses = new Set<number>();
  const warningsByKind = new Map<ReliabilityEvent['kind'], number[]>();
  for (const event of reliability) {
    const passIndex = passIndexAtTick(passes, event.tick);
    if (passIndex === null) continue;
    unreliablePasses.add(passIndex);
    const arr = warningsByKind.get(event.kind) ?? [];
    arr.push(passIndex);
    warningsByKind.set(event.kind, arr);
  }

  const measures: MeasureOverview[] = Array.from(byPass.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([passIndex, row]) => ({
      passIndex,
      measureIndex: row.measureIndex,
      counts: row.counts,
      unreliable: unreliablePasses.has(passIndex),
    }));

  const reliabilityWarnings: ReliabilityWarning[] = [];
  for (const [kind, indices] of warningsByKind) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const current = sorted[i];
      if (current === undefined || current !== (prev ?? -Infinity) + 1) {
        if (start !== undefined && prev !== undefined) {
          reliabilityWarnings.push({ kind, fromPassIndex: start, toPassIndex: prev + 1 });
        }
        start = current;
      }
      prev = current;
    }
  }

  const summary: GradeSummary = {
    notesCorrect: { count: counts.correct, total: results.length },
    notesOnTime: { count: onTimeCount, total: playedCount },
    counts,
    meanAsynchronyMs: asynchronyCount > 0 ? asynchronySum / asynchronyCount : null,
    timingNotResolvable: windowNotResolvable.some((flag) => flag),
  };

  return { summary, measures, reliability: reliabilityWarnings };
}
