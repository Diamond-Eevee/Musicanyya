// Version-2 database fixture for the progress migration (specs/013-score-browser-progress, T006, R-5, R-6).
// Real `recentScores` and `performances` records, built from real fixture/library files and their real SHA-256, in
// the pre-013 `StoredPerformanceRecord` shape (no `complete` field - that is what "legacy" means to the migration).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function readBytes(relPath: string): ArrayBuffer {
  const buffer = fs.readFileSync(path.join(repoRoot, relPath));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/** `tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` - a musician's own file (never in the library). */
export const FUR_ELISE_FILE = 'tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml';
export const FUR_ELISE_HASH = 'e224d016f727ba970b6c2aed57212f86b34f7f7ff0727b090e2213a74f6b5b5e';
export const FUR_ELISE_BYTES = readBytes(FUR_ELISE_FILE);

/** `public/library/learning/keys/c-major/introduction.musicxml` - a library item, same hash as the index entry, so
 *  the migration's `removeMigratedLibraryCopies` (progress-store.md section 2) drops the migrated *My files* copy
 *  but keeps its progress. */
export const C_MAJOR_INTRO_FILE = 'public/library/learning/keys/c-major/introduction.musicxml';
export const C_MAJOR_INTRO_HASH = 'fd01090d805ecf8284e1be0a4ea350c83b78a34f2a244b3ad3337c591b946792';
export const C_MAJOR_INTRO_BYTES = readBytes(C_MAJOR_INTRO_FILE);

export interface LegacyRecentScoreRecord {
  id: string;
  fileName: string;
  title: string | null;
  composer: string | null;
  bytes: ArrayBuffer;
  byteLength: number;
  lastOpened: string;
  schema: 1;
}

/** `StoredPerformanceRecord` (contracts/performance-log.md) before 013's optional `complete` field existed. */
export interface LegacyStoredPerformanceRecord {
  runId: string;
  scoreId: string;
  finishedAt: string;
  settings: {
    range: { fromMeasureIndex: number; toMeasureIndex: number } | null;
    tempoPercent: number;
    selection: { preset: 'both' | 'right' | 'left' | 'custom'; partIndex: number; staves: readonly number[] };
    strictness: 'beginner' | 'standard' | 'strict';
    countInMeasures: number;
    metronomeMuted: boolean;
    accompaniment: boolean;
  };
  latency: {
    outputLatencyMs: number;
    inputLatencyMs: number;
    source: 'assumed' | 'measured';
    measuredAt: string | null;
  };
  appVersion: string;
  log: {
    version: 1;
    messages: readonly {
      kind: 'noteOn' | 'noteOff' | 'sustain';
      key: number;
      velocity: number;
      down: boolean;
      audioTimeSec: number;
      timeStampMs: number;
      deviceId: string;
    }[];
    droppedMessages: number;
  };
  summary: {
    notesCorrect: { count: number; total: number };
    notesOnTime: { count: number; total: number };
    counts: { correct: number; wrongPitch: number; missed: number; extra: number; early: number; late: number };
    meanAsynchronyMs: number | null;
    timingNotResolvable: boolean;
  };
  schema: 1;
  // no `complete` field - legacy
}

export const RECENT_SCORES_V2: readonly LegacyRecentScoreRecord[] = [
  {
    id: FUR_ELISE_HASH,
    fileName: 'Fur Elise.musicxml',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    bytes: FUR_ELISE_BYTES,
    byteLength: FUR_ELISE_BYTES.byteLength,
    lastOpened: '2026-08-01T09:00:00.000Z',
    schema: 1,
  },
  {
    id: C_MAJOR_INTRO_HASH,
    fileName: 'introduction.musicxml',
    title: 'C major - Introduction',
    composer: null,
    bytes: C_MAJOR_INTRO_BYTES,
    byteLength: C_MAJOR_INTRO_BYTES.byteLength,
    lastOpened: '2026-08-02T09:00:00.000Z',
    schema: 1,
  },
];

function log(messages: LegacyStoredPerformanceRecord['log']['messages']): LegacyStoredPerformanceRecord['log'] {
  return { version: 1, messages, droppedMessages: 0 };
}

export const PERFORMANCES_V2: readonly LegacyStoredPerformanceRecord[] = [
  // Für Elise: a complete whole-Score run (both hands, no range) - legacy, so `complete` is unknown, not `true`.
  {
    runId: 'legacy-run-fur-elise-complete',
    scoreId: FUR_ELISE_HASH,
    finishedAt: '2026-08-01T09:05:00.000Z',
    settings: {
      range: null,
      tempoPercent: 100,
      selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: { outputLatencyMs: 20, inputLatencyMs: 10, source: 'assumed', measuredAt: null },
    appVersion: '0.12.0',
    log: log([
      { kind: 'noteOn', key: 64, velocity: 80, down: false, audioTimeSec: 0.5, timeStampMs: 500, deviceId: 'fake' },
      { kind: 'noteOff', key: 64, velocity: 0, down: false, audioTimeSec: 0.9, timeStampMs: 900, deviceId: 'fake' },
    ]),
    summary: {
      notesCorrect: { count: 82, total: 100 },
      notesOnTime: { count: 60, total: 82 },
      counts: { correct: 82, wrongPitch: 6, missed: 12, extra: 1, early: 10, late: 12 },
      meanAsynchronyMs: 12,
      timingNotResolvable: false,
    },
    schema: 1,
  },
  // Für Elise: a stopped run over a bar range (partial, so it never counts for best/Mastered, OD-1).
  {
    runId: 'legacy-run-fur-elise-range',
    scoreId: FUR_ELISE_HASH,
    finishedAt: '2026-08-01T09:10:00.000Z',
    settings: {
      range: { fromMeasureIndex: 0, toMeasureIndex: 3 },
      tempoPercent: 80,
      selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: { outputLatencyMs: 20, inputLatencyMs: 10, source: 'assumed', measuredAt: null },
    appVersion: '0.12.0',
    log: log([
      { kind: 'noteOn', key: 64, velocity: 70, down: false, audioTimeSec: 0.2, timeStampMs: 200, deviceId: 'fake' },
    ]),
    summary: {
      notesCorrect: { count: 10, total: 20 },
      notesOnTime: { count: 8, total: 10 },
      counts: { correct: 10, wrongPitch: 2, missed: 8, extra: 0, early: 3, late: 2 },
      meanAsynchronyMs: 8,
      timingNotResolvable: false,
    },
    schema: 1,
  },
  // C major - Introduction: a complete right-hand-only run on a two-staff Score (partial by OD-1's hands rule).
  {
    runId: 'legacy-run-c-major-right',
    scoreId: C_MAJOR_INTRO_HASH,
    finishedAt: '2026-08-02T09:05:00.000Z',
    settings: {
      range: null,
      tempoPercent: 100,
      selection: { preset: 'right', partIndex: 0, staves: [1] },
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: false,
    },
    latency: { outputLatencyMs: 15, inputLatencyMs: 8, source: 'assumed', measuredAt: null },
    appVersion: '0.12.0',
    log: log([
      { kind: 'noteOn', key: 60, velocity: 90, down: false, audioTimeSec: 0.3, timeStampMs: 300, deviceId: 'fake' },
    ]),
    summary: {
      notesCorrect: { count: 16, total: 16 },
      notesOnTime: { count: 15, total: 16 },
      counts: { correct: 16, wrongPitch: 0, missed: 0, extra: 0, early: 1, late: 0 },
      meanAsynchronyMs: 4,
      timingNotResolvable: false,
    },
    schema: 1,
  },
];
