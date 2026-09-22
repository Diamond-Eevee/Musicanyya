import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-library.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { libraryState } from '../../src/ui/state/libraryState.js';

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
    sections: [
      { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 1 },
      { id: 'repertoire/intermediate', title: 'Intermediate', path: 'repertoire/intermediate', parent: null, order: 2 },
    ],
    items,
  };
}

describe('mx-library', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    libraryState.reset();
  });

  it('renders sections and items with title, composer and level', () => {
    const furElise = item('repertoire/intermediate/fur-elise', { section: 'repertoire/intermediate' });
    furElise.meta = { ...furElise.meta, title: 'Fur Elise', level: 'intermediate' };
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const html = el.innerHTML;
    expect(html).toContain('Beginner');
    expect(html).toContain('Intermediate');
    expect(html).toContain('Ode to Joy');
    expect(html).toContain('Beethoven');
    expect(el.querySelectorAll('.library-item').length).toBe(2);
  });

  it('emits openlibraryitem with the item id when an item is clicked', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy')]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const detail = new Promise<{ id: string }>((resolve) => {
      el.addEventListener('openlibraryitem', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    el.querySelector<HTMLButtonElement>('.library-item-open')?.click();
    return detail.then((d) => expect(d.id).toBe('repertoire/beginner/ode-to-joy'));
  });

  it('shows one error row with Retry when the index fails', () => {
    libraryState.startLoadingIndex();
    libraryState.indexFailed('unavailable');
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    expect(el.querySelectorAll('.library-error').length).toBe(1);
    const retryButton = el.querySelector<HTMLButtonElement>('.library-retry');
    expect(retryButton).not.toBeNull();

    const retried = new Promise<void>((resolve) => {
      el.addEventListener('libraryretry', () => resolve(), { once: true });
    });
    retryButton?.click();
    return retried;
  });
});
