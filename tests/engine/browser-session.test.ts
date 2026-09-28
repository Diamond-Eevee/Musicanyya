import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSessionController, type LoadBytesOutcome } from '../../src/app/browser-session.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import type { PlayRun } from '../../src/core/play/types.js';
import type { ItemRef, MasteryThresholds, ProgressEvent, ProgressRecord } from '../../src/core/progress/types.js';
import type { ProgressStore, ProgressStoreResult } from '../../src/engine/ports.js';
import { MemoryProgressStore } from '../../src/engine/storage/memory-progress-store.js';
import { browserState } from '../../src/ui/state/browserState.js';
import { libraryState } from '../../src/ui/state/libraryState.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { playState } from '../../src/ui/state/playState.js';
import { FakeLibraryCatalog } from '../fakes/fake-library-catalog.js';
import { result } from '../fakes/progress-builders.js';

/** Lets every microtask hop of `loadIndex` (catalog + progress store availability + listProgress) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'repertoire/beginner/scale',
    section: 'repertoire/beginner',
    file: 'repertoire/beginner/scale.musicxml',
    bytes: 4,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title: 'A Scale',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 1,
      notes: 4,
      durationSeconds: 2.4,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 65,
      maxSpanSemitones: 0,
      staves: 1,
      shortestDivision: 4,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
    ...overrides,
  };
}

function index(items: LibraryItem[]): LibraryIndex {
  return { version: 1, generated: '2026-09-22T00:00:00.000Z', sections: [], items };
}

const bytes = new Uint8Array([1, 2, 3, 4]).buffer;

describe('BrowserSessionController (US1, contracts/score-browser.md §3/§5)', () => {
  afterEach(() => {
    browserState.reset();
    libraryState.reset();
  });

  it('openItem for a library ref goes through the same load path and closes the browser on success', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.setIndex(index([item()]));
    catalog.setItem('repertoire/beginner/scale.musicxml', bytes);
    const received: { fileName: string; bytes: ArrayBuffer }[] = [];
    const controller = new BrowserSessionController(
      catalog,
      {
        loadBytes: async (fileName, loaded) => {
          received.push({ fileName, bytes: loaded });
        },
      },
      undefined,
      new MemoryProgressStore(),
    );

    controller.open();
    await flush();
    expect(browserState.get().phase).toBe('ready');
    const loadedIndex = browserState.get().data.index;
    if (!loadedIndex) throw new Error('expected the index to have loaded');

    await controller.openItem({ kind: 'library', id: 'repertoire/beginner/scale' }, loadedIndex);

    expect(received).toHaveLength(1);
    expect(received[0]?.fileName).toBe('scale.musicxml');
    expect(browserState.get().phase).toBe('closed');
    expect(libraryState.getOpenedItem()?.id).toBe('repertoire/beginner/scale');
  });

  it('a failed item load keeps the browser open, ready, with the catalog notice as the message', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.setIndex(index([item()]));
    catalog.failNextItem = 'unavailable';
    const controller = new BrowserSessionController(
      catalog,
      { loadBytes: async () => {} },
      undefined,
      new MemoryProgressStore(),
    );

    controller.open();
    await flush();
    const loadedIndex = browserState.get().data.index;
    if (!loadedIndex) throw new Error('expected the index to have loaded');

    await controller.openItem({ kind: 'library', id: 'repertoire/beginner/scale' }, loadedIndex);

    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().message).toEqual({ code: 'libraryUnavailable' });
  });

  it('an index failure gives indexError, and retryLibrary reloads it', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.failNextIndex = 'unavailable';
    const controller = new BrowserSessionController(
      catalog,
      { loadBytes: async () => {} },
      undefined,
      new MemoryProgressStore(),
    );

    controller.open();
    await flush();
    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().data.indexError).toBe('unavailable');

    catalog.setIndex(index([item()]));
    controller.retryLibrary();
    await flush();
    expect(browserState.get().data.indexError).toBeNull();
    expect(browserState.get().data.index).not.toBeNull();
  });
});

/** Simulates IndexedDB being unavailable/blocked (R-19) - `MemoryProgressStore.availability()` always reports
 *  'available', so a dedicated fake is the only way to reach the fallback path. */
class UnavailableProgressStore implements ProgressStore {
  async availability(): Promise<'available' | 'unavailable'> {
    return 'unavailable';
  }
  async listProgress(): Promise<ProgressStoreResult<{ records: readonly ProgressRecord[]; skipped: number }>> {
    throw new Error('unreachable: falls back to MemoryProgressStore before this could be called');
  }
  async getProgress(): Promise<ProgressStoreResult<ProgressRecord | null>> {
    throw new Error('unreachable: falls back to MemoryProgressStore before this could be called');
  }
  async apply(
    _scoreKey: string,
    _event: ProgressEvent,
    _thresholds: MasteryThresholds,
  ): Promise<ProgressStoreResult<ProgressRecord | null>> {
    throw new Error('unreachable: falls back to MemoryProgressStore before this could be called');
  }
}

const SCORE_KEY = 'a'.repeat(64);

function controllerWith(
  progressStore: ProgressStore = new MemoryProgressStore(),
  removeAttempts: (scoreKey: string) => Promise<void> = async () => {},
  loadBytes: (fileName: string, bytes: ArrayBuffer, openedAs: ItemRef) => Promise<LoadBytesOutcome> = async () => ({
    ok: true,
  }),
): BrowserSessionController {
  const catalog = new FakeLibraryCatalog();
  catalog.setIndex(index([]));
  return new BrowserSessionController(catalog, { loadBytes, removeAttempts }, undefined, progressStore);
}

describe('BrowserSessionController progress events (US2, contracts/progress-store.md, R-18)', () => {
  afterEach(() => {
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('scoreOpened records an opened event with the given ref', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);

    await controller.scoreOpened(SCORE_KEY, { kind: 'library', id: 'repertoire/beginner/scale' });

    const got = await store.getProgress(SCORE_KEY);
    expect(got.ok && got.value?.openedAs).toEqual({ kind: 'library', id: 'repertoire/beginner/scale' });
  });

  it('practised records the bars of a completed range (sessionEnded reachedEnd or loopCompleted)', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await controller.scoreOpened(SCORE_KEY, { kind: 'file', fileKey: 'etude.musicxml' });

    await controller.practised(SCORE_KEY, 3, 8);

    const got = await store.getProgress(SCORE_KEY);
    expect(got.ok && got.value?.practisedBars).toEqual({ fromMeasure: 3, toMeasure: 8 });
    expect(got.ok && got.value?.lastPractisedAt).not.toBeNull();
  });

  it('played records an attempt, and resultRemoved removes it (OD-4)', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });

    await controller.played(SCORE_KEY, r1);
    const afterPlayed = await store.getProgress(SCORE_KEY);
    expect(afterPlayed.ok && afterPlayed.value?.attempts).toBe(1);

    await controller.resultRemoved(SCORE_KEY, 'run-1');
    const afterRemoved = await store.getProgress(SCORE_KEY);
    expect(afterRemoved.ok && afterRemoved.value?.attempts).toBe(0);
  });

  it('computeNewBest is true only for the currently open Score, and only a best-eligible, better result', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await controller.scoreOpened(SCORE_KEY, { kind: 'file', fileKey: 'etude.musicxml' });
    const existingBest = result({
      runId: 'best-so-far',
      finishedAt: '2026-01-01T00:00:00.000Z',
      notesCorrect: { count: 80, total: 100 },
    });
    await controller.played(SCORE_KEY, existingBest);

    const worse = result({
      runId: 'worse',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 50, total: 100 },
    });
    expect(controller.computeNewBest(SCORE_KEY, worse)).toBe(false);

    const better = result({
      runId: 'better',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 95, total: 100 },
    });
    expect(controller.computeNewBest(SCORE_KEY, better)).toBe(true);

    // A partial run never counts for best (OD-1), even if its figures would otherwise beat the current best.
    const partial = result({
      runId: 'partial',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 100, total: 100 },
      scope: { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: null },
    });
    expect(controller.computeNewBest(SCORE_KEY, partial)).toBe(false);

    // A different Score is never "the open Score's" best, regardless of figures.
    expect(controller.computeNewBest('b'.repeat(64), better)).toBe(false);
  });

  it('T097: a stored run that is a new best marks the Score for the browser to announce; a worse or partial run does not', async () => {
    const controller = controllerWith(new MemoryProgressStore());
    await controller.scoreOpened(SCORE_KEY, { kind: 'file', fileKey: 'etude.musicxml' });
    expect(browserState.get().newBestScoreKey).toBeNull();

    await controller.played(
      SCORE_KEY,
      result({ runId: 'first', finishedAt: '2026-01-01T00:00:00.000Z', notesCorrect: { count: 80, total: 100 } }),
    );
    expect(browserState.get().newBestScoreKey).toBe(SCORE_KEY); // the first result is a best: there was none

    browserState.clearNewBest();
    await controller.played(
      SCORE_KEY,
      result({ runId: 'worse', finishedAt: '2026-01-02T00:00:00.000Z', notesCorrect: { count: 50, total: 100 } }),
    );
    await controller.played(
      SCORE_KEY,
      result({
        runId: 'partial',
        finishedAt: '2026-01-03T00:00:00.000Z',
        notesCorrect: { count: 100, total: 100 },
        scope: { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: null },
      }),
    );
    expect(browserState.get().newBestScoreKey).toBeNull();

    await controller.played(
      SCORE_KEY,
      result({ runId: 'better', finishedAt: '2026-01-04T00:00:00.000Z', notesCorrect: { count: 95, total: 100 } }),
    );
    expect(browserState.get().newBestScoreKey).toBe(SCORE_KEY);
  });

  it('IndexedDB unavailable falls back to a memory store and raises one notice (R-19)', async () => {
    const controller = controllerWith(new UnavailableProgressStore());

    await controller.scoreOpened(SCORE_KEY, { kind: 'file', fileKey: 'etude.musicxml' });

    const notices = noticeState.getNotices();
    expect(notices.filter((n) => n.code === 'progressUnavailable')).toHaveLength(1);
    // The fallback store is now genuinely used: `scoreOpened` above landed, so a best-eligible result beats the
    // (still empty) record's null best - proof the event was not silently lost.
    expect(controller.computeNewBest(SCORE_KEY, result({ runId: 'r1' }))).toBe(true);
  });

  it('a write that hits the storage quota raises one "full" notice, not a thrown error', async () => {
    const store = new MemoryProgressStore();
    store.injectQuotaExceededOnNextWrite();
    const controller = controllerWith(store);

    await controller.scoreOpened(SCORE_KEY, { kind: 'file', fileKey: 'etude.musicxml' });

    expect(noticeState.getNotices().filter((n) => n.code === 'progressFull')).toHaveLength(1);
  });

  it('listProgress with skipped > 0 raises one notice, and the browser still lists everything readable', async () => {
    const store = new MemoryProgressStore();
    await store.apply(
      SCORE_KEY,
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'file', fileKey: 'etude.musicxml' } },
      {
        notesCorrectMinPercent: 90,
        notesOnTimeMinPercent: 80,
        tempoPercentMin: 100,
        minStrictness: 'beginner',
        maxExtraPercent: 10,
      },
    );
    await store.writeUnreadableRecord('b'.repeat(64));
    const controller = controllerWith(store);

    controller.open();
    await flush();

    expect(browserState.get().data.records.some((r) => r.scoreKey === SCORE_KEY)).toBe(true);
    expect(noticeState.getNotices().filter((n) => n.code === 'progressPartiallyUnreadable')).toHaveLength(1);
  });
});

describe('BrowserSessionController.startResetProgress (OD-3, R-12, T057)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('cancelResetProgress (Undo) leaves progress and attempts untouched', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.played(SCORE_KEY, result({ runId: 'r1' }));

    controller.startResetProgress({ kind: 'file', fileKey: 'etude.musicxml' }, [SCORE_KEY]);
    expect(browserState.get().pending).toMatchObject({ kind: 'reset' });

    controller.cancelResetProgress();
    expect(browserState.get().pending).toBeNull();
    await vi.runAllTimersAsync();

    expect(removed).toEqual([]);
    const got = await store.getProgress(SCORE_KEY);
    expect(got.ok && got.value?.attempts).toBe(1);
  });

  it('the deadline elapsing commits: apply(reset) for every given hash and removeAttempts for each', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    const olderHash = 'b'.repeat(64);
    await controller.played(SCORE_KEY, result({ runId: 'r1' }));
    await controller.played(olderHash, result({ runId: 'r2' }));

    controller.startResetProgress({ kind: 'file', fileKey: 'etude.musicxml' }, [SCORE_KEY, olderHash]);
    await vi.advanceTimersByTimeAsync(8000);

    expect(browserState.get().pending).toBeNull();
    expect(removed.sort()).toEqual([SCORE_KEY, olderHash].sort());
    expect(await store.getProgress(SCORE_KEY)).toEqual({ ok: true, value: null });
    expect(await store.getProgress(olderHash)).toEqual({ ok: true, value: null });
  });

  it('a commit refreshes an already-open browser, so its list stops showing the reset item as played', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await controller.played(SCORE_KEY, result({ runId: 'r1' }));
    controller.open();
    await flush();
    expect(browserState.get().data.records.some((r) => r.scoreKey === SCORE_KEY)).toBe(true);

    controller.startResetProgress({ kind: 'file', fileKey: 'etude.musicxml' }, [SCORE_KEY]);
    await vi.advanceTimersByTimeAsync(8000);
    await flush();

    expect(browserState.get().data.records.some((r) => r.scoreKey === SCORE_KEY)).toBe(false);
  });

  it('a second startResetProgress call commits the first immediately (R-12: only one at a time)', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    const otherHash = 'c'.repeat(64);
    await controller.played(SCORE_KEY, result({ runId: 'r1' }));
    await controller.played(otherHash, result({ runId: 'r2' }));

    controller.startResetProgress({ kind: 'file', fileKey: 'a.musicxml' }, [SCORE_KEY]);
    controller.startResetProgress({ kind: 'file', fileKey: 'b.musicxml' }, [otherHash]);
    await vi.runAllTimersAsync();

    // The first reset (SCORE_KEY) committed as soon as the second started; the second is still pending until its
    // own deadline, then commits too - both end up removed either way, just not at the same instant.
    expect(removed).toContain(SCORE_KEY);
    expect(await store.getProgress(SCORE_KEY)).toEqual({ ok: true, value: null });
  });

  it('closing the browser inside the undo window removes nothing yet - it only shows a toast, the timer still owns the commit', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.played(SCORE_KEY, result({ runId: 'r1' }));
    controller.open();
    await flush();

    controller.startResetProgress({ kind: 'file', fileKey: 'etude.musicxml' }, [SCORE_KEY]);
    browserState.close();
    await vi.advanceTimersByTimeAsync(1000); // well inside the 8s undo window

    expect(removed).toEqual([]);
    const got = await store.getProgress(SCORE_KEY);
    expect(got.ok && got.value?.attempts).toBe(1);
    expect(noticeState.getNotices().filter((n) => n.code === 'progressResetPending')).toHaveLength(1);
  });
});

describe('BrowserSessionController.seedProgressEvent (T094, contracts/score-browser.md §8)', () => {
  afterEach(() => {
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('goes through the ordinary reducer (apply), not a direct record write: the same runId seeded twice counts once', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    const r1 = result({ runId: 'seed-1', finishedAt: '2026-01-01T00:00:00.000Z' });

    await controller.seedProgressEvent(SCORE_KEY, { type: 'played', at: r1.finishedAt, result: r1 });
    await controller.seedProgressEvent(SCORE_KEY, { type: 'played', at: r1.finishedAt, result: r1 });

    const got = await store.getProgress(SCORE_KEY);
    // A direct write would not know about idempotence; this only holds because `apply` -> `applyProgressEvent`
    // recognised the runId as already recorded (data-model.md §4).
    expect(got.ok && got.value?.attempts).toBe(1);
  });

  it('a seeded opened event sets openedAs and is visible through listProgress, like any other event', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);

    await controller.seedProgressEvent(SCORE_KEY, {
      type: 'opened',
      at: '2026-01-01T00:00:00.000Z',
      as: { kind: 'library', id: 'learning/keys/c-major/beginner' },
    });

    const listed = await store.listProgress();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.records.find((r) => r.scoreKey === SCORE_KEY)?.openedAs).toEqual({
      kind: 'library',
      id: 'learning/keys/c-major/beginner',
    });
  });
});

describe('BrowserSessionController.seedFile (T086, contracts/score-browser.md §8)', () => {
  afterEach(() => {
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  const seeded = (fileName: string, hash: string) => ({
    fileName,
    bytes: new Uint8Array([1, 2, 3]).buffer,
    hash,
    title: `Title of ${fileName}`,
    composer: null,
  });

  it('goes through putFile: the same name twice is one entry, and the entry carries its title and hash', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);

    await controller.seedFile(seeded('Etude.musicxml', 'a'.repeat(64)));
    await controller.seedFile(seeded('Etude.musicxml', 'a'.repeat(64)));
    await controller.seedFile(seeded('Waltz.musicxml', 'b'.repeat(64)));

    const listed = await store.listFiles();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((f) => f.fileKey).sort()).toEqual(['etude.musicxml', 'waltz.musicxml']);
    expect(listed.value.find((f) => f.fileKey === 'etude.musicxml')).toMatchObject({
      title: 'Title of Etude.musicxml',
      hash: 'a'.repeat(64),
      stored: true,
    });
  });

  it('does not refresh the browser itself: a seed of hundreds of files refreshes it once, at the end', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    let phaseChanges = 0;
    browserState.open();
    browserState.indexLoaded(index([]), [], []);
    const unsubscribe = browserState.subscribe(() => {
      phaseChanges += 1;
    });

    for (let i = 0; i < 20; i++) await controller.seedFile(seeded(`f${i}.musicxml`, String(i).padStart(64, '0')));

    unsubscribe();
    expect(phaseChanges).toBe(0);
  });
});

const FILE_BYTES = new Uint8Array([9, 9, 9]).buffer;

describe('BrowserSessionController *My files* (US3, T062)', () => {
  afterEach(() => {
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('fileLoaded upserts the entry, visible through the browser data once open', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    controller.open();
    await flush();

    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: 'Etude',
      composer: 'Composer',
    });
    await flush();

    expect(browserState.get().data.files.map((f) => f.fileKey)).toEqual(['etude.musicxml']);
  });

  it('reopening the same name and content touches the entry - no duplicate, progress kept', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    await controller.played('a'.repeat(64), result({ runId: 'r1' }));

    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });

    const listed = await store.listFiles();
    expect(listed.ok && listed.value).toHaveLength(1);
    const progress = await store.getProgress('a'.repeat(64));
    expect(progress.ok && progress.value?.attempts).toBe(1); // kept, not reset by the second open
  });

  it('openItem for a file with a stored copy loads its bytes with no file chooser (US3 #3)', async () => {
    const store = new MemoryProgressStore();
    const received: { fileName: string; bytes: ArrayBuffer }[] = [];
    const controller = controllerWith(store, undefined, async (fileName, bytes) => {
      received.push({ fileName, bytes });
      return { ok: true };
    });
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    controller.open();
    await flush();

    await controller.openItem({ kind: 'file', fileKey: 'etude.musicxml' }, null);

    expect(received).toHaveLength(1);
    expect(received[0]?.fileName).toBe('Etude.musicxml');
    expect(browserState.get().phase).toBe('closed');
  });

  it('openItem for a file without a stored copy gives the fileNotStored message, browser stays open (US3 #3)', async () => {
    const store = new MemoryProgressStore();
    store.setFileBytesBudgetForTest(1); // the entry exists but its copy never fit
    const controller = controllerWith(store);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    controller.open();
    await flush();

    await controller.openItem({ kind: 'file', fileKey: 'etude.musicxml' }, null);

    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().message).toEqual({ code: 'fileNotStored', fileName: 'Etude.musicxml' });
  });

  it('choosing the same name again reattaches the copy - one entry, now stored', async () => {
    const store = new MemoryProgressStore();
    store.setFileBytesBudgetForTest(1);
    const controller = controllerWith(store);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    expect((await store.listFiles()).ok && (await store.listFiles()).value?.[0]?.stored).toBe(false);

    store.setFileBytesBudgetForTest(1_000_000);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });

    const listed = await store.listFiles();
    expect(listed.ok && listed.value).toHaveLength(1);
    expect(listed.ok && listed.value?.[0]?.stored).toBe(true);
  });

  it('an invalid file reopened from storage gives a message naming the file and the load error (US3 #5)', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store, undefined, async () => ({ ok: false, errorCode: 'malformedXml' }));
    await controller.fileLoaded({
      fileName: 'Broken.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    controller.open();
    await flush();

    await controller.openItem({ kind: 'file', fileKey: 'broken.musicxml' }, null);

    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().message).toEqual({ code: 'malformedXml', fileName: 'Broken.musicxml' });
    // My files is unchanged - the entry from the earlier successful fileLoaded is still there.
    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(1);
  });
});

describe('a pending reset or removal and a run starting (T106, R-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    playState.setRun(null);
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('a Play run starting commits a pending reset at once, so a result earned in the run is not wiped at the deadline', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.played(SCORE_KEY, result({ runId: 'before' }));

    controller.startResetProgress({ kind: 'file', fileKey: 'etude.musicxml' }, [SCORE_KEY]);
    playState.setRun({ phase: 'countIn' } as unknown as PlayRun); // the musician starts a Play run
    await flush(); // no time passes: only the run starting can have committed it
    expect(browserState.get().pending).toBeNull();
    expect(removed).toEqual([SCORE_KEY]);

    // The run's own result lands after the reset, and the old deadline passing does not touch it.
    await controller.played(SCORE_KEY, result({ runId: 'in-the-run', finishedAt: '2026-01-02T00:00:00.000Z' }));
    await vi.advanceTimersByTimeAsync(8000);
    const got = await store.getProgress(SCORE_KEY);
    expect(got.ok && got.value?.attempts).toBe(1);
    expect(got.ok && got.value?.results[0]?.runId).toBe('in-the-run');
    expect(removed).toEqual([SCORE_KEY]); // committed once, not again at the deadline
  });

  it('a Play run starting commits a pending file removal at once too', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: new Uint8Array([1]).buffer,
      hash: SCORE_KEY,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });

    controller.startRemoveFile('etude.musicxml', 'Etude', true, [SCORE_KEY]);
    playState.setRun({ phase: 'countIn' } as unknown as PlayRun);
    await flush();

    expect(browserState.get().pending).toBeNull();
    const listed = await store.listFiles();
    expect(listed.ok && listed.value).toEqual([]);
  });
});

describe('BrowserSessionController.startRemoveFile (OD-3, R-12, T062)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    browserState.reset();
    libraryState.reset();
    noticeState.clear();
  });

  it('cancelRemoveFile (Undo) leaves the entry and progress untouched', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    await controller.played('a'.repeat(64), result({ runId: 'r1' }));

    controller.startRemoveFile('etude.musicxml', 'Etude', false, ['a'.repeat(64)]);
    expect(browserState.get().pending).toMatchObject({ kind: 'removeFile', fileKey: 'etude.musicxml' });

    controller.cancelRemoveFile();
    expect(browserState.get().pending).toBeNull();
    await vi.runAllTimersAsync();

    expect(removed).toEqual([]);
    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(1);
    const progress = await store.getProgress('a'.repeat(64));
    expect(progress.ok && progress.value?.attempts).toBe(1);
  });

  it('"keep progress" removes only the entry - progress and attempts survive', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    await controller.played('a'.repeat(64), result({ runId: 'r1' }));

    controller.startRemoveFile('etude.musicxml', 'Etude', true, ['a'.repeat(64)]);
    await vi.advanceTimersByTimeAsync(8000);

    expect(removed).toEqual([]); // Performances are only deleted for "remove and progress"
    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(0);
    const progress = await store.getProgress('a'.repeat(64));
    expect(progress.ok && progress.value?.attempts).toBe(1);
  });

  it('"remove progress" deletes the entry, resets progress for every hash, and removes their Performances', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    const olderHash = 'b'.repeat(64);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    await controller.played('a'.repeat(64), result({ runId: 'r1' }));
    await controller.played(olderHash, result({ runId: 'r2' }));

    controller.startRemoveFile('etude.musicxml', 'Etude', false, ['a'.repeat(64), olderHash]);
    await vi.advanceTimersByTimeAsync(8000);

    expect(removed.sort()).toEqual(['a'.repeat(64), olderHash].sort());
    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(0);
    expect(await store.getProgress('a'.repeat(64))).toEqual({ ok: true, value: null });
    expect(await store.getProgress(olderHash)).toEqual({ ok: true, value: null });
  });

  it('closing the browser inside the undo window shows a fileRemovedPending toast naming the file', async () => {
    const store = new MemoryProgressStore();
    const controller = controllerWith(store);
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    controller.open();
    await flush();

    controller.startRemoveFile('etude.musicxml', 'Etude', false, ['a'.repeat(64)]);
    browserState.close();
    await vi.advanceTimersByTimeAsync(1000); // well inside the 8s undo window

    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(1);
    const toast = noticeState.getNotices().find((n) => n.code === 'fileRemovedPending');
    expect(toast).toBeDefined();
    expect(toast?.element).toBe('Etude');
  });

  it('starting a reset while a removal is pending commits the removal immediately (R-12: only one at a time)', async () => {
    const store = new MemoryProgressStore();
    const removed: string[] = [];
    const controller = controllerWith(store, async (scoreKey) => void removed.push(scoreKey));
    await controller.fileLoaded({
      fileName: 'Etude.musicxml',
      bytes: FILE_BYTES,
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
    });
    await controller.played(SCORE_KEY, result({ runId: 'r-other' }));

    controller.startRemoveFile('etude.musicxml', 'Etude', false, ['a'.repeat(64)]);
    controller.startResetProgress({ kind: 'file', fileKey: 'other.musicxml' }, [SCORE_KEY]);

    expect((await store.listFiles()).ok && (await store.listFiles()).value).toHaveLength(0); // removal committed at once
  });
});
