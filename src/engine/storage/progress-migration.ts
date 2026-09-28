/** research.md R-5/R-6, contracts/progress-store.md §2 - builds progress and *My files* entries from the
 *  pre-013 `recentScores`/`performances` stores, lazily, once, guarded by `meta.progressMigration`. Runs inside
 *  the caller's own IDB connection; never reads the clock for anything that becomes progress data (the events it
 *  builds all carry the legacy records' own timestamps) - only the bookkeeping `meta` entry's own `at` uses `now`,
 *  which a test can override. */
import { PROGRESS_FORMAT_VERSION } from '../../core/defaults.js';
import { resultFromStoredPerformance } from '../../core/progress/from-performance.js';
import { applyProgressEvent } from '../../core/progress/reduce.js';
import { DEFAULT_MASTERY_THRESHOLDS, type ProgressRecord } from '../../core/progress/types.js';
import {
  META_STORE,
  PERFORMANCES_STORE,
  PROGRESS_STORE,
  RECENT_SCORES_STORE,
  requestToPromise,
  transactionDone,
  USER_FILE_BYTES_STORE,
  USER_FILES_STORE,
} from './db.js';

const MIGRATION_KEY = 'progressMigration';
const CLEANUP_KEY = 'migratedLibraryCleanup';

/** A record from an even older schema (e.g. a bare `{runId, scoreId, finishedAt}` row from a pre-004 upgrade test)
 *  lacks the fields a real Play run always has - skipped rather than crashing the whole migration over it. */
function isMigratableRecentScore(raw: unknown): raw is LegacyRecentScoreRecord {
  const r = raw as Partial<LegacyRecentScoreRecord> | null;
  return (
    typeof r?.id === 'string' &&
    typeof r.fileName === 'string' &&
    typeof r.lastOpened === 'string' &&
    typeof r.byteLength === 'number' &&
    r.bytes instanceof ArrayBuffer
  );
}

function isMigratablePerformance(raw: unknown): raw is LegacyStoredPerformanceRecord {
  const r = raw as {
    runId?: unknown;
    scoreId?: unknown;
    finishedAt?: unknown;
    settings?: { tempoPercent?: unknown; strictness?: unknown };
    summary?: { notesCorrect?: unknown; notesOnTime?: unknown; counts?: { extra?: unknown } };
  } | null;
  return (
    typeof r?.runId === 'string' &&
    typeof r.scoreId === 'string' &&
    typeof r.finishedAt === 'string' &&
    typeof r.settings?.tempoPercent === 'number' &&
    typeof r.settings.strictness === 'string' &&
    r.summary?.notesCorrect !== undefined &&
    r.summary.notesOnTime !== undefined &&
    typeof r.summary.counts?.extra === 'number'
  );
}

interface LegacyRecentScoreRecord {
  id: string;
  fileName: string;
  title: string | null;
  composer: string | null;
  bytes: ArrayBuffer;
  byteLength: number;
  lastOpened: string;
}

interface LegacyStoredPerformanceRecord {
  runId: string;
  scoreId: string;
  finishedAt: string;
  settings: unknown;
  summary: unknown;
  complete?: boolean;
}

/** research.md R-5: runs once, in one `readwrite` transaction over every store it touches. A second call (this
 *  tab or another) sees `meta.progressMigration` already written and does nothing - checked once cheaply outside
 *  the transaction, then again inside it, since a transaction already in flight when this starts could finish and
 *  write the flag first (IndexedDB serialises overlapping transactions, it does not prevent two from starting). */
export async function migrateIfNeeded(
  db: IDBDatabase,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  const already = await requestToPromise(
    db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(MIGRATION_KEY),
  );
  if (already !== undefined) return;

  const tx = db.transaction(
    [RECENT_SCORES_STORE, PERFORMANCES_STORE, PROGRESS_STORE, USER_FILES_STORE, USER_FILE_BYTES_STORE, META_STORE],
    'readwrite',
  );
  const metaStore = tx.objectStore(META_STORE);
  const recheck = await requestToPromise(metaStore.get(MIGRATION_KEY));
  if (recheck !== undefined) {
    tx.abort();
    return;
  }

  const progressStore = tx.objectStore(PROGRESS_STORE);
  const cache = new Map<string, ProgressRecord | null>();
  const readRecord = async (scoreKey: string): Promise<ProgressRecord | null> => {
    const cached = cache.get(scoreKey);
    if (cached !== undefined) return cached;
    const raw = (await requestToPromise(progressStore.get(scoreKey))) as ProgressRecord | undefined;
    const record = raw ?? null;
    cache.set(scoreKey, record);
    return record;
  };
  const writeRecord = (scoreKey: string, record: ProgressRecord | null): void => {
    cache.set(scoreKey, record);
    if (record === null) progressStore.delete(scoreKey);
    else progressStore.put(record);
  };

  // 1. recentScores -> My files entries (with their bytes) + an `opened` event each (research.md R-6).
  const recentScores = (await requestToPromise(tx.objectStore(RECENT_SCORES_STORE).getAll())) as unknown[];
  for (const file of recentScores.filter(isMigratableRecentScore)) {
    const fileKey = file.fileName.normalize('NFC').toLowerCase();
    tx.objectStore(USER_FILES_STORE).put({
      format: PROGRESS_FORMAT_VERSION,
      fileKey,
      fileName: file.fileName,
      title: file.title,
      composer: file.composer,
      hash: file.id,
      earlierHashes: [],
      byteLength: file.byteLength,
      addedAt: file.lastOpened,
      lastOpenedAt: file.lastOpened,
      stored: true,
      origin: 'migrated',
      updatedAt: file.lastOpened,
    });
    tx.objectStore(USER_FILE_BYTES_STORE).put({ hash: file.id, bytes: file.bytes, byteLength: file.byteLength });

    const current = await readRecord(file.id);
    const updated = applyProgressEvent(
      current,
      file.id,
      { type: 'opened', at: file.lastOpened, as: { kind: 'file', fileKey } },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    writeRecord(file.id, updated);
  }

  // 2. performances, oldest finishedAt first -> `played` events (R-6: complete becomes null, "not recorded").
  const performances = (await requestToPromise(tx.objectStore(PERFORMANCES_STORE).getAll())) as unknown[];
  const oldestFirst = performances
    .filter(isMigratablePerformance)
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
  for (const p of oldestFirst) {
    const current = await readRecord(p.scoreId);
    // The legacy shape lacks only `complete` and `log` (unread here) compared to today's StoredPerformance -
    // resultFromStoredPerformance reads only runId/finishedAt/settings/summary/complete, all present.
    const legacyAsStoredPerformance = p as unknown as Parameters<typeof resultFromStoredPerformance>[0];
    const result = resultFromStoredPerformance(legacyAsStoredPerformance);
    const updated = applyProgressEvent(
      current,
      p.scoreId,
      { type: 'played', at: p.finishedAt, result },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    writeRecord(p.scoreId, updated);
  }

  metaStore.put({ key: MIGRATION_KEY, version: 1, at: now() });
  await transactionDone(tx);
}

/** contracts/progress-store.md §2: removes a migrated *My files* entry once the library index shows its hash (or
 *  a `supersedes` hash) is now a library item - its progress stays, keyed by the hash, so it shows on the library
 *  item instead (research.md R-6). Runs once per device (`meta.migratedLibraryCleanup`); a memory store has
 *  nothing to migrate, so `Session` only calls this for the IndexedDB adapter. */
export async function removeMigratedLibraryCopies(db: IDBDatabase, libraryHashes: ReadonlySet<string>): Promise<void> {
  const already = await requestToPromise(
    db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(CLEANUP_KEY),
  );
  if (already !== undefined) return;

  const tx = db.transaction([USER_FILES_STORE, USER_FILE_BYTES_STORE, META_STORE], 'readwrite');
  const metaStore = tx.objectStore(META_STORE);
  const recheck = await requestToPromise(metaStore.get(CLEANUP_KEY));
  if (recheck !== undefined) {
    tx.abort();
    return;
  }

  const filesStore = tx.objectStore(USER_FILES_STORE);
  const entries = (await requestToPromise(filesStore.getAll())) as {
    fileKey: string;
    hash: string;
    origin: 'opened' | 'migrated';
  }[];
  const toRemove = entries.filter((e) => e.origin === 'migrated' && libraryHashes.has(e.hash));
  for (const entry of toRemove) {
    filesStore.delete(entry.fileKey);
    // A copy shared by another entry (same hash, different name) survives (progress-store.md §1 eviction rule
    // mirrors this sharing model) - only drop the bytes if no remaining entry still points at this hash.
    const stillUsed = entries.some(
      (e) => e.hash === entry.hash && e.fileKey !== entry.fileKey && !toRemove.includes(e),
    );
    if (!stillUsed) tx.objectStore(USER_FILE_BYTES_STORE).delete(entry.hash);
  }

  metaStore.put({ key: CLEANUP_KEY, version: 1, at: new Date().toISOString() });
  await transactionDone(tx);
}
