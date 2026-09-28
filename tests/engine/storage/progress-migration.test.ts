// specs/013-score-browser-progress T044 - migration from the pre-013 `recentScores`/`performances` stores
// (contracts/progress-store.md §2, research.md R-5/R-6), against the real T006 fixture (db-v2.ts).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressRecord } from '../../../src/core/progress/types.js';
import {
  META_STORE,
  openMusicanyyaDb,
  PERFORMANCES_STORE,
  PROGRESS_STORE,
  RECENT_SCORES_STORE,
  requestToPromise,
  transactionDone,
  USER_FILE_BYTES_STORE,
  USER_FILES_STORE,
} from '../../../src/engine/storage/db.js';
import { migrateIfNeeded, removeMigratedLibraryCopies } from '../../../src/engine/storage/progress-migration.js';
import {
  C_MAJOR_INTRO_HASH,
  FUR_ELISE_HASH,
  PERFORMANCES_V2,
  RECENT_SCORES_V2,
} from '../../fixtures/progress/db-v2.js';

/** Builds the T006 fixture as a raw version-2 database (feature 001's `recentScores` + feature 004's
 *  `performances`, both indexed exactly as `db.ts`'s pre-013 schema had them), the way an existing installation
 *  would look before this feature ever runs. */
async function seedVersion2Database(): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('musicanyya', 2);
    request.onupgradeneeded = () => {
      const upgrading = request.result;
      upgrading.createObjectStore(RECENT_SCORES_STORE, { keyPath: 'id' }).createIndex('byLastOpened', 'lastOpened');
      upgrading
        .createObjectStore(PERFORMANCES_STORE, { keyPath: 'runId' })
        .createIndex('byScoreFinished', ['scoreId', 'finishedAt']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const tx = db.transaction([RECENT_SCORES_STORE, PERFORMANCES_STORE], 'readwrite');
  for (const record of RECENT_SCORES_V2) tx.objectStore(RECENT_SCORES_STORE).put(record);
  for (const record of PERFORMANCES_V2) tx.objectStore(PERFORMANCES_STORE).put(record);
  await transactionDone(tx);
  db.close();
}

async function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>;
}

async function getProgress(db: IDBDatabase, scoreKey: string): Promise<ProgressRecord | undefined> {
  return requestToPromise(db.transaction(PROGRESS_STORE, 'readonly').objectStore(PROGRESS_STORE).get(scoreKey));
}

describe('progress migration (contracts/progress-store.md §2, T006 fixture)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.restoreAllMocks();
  });

  it('opening version 3 over the version-2 fixture keeps recentScores and performances untouched and adds the four new stores', async () => {
    await seedVersion2Database();

    const db = await openMusicanyyaDb();
    expect(db.version).toBe(3);
    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining([
        RECENT_SCORES_STORE,
        PERFORMANCES_STORE,
        PROGRESS_STORE,
        USER_FILES_STORE,
        USER_FILE_BYTES_STORE,
        META_STORE,
      ]),
    );

    const recentScores = await getAll<{ id: string }>(db, RECENT_SCORES_STORE);
    expect(recentScores).toHaveLength(RECENT_SCORES_V2.length);
    const performances = await getAll<{ runId: string }>(db, PERFORMANCES_STORE);
    expect(performances).toHaveLength(PERFORMANCES_V2.length);
  });

  it('the first call builds progress records whose attempts, best, last/previous and opened dates match the fixture (FR-017, US2 #7)', async () => {
    await seedVersion2Database();
    const db = await openMusicanyyaDb();

    await migrateIfNeeded(db);

    const furElise = await getProgress(db, FUR_ELISE_HASH);
    expect(furElise).toBeDefined();
    expect(furElise?.firstOpenedAt).toBe('2026-08-01T09:00:00.000Z');
    expect(furElise?.lastOpenedAt).toBe('2026-08-01T09:00:00.000Z');
    expect(furElise?.openedAs).toEqual({ kind: 'file', fileKey: 'fur elise.musicxml' });
    expect(furElise?.attempts).toBe(2);
    expect(furElise?.firstPlayedAt).toBe('2026-08-01T09:05:00.000Z');
    expect(furElise?.lastPlayedAt).toBe('2026-08-01T09:10:00.000Z');
    // The whole-Score run is best-eligible (complete unknown counts, R-6); the ranged run never is (OD-1).
    expect(furElise?.best?.runId).toBe('legacy-run-fur-elise-complete');
    // A legacy run's complete is unknown, never counts for Mastered (FR-024).
    expect(furElise?.masteredAt).toBeNull();
    expect(furElise?.masteredBy).toBeNull();
    expect(furElise?.results.map((r) => r.runId).sort()).toEqual(
      ['legacy-run-fur-elise-complete', 'legacy-run-fur-elise-range'].sort(),
    );

    const cMajor = await getProgress(db, C_MAJOR_INTRO_HASH);
    expect(cMajor).toBeDefined();
    expect(cMajor?.firstOpenedAt).toBe('2026-08-02T09:00:00.000Z');
    expect(cMajor?.openedAs).toEqual({ kind: 'file', fileKey: 'introduction.musicxml' });
    expect(cMajor?.attempts).toBe(1);
    expect(cMajor?.firstPlayedAt).toBe('2026-08-02T09:05:00.000Z');
    // Right-hand-only on a two-staff Score is partial by the legacy rule (R-6/OD-1) - never best-eligible.
    expect(cMajor?.best).toBeNull();
    expect(cMajor?.masteredAt).toBeNull();

    const userFiles = await getAll<{ fileKey: string; hash: string; origin: string }>(db, USER_FILES_STORE);
    expect(userFiles).toHaveLength(2);
    expect(userFiles.find((f) => f.fileKey === 'fur elise.musicxml')).toMatchObject({
      hash: FUR_ELISE_HASH,
      origin: 'migrated',
    });
    expect(userFiles.find((f) => f.fileKey === 'introduction.musicxml')).toMatchObject({
      hash: C_MAJOR_INTRO_HASH,
      origin: 'migrated',
    });

    const bytes = await getAll<{ hash: string }>(db, USER_FILE_BYTES_STORE);
    expect(bytes.map((b) => b.hash).sort()).toEqual([C_MAJOR_INTRO_HASH, FUR_ELISE_HASH].sort());

    const meta = await requestToPromise(
      db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get('progressMigration'),
    );
    expect(meta).toBeDefined();
  });

  it('an injected failure writes nothing, and the next call retries', async () => {
    await seedVersion2Database();
    const db = await openMusicanyyaDb();

    const originalTransaction = db.transaction.bind(db);
    let failNextReadwrite = true;
    const spy = vi.spyOn(db, 'transaction').mockImplementation((...args: Parameters<typeof db.transaction>) => {
      if (failNextReadwrite && args[1] === 'readwrite') {
        failNextReadwrite = false;
        throw new Error('simulated failure opening the migration transaction');
      }
      return originalTransaction(...args);
    });

    await expect(migrateIfNeeded(db)).rejects.toThrow('simulated failure');
    spy.mockRestore();

    expect(await getProgress(db, FUR_ELISE_HASH)).toBeUndefined();
    const metaAfterFailure = await requestToPromise(
      db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get('progressMigration'),
    );
    expect(metaAfterFailure).toBeUndefined();

    await migrateIfNeeded(db);
    expect(await getProgress(db, FUR_ELISE_HASH)).toBeDefined();
  });

  it('a second store instance does not migrate twice', async () => {
    await seedVersion2Database();
    const db = await openMusicanyyaDb();

    await migrateIfNeeded(db);
    const firstPass = await getProgress(db, FUR_ELISE_HASH);

    await migrateIfNeeded(db);
    const secondPass = await getProgress(db, FUR_ELISE_HASH);

    expect(secondPass).toEqual(firstPass);
    expect(secondPass?.attempts).toBe(2); // not doubled to 4
  });

  it('removeMigratedLibraryCopies drops a migrated My-files entry once its hash is a library item, but keeps its progress (R-6)', async () => {
    await seedVersion2Database();
    const db = await openMusicanyyaDb();
    await migrateIfNeeded(db);

    await removeMigratedLibraryCopies(db, new Set([C_MAJOR_INTRO_HASH]));

    const userFiles = await getAll<{ fileKey: string }>(db, USER_FILES_STORE);
    expect(userFiles.map((f) => f.fileKey)).toEqual(['fur elise.musicxml']);

    const bytes = await getAll<{ hash: string }>(db, USER_FILE_BYTES_STORE);
    expect(bytes.map((b) => b.hash)).toEqual([FUR_ELISE_HASH]);

    // The library item's own progress is untouched - it just stops being shown as a My files copy.
    const cMajor = await getProgress(db, C_MAJOR_INTRO_HASH);
    expect(cMajor?.attempts).toBe(1);
    expect(cMajor?.best).toBeNull();
  });

  it('removeMigratedLibraryCopies runs once - a second call with a different hash set changes nothing further', async () => {
    await seedVersion2Database();
    const db = await openMusicanyyaDb();
    await migrateIfNeeded(db);

    await removeMigratedLibraryCopies(db, new Set([C_MAJOR_INTRO_HASH]));
    await removeMigratedLibraryCopies(db, new Set([FUR_ELISE_HASH]));

    // The second call is a no-op (guarded), so Für Elise's My files entry survives despite being named this time.
    const userFiles = await getAll<{ fileKey: string }>(db, USER_FILES_STORE);
    expect(userFiles.map((f) => f.fileKey)).toEqual(['fur elise.musicxml']);
  });
});
