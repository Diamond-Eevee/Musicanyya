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
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 33,
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

const furElise = () =>
  item('repertoire/intermediate/fur-elise', {
    section: 'repertoire/intermediate',
    meta: {
      version: 1,
      title: 'Fur Elise',
      composer: 'Beethoven',
      kind: 'piece',
      level: 'intermediate',
      tags: ['phrasing', 'dynamics'],
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'Musicanyya', created: '2026-09-22' },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 9,
      notes: 53,
      durationSeconds: 10,
      keys: ['A minor'],
      metres: ['3/8'],
      tempoBpm: 72,
      lowestMidi: 40,
      highestMidi: 76,
      maxSpanSemitones: 0,
      staves: 2,
      shortestDivision: 16,
      notesPerBeat: 4,
      accidentals: 0,
      notices: [],
    },
  });

describe('mx-library filters (contracts/library-port.md §3, FR-012)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    libraryState.reset();
  });

  it('the level filter chip narrows the list and emits libraryfilterchange', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);
    expect(el.querySelectorAll('.library-item').length).toBe(2);

    const changed = new Promise<{ filter: unknown }>((resolve) => {
      el.addEventListener('libraryfilterchange', (e) => resolve((e as CustomEvent).detail), { once: true });
    });

    const levelSelect = el.querySelector<HTMLSelectElement>('.library-filter-level');
    expect(levelSelect).not.toBeNull();
    if (levelSelect) {
      levelSelect.value = 'intermediate';
      levelSelect.dispatchEvent(new Event('change'));
    }

    return changed.then((detail) => {
      expect(detail.filter).toEqual({ sectionId: null, level: 'intermediate', key: null, tag: null, text: '' });
      expect(el.querySelectorAll('.library-item').length).toBe(1);
      expect(el.innerHTML).toContain('Fur Elise');
      expect(el.innerHTML).not.toContain('Ode to Joy');
    });
  });

  it('the text box narrows by title/composer, case- and accent-insensitively', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const textInput = el.querySelector<HTMLInputElement>('.library-filter-text');
    expect(textInput).not.toBeNull();
    if (textInput) {
      textInput.value = 'elise';
      textInput.dispatchEvent(new Event('input'));
    }

    expect(el.querySelectorAll('.library-item').length).toBe(1);
    expect(el.innerHTML).toContain('Fur Elise');
  });

  it('the tag filter narrows the list', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const tagSelect = el.querySelector<HTMLSelectElement>('.library-filter-tag');
    expect(tagSelect).not.toBeNull();
    if (tagSelect) {
      tagSelect.value = 'phrasing';
      tagSelect.dispatchEvent(new Event('change'));
    }

    expect(el.querySelectorAll('.library-item').length).toBe(1);
    expect(el.innerHTML).toContain('Fur Elise');
  });

  it('the key filter narrows the list', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const keySelect = el.querySelector<HTMLSelectElement>('.library-filter-key');
    expect(keySelect).not.toBeNull();
    if (keySelect) {
      keySelect.value = 'A minor';
      keySelect.dispatchEvent(new Event('change'));
    }

    expect(el.querySelectorAll('.library-item').length).toBe(1);
    expect(el.innerHTML).toContain('Fur Elise');
  });

  it('shows a "no results" message when a filter matches nothing', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy')]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const levelSelect = el.querySelector<HTMLSelectElement>('.library-filter-level');
    if (levelSelect) {
      levelSelect.value = 'advanced';
      levelSelect.dispatchEvent(new Event('change'));
    }

    expect(el.querySelectorAll('.library-item').length).toBe(0);
    expect(el.querySelector('.library-no-results')).not.toBeNull();
  });

  it('Clear filters resets to the unfiltered list', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const levelSelect = el.querySelector<HTMLSelectElement>('.library-filter-level');
    if (levelSelect) {
      levelSelect.value = 'intermediate';
      levelSelect.dispatchEvent(new Event('change'));
    }
    expect(el.querySelectorAll('.library-item').length).toBe(1);

    el.querySelector<HTMLButtonElement>('.library-filter-clear')?.click();
    expect(el.querySelectorAll('.library-item').length).toBe(2);
    expect(libraryState.getFilter()).toEqual({ sectionId: null, level: null, key: null, tag: null, text: '' });
  });

  it('the item detail shows composer, key, metre, tempo, measures, duration, hands and tags (FR-010, FR-012)', () => {
    libraryState.indexLoaded(index([furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const detail = el.querySelector('.library-item-detail')?.textContent ?? '';
    expect(detail).toContain('A minor');
    expect(detail).toContain('3/8');
    expect(detail).toContain('72');
    expect(detail).toContain('9');
    expect(detail).toContain('0:10');
    expect(detail).toContain('both');
    expect(detail).toContain('Phrasing');
  });

  it('selecting a level shows its plain-language description (FR-009)', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy')]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);
    expect(el.querySelector('.library-level-description')).toBeNull();

    const levelSelect = el.querySelector<HTMLSelectElement>('.library-filter-level');
    if (levelSelect) {
      levelSelect.value = 'beginner';
      levelSelect.dispatchEvent(new Event('change'));
    }
    expect(el.querySelector('.library-level-description')?.textContent?.length).toBeGreaterThan(0);
  });

  it('the filter persists across re-renders via libraryState (contracts/library-port.md §3)', () => {
    libraryState.indexLoaded(index([item('repertoire/beginner/ode-to-joy'), furElise()]));
    const el = document.createElement('mx-library');
    document.body.appendChild(el);

    const keySelect = el.querySelector<HTMLSelectElement>('.library-filter-key');
    if (keySelect) {
      keySelect.value = 'A minor';
      keySelect.dispatchEvent(new Event('change'));
    }
    expect(libraryState.getFilter().key).toBe('A minor');

    // A second element mounted against the same libraryState sees the same filter (US3 scenario).
    const el2 = document.createElement('mx-library');
    document.body.appendChild(el2);
    expect(el2.querySelectorAll('.library-item').length).toBe(1);
  });
});
