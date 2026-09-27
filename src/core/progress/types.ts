/** data-model.md sections 2-5 - progress results, records, events and *My files* entries. Pure data: no DOM, no
 *  Web API (Principle V). Times are ISO 8601 strings in UTC; percentages are integers. */
import {
  MASTERY_MAX_EXTRA_PERCENT,
  MASTERY_MIN_STRICTNESS,
  MASTERY_NOTES_CORRECT_MIN_PERCENT,
  MASTERY_NOTES_ON_TIME_MIN_PERCENT,
  MASTERY_TEMPO_PERCENT_MIN,
} from '../defaults.js';
import type { StrictnessLevelName } from '../grade/types.js';

/** How a Score was opened, or how a `played`/`practised` figure is attributed to a browser row (data-model.md §3). */
export type ItemRef = { kind: 'library'; id: string } | { kind: 'file'; fileKey: string };

/** data-model.md §2. `kind: 'partial'` covers a bar range, one-hand-only, or both. */
export type ResultScope =
  | { kind: 'whole' }
  | {
      kind: 'partial';
      fromMeasure: number | null; // 1-based written bar, null = no lower bound
      toMeasure: number | null; // 1-based written bar, null = no upper bound
      hands: 'right' | 'left' | 'custom' | null; // null = all staves
    };

/** One Play run's result, copied from the Grade's own figures (FR-009). */
export interface ProgressResult {
  runId: string; // = StoredPerformance.runId; makes `played` idempotent
  finishedAt: string; // ISO 8601
  notesCorrect: { count: number; total: number }; // = GradeSummary.notesCorrect
  notesOnTime: { count: number; total: number }; // = GradeSummary.notesOnTime
  extra: number; // = GradeSummary.counts.extra (OD-2)
  tempoPercent: number; // RunSettings.tempoPercent, 25..200
  strictness: StrictnessLevelName;
  complete: boolean | null; // null = recorded before this feature, not known (R-6)
  scope: ResultScope;
}

/** data-model.md §4, mastery rule thresholds (Principle II: named, configurable). */
export interface MasteryThresholds {
  notesCorrectMinPercent: number;
  notesOnTimeMinPercent: number;
  tempoPercentMin: number;
  minStrictness: StrictnessLevelName;
  /** `null` disables the extra-notes limit (OD-2 declined). */
  maxExtraPercent: number | null;
}

export const DEFAULT_MASTERY_THRESHOLDS: MasteryThresholds = {
  notesCorrectMinPercent: MASTERY_NOTES_CORRECT_MIN_PERCENT,
  notesOnTimeMinPercent: MASTERY_NOTES_ON_TIME_MIN_PERCENT,
  tempoPercentMin: MASTERY_TEMPO_PERCENT_MIN,
  minStrictness: MASTERY_MIN_STRICTNESS,
  maxExtraPercent: MASTERY_MAX_EXTRA_PERCENT,
};

/** data-model.md §3 - the per-Score record the reducer folds events into. */
export interface ProgressRecord {
  format: 1; // PROGRESS_FORMAT_VERSION (FR-030)
  scoreKey: string;
  updatedAt: string; // time of the last applied event (FR-030, merge key for a future server)
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openedAs: ItemRef | null; // how it was last opened, for Continue
  lastPractisedAt: string | null;
  practisedBars: { fromMeasure: number; toMeasure: number } | null; // of the last `practised` event
  attempts: number; // Play runs ever recorded, minus removed ones (survives trimming, FR-015)
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  best: ProgressResult | null; // best eligible (FR-010, FR-023)
  masteredAt: string | null; // first mastering result's finishedAt; null = not mastered
  masteredBy: string | null; // runId of that result
  results: ProgressResult[]; // newest first, at most PROGRESS_RESULTS_MAX (20)
}

/** data-model.md §4 - the only way a `ProgressRecord` changes. */
export type ProgressEvent =
  | { type: 'opened'; at: string; as: ItemRef }
  | { type: 'practised'; at: string; fromMeasure: number; toMeasure: number }
  | { type: 'played'; at: string; result: ProgressResult }
  | { type: 'resultRemoved'; at: string; runId: string }
  | { type: 'reset'; at: string };

/** data-model.md §5 - a musician's own file, kept under *My files*. */
export interface UserFileEntry {
  format: 1;
  fileKey: string; // fileName.normalize('NFC').toLowerCase() (R-11)
  fileName: string; // latest spelling, as chosen by the musician
  title: string | null; // from the Score; shown, file name beneath (US3)
  composer: string | null;
  hash: string; // current content (ScoreKey)
  earlierHashes: string[]; // newest first, max USER_FILE_VERSIONS_MAX (10)
  byteLength: number;
  addedAt: string;
  lastOpenedAt: string;
  stored: boolean; // a copy of the bytes is kept (FR-020); false = "file not stored"
  origin: 'opened' | 'migrated'; // migrated from recentScores (R-6)
  updatedAt: string; // FR-030
}
