import { afterEach, describe, expect, it } from 'vitest';
import { BrowserSessionController } from '../../src/app/browser-session.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { browserState } from '../../src/ui/state/browserState.js';
import { libraryState } from '../../src/ui/state/libraryState.js';
import { FakeLibraryCatalog } from '../fakes/fake-library-catalog.js';

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
    const controller = new BrowserSessionController(catalog, {
      loadBytes: async (fileName, loaded) => {
        received.push({ fileName, bytes: loaded });
      },
    });

    controller.open();
    await Promise.resolve();
    await Promise.resolve();
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
    const controller = new BrowserSessionController(catalog, { loadBytes: async () => {} });

    controller.open();
    await Promise.resolve();
    await Promise.resolve();
    const loadedIndex = browserState.get().data.index;
    if (!loadedIndex) throw new Error('expected the index to have loaded');

    await controller.openItem({ kind: 'library', id: 'repertoire/beginner/scale' }, loadedIndex);

    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().message).toEqual({ code: 'libraryUnavailable' });
  });

  it('an index failure gives indexError, and retryLibrary reloads it', async () => {
    const catalog = new FakeLibraryCatalog();
    catalog.failNextIndex = 'unavailable';
    const controller = new BrowserSessionController(catalog, { loadBytes: async () => {} });

    controller.open();
    await Promise.resolve();
    await Promise.resolve();
    expect(browserState.get().phase).toBe('ready');
    expect(browserState.get().data.indexError).toBe('unavailable');

    catalog.setIndex(index([item()]));
    controller.retryLibrary();
    await Promise.resolve();
    await Promise.resolve();
    expect(browserState.get().data.indexError).toBeNull();
    expect(browserState.get().data.index).not.toBeNull();
  });
});
