import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-detail.js';
import '../../../src/ui/elements/mx-score-browser.js';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types.js';
import { browserState } from '../../../src/ui/state/browserState.js';

function libraryItem(id: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
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
      durationSeconds: 80,
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
    sections: [
      { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 1 },
      { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
    ],
    items,
  };
}

function loadIndex(items: LibraryItem[]): void {
  browserState.open();
  browserState.indexLoaded(index(items), [], []);
}

// A press on an element that an update replaced never becomes a click, so an update between the press and the
// release lost the first click on *All* (found on WebKit under load; the browser's load-time update lands ~30 ms after
// the page is up). Elements whose content did not change must survive an update, and clicks and double clicks must
// still work on the ones that did (delegated listeners).
describe('the rail and the list keep the elements an update did not change', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('the rail keeps the Continue and All items when the library index arrives, and the click on All still selects it', () => {
    browserState.open();
    const rail = document.createElement('mx-browser-rail');
    document.body.appendChild(rail);
    const all = rail.querySelector('[data-key="all"]');
    const cont = rail.querySelector('[data-key="continue"]');
    expect(all).not.toBeNull();

    browserState.indexLoaded(index([libraryItem('repertoire/beginner/ode-to-joy')]), [], []);

    expect(rail.querySelector('[data-key="all"]')).toBe(all);
    expect(rail.querySelector('[data-key="continue"]')).toBe(cont);
    (all as HTMLElement).click();
    expect(browserState.get().view.folder).toEqual({ kind: 'all' });
  });

  it('a click on a rail item selects it once, however many updates came before', () => {
    browserState.open();
    const rail = document.createElement('mx-browser-rail');
    document.body.appendChild(rail);
    browserState.indexLoaded(index([libraryItem('a')]), [], []);
    browserState.startRefresh();
    browserState.indexLoaded(index([libraryItem('a'), libraryItem('b')]), [], []);
    let changes = 0;
    rail.addEventListener('browserviewchange', () => changes++);
    (rail.querySelector('[data-key="all"]') as HTMLElement).click();
    expect(changes).toBe(1);
  });

  it('the list keeps the rows an update did not change, and a double click on a kept row opens that row', () => {
    loadIndex([libraryItem('repertoire/beginner/a', { meta: { ...libraryItem('x').meta, title: 'Alpha' } })]);
    browserState.setView({ folder: { kind: 'all' } });
    const list = document.createElement('mx-browser-list');
    document.body.appendChild(list);
    const alpha = list.querySelector('[data-ref="library:repertoire/beginner/a"]');
    expect(alpha).not.toBeNull();

    browserState.startRefresh();
    browserState.indexLoaded(
      index([
        libraryItem('repertoire/beginner/a', { meta: { ...libraryItem('x').meta, title: 'Alpha' } }),
        libraryItem('repertoire/beginner/b', { meta: { ...libraryItem('x').meta, title: 'Beta' } }),
      ]),
      [],
      [],
    );
    expect(list.querySelector('[data-ref="library:repertoire/beginner/a"]')).toBe(alpha);

    const opened: unknown[] = [];
    list.addEventListener('browseropenitem', (e) => opened.push((e as CustomEvent).detail.ref));
    alpha?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(opened).toEqual([{ kind: 'library', id: 'repertoire/beginner/a' }]);
  });

  it('a double click opens the row that was under the pointer even if the list changed after the first click', () => {
    loadIndex([
      libraryItem('repertoire/beginner/a', { meta: { ...libraryItem('x').meta, title: 'Alpha' } }),
      libraryItem('repertoire/beginner/b', { meta: { ...libraryItem('x').meta, title: 'Beta' } }),
    ]);
    browserState.setView({ folder: { kind: 'all' } });
    const list = document.createElement('mx-browser-list');
    document.body.appendChild(list);
    const beta = list.querySelector('[data-ref="library:repertoire/beginner/b"]') as HTMLElement;
    const opened: unknown[] = [];
    list.addEventListener('browseropenitem', (e) => opened.push((e as CustomEvent).detail.ref));

    beta.click();
    // A row above appears between the two clicks, so Beta moves to a new index.
    browserState.startRefresh();
    browserState.indexLoaded(
      index([
        libraryItem('repertoire/beginner/0', { meta: { ...libraryItem('x').meta, title: 'Aardvark' } }),
        libraryItem('repertoire/beginner/a', { meta: { ...libraryItem('x').meta, title: 'Alpha' } }),
        libraryItem('repertoire/beginner/b', { meta: { ...libraryItem('x').meta, title: 'Beta' } }),
      ]),
      [],
      [],
    );
    const betaNow = list.querySelector('[data-ref="library:repertoire/beginner/b"]') as HTMLElement;
    betaNow.click();
    betaNow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(opened).toEqual([{ kind: 'library', id: 'repertoire/beginner/b' }]);
  });
});
