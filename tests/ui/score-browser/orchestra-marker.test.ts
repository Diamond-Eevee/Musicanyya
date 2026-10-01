import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-detail.js';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types.js';
import { browserState } from '../../../src/ui/state/browserState.js';

// Feature 019 US4 (score-browser 1.2.0, FR-024, Constitution VI): an item with an Orchestra says so in the list - a glyph and
// the words, not colour alone - and its detail names the instruments in the order the item lists them.

function libraryItem(id: string, title: string, orchestra?: string[]): LibraryItem {
  return {
    id,
    section: 'repertoire/advanced',
    file: `${id}.musicxml`,
    bytes: 100,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title,
      composer: 'Somebody',
      kind: 'piece',
      level: 'advanced',
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
      ...(orchestra ? { orchestra } : {}),
    },
  };
}

function load(items: LibraryItem[]): void {
  const index: LibraryIndex = {
    version: 1,
    generated: '2026-10-01T00:00:00.000Z',
    sections: [
      { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 1 },
      { id: 'repertoire/advanced', title: 'Advanced', path: 'repertoire/advanced', parent: 'repertoire', order: 1 },
    ],
    items,
  };
  browserState.open();
  browserState.indexLoaded(index, [], []);
  browserState.setView({ expanded: ['repertoire'], folder: { kind: 'all' } });
}

const WITH = libraryItem('repertoire/advanced/with-orchestra', 'With Orchestra', ['Flute', 'Oboe', 'Strings']);
const WITHOUT = libraryItem('repertoire/advanced/plain', 'Plain Piece');

describe('the "with orchestra" marker in the browser list (feature 019 US4)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  const row = (list: HTMLElement, id: string) =>
    list.querySelector(`.browser-row[data-ref="library:${id}"]`) as HTMLElement;

  it('a row whose item has an Orchestra shows a glyph and the visible words, with an accessible name', () => {
    load([WITH, WITHOUT]);
    const list = document.createElement('mx-browser-list');
    document.body.appendChild(list);

    const marker = row(list, WITH.id).querySelector('.browser-row-orchestra') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toContain('with orchestra'); // words, not colour alone
    const glyph = marker.querySelector('svg, .browser-row-orchestra-glyph') as Element;
    expect(glyph).not.toBeNull(); // and a shape
    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(marker.getAttribute('aria-label') ?? marker.textContent).toMatch(/with orchestra/i);
  });

  it('a row without an Orchestra shows no marker', () => {
    load([WITH, WITHOUT]);
    const list = document.createElement('mx-browser-list');
    document.body.appendChild(list);
    expect(row(list, WITHOUT.id).querySelector('.browser-row-orchestra')).toBeNull();
    expect(row(list, WITHOUT.id).textContent).not.toMatch(/orchestra/i);
  });
});

describe('the Orchestra instruments in the browser detail (feature 019 US4)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('names the instruments in the order the item lists them', () => {
    load([WITH, WITHOUT]);
    browserState.setView({ selected: { kind: 'library', id: WITH.id } });
    const detail = document.createElement('mx-browser-detail');
    document.body.appendChild(detail);
    const line = detail.querySelector('.browser-detail-orchestra') as HTMLElement;
    expect(line).not.toBeNull();
    expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe('Orchestra: Flute, Oboe, Strings');
  });

  it('an item without an Orchestra has no such line', () => {
    load([WITH, WITHOUT]);
    browserState.setView({ selected: { kind: 'library', id: WITHOUT.id } });
    const detail = document.createElement('mx-browser-detail');
    document.body.appendChild(detail);
    expect(detail.querySelector('.browser-detail-orchestra')).toBeNull();
  });
});
