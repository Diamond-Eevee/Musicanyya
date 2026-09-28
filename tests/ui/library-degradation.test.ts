import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-browser-list.js';
import { LibrarySessionController } from '../../src/app/library-session.js';
import { parseLibraryIndex } from '../../src/core/library/index-model.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { browserState } from '../../src/ui/state/browserState.js';
import { FakeLibraryCatalog } from '../fakes/fake-library-catalog.js';

function item(id: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    section: 'repertoire/beginner',
    file: `${id}.musicxml`,
    bytes: 100,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title: 'Ode to Joy',
      composer: 'Beethoven',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 30,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 72,
      maxSpanSemitones: 7,
      staves: 2,
      shortestDivision: 8,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
    ...overrides,
  };
}

function index(items: LibraryItem[]): LibraryIndex {
  return {
    version: 1,
    generated: '2026-09-22T00:00:00.000Z',
    sections: [{ id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 1 }],
    items,
  };
}

/** The browser's own list of everything (the folder *All*), over an index it was given. */
function listAll(loaded: LibraryIndex): HTMLElement {
  browserState.open();
  browserState.indexLoaded(loaded, [], []);
  browserState.setView({ folder: { kind: 'all' } });
  const el = document.createElement('mx-browser-list');
  document.body.appendChild(el);
  return el;
}

// Feature 013 T092: these behaviours were tested through the retired `mx-library`; they now run through the
// browser's list. The remaining case of the old file - a missing index.json shows one message with Retry, and a
// retry recovers - is `tests/engine/browser-session.test.ts` (an index failure gives `indexError` with My files
// and Continue still listed, and Retry reloads) and `tests/ui/score-browser/rail-list-detail.test.ts`.
describe('library degradation (data-model.md §3 + §6, quickstart §US5.3-4)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('an item that fails index validation (a missing/invalid sidecar) is skipped with a notice; the rest of the library still lists', () => {
    const rawIndex = {
      version: 1,
      generated: '2026-09-22T00:00:00.000Z',
      sections: [{ id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 1 }],
      items: [
        item('repertoire/beginner/ode-to-joy'),
        // No `meta` at all - the runtime equivalent of a missing/invalid sidecar
        // (contracts/library-index.md §3: "an item that fails validation is skipped and reported").
        {
          id: 'repertoire/beginner/no-sidecar',
          section: 'repertoire/beginner',
          file: 'repertoire/beginner/no-sidecar.musicxml',
        },
      ],
    };

    const { index: validated, notices } = parseLibraryIndex(rawIndex);
    expect(notices).toEqual([{ code: 'invalidItem', id: 'repertoire/beginner/no-sidecar' }]);
    expect(validated.items.map((i) => i.id)).toEqual(['repertoire/beginner/ode-to-joy']);

    const el = listAll(validated);
    expect(el.querySelectorAll('.browser-row').length).toBe(1);
    expect(el.innerHTML).toContain('Ode to Joy');
  });

  it('a missing item file raises a notice on open, and the rest of the library stays listed and clickable', async () => {
    const catalog = new FakeLibraryCatalog();
    const twoItems = [
      item('repertoire/beginner/ode-to-joy'),
      item('repertoire/beginner/fur-elise', { section: 'repertoire/beginner' }),
    ];
    catalog.setIndex(index(twoItems));

    catalog.failNextItem = 'notFound';
    const notices: string[] = [];
    const controller = new LibrarySessionController(catalog, {
      loadBytes: async () => {},
      onNotice: (code) => notices.push(code),
    });
    const ok = await controller.openItem(index(twoItems), 'repertoire/beginner/ode-to-joy');
    expect(ok).toBe(false);
    expect(notices).toEqual(['libraryItemMissing']);

    // The browser stays usable with both items intact.
    const el = listAll(index(twoItems));
    expect(browserState.get().phase).toBe('ready');
    expect(el.querySelectorAll('.browser-row').length).toBe(2);
  });
});
