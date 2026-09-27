import { afterEach, describe, expect, it } from 'vitest';
import { BrowserSessionController } from '../../src/app/browser-session.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord } from '../../src/core/progress/types.js';
import type { ProgressStore, ProgressStoreResult } from '../../src/engine/ports.js';
import { MemoryProgressStore } from '../../src/engine/storage/memory-progress-store.js';
import { browserState } from '../../src/ui/state/browserState.js';
import { libraryState } from '../../src/ui/state/libraryState.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { FakeLibraryCatalog } from '../fakes/fake-library-catalog.js';
import { result } from '../fakes/progress-builders.js';

/** Lets every microtask hop of `loadIndex` (catalog + progress store availability + listProgress) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
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

function controllerWith(progressStore: ProgressStore = new MemoryProgressStore()): BrowserSessionController {
  const catalog = new FakeLibraryCatalog();
  catalog.setIndex(index([]));
  return new BrowserSessionController(catalog, { loadBytes: async () => {} }, undefined, progressStore);
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
