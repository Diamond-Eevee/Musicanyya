import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-detail.js';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types.js';
import { scoreSourceLines } from '../../../src/ui/format/score-source-text.js';
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

describe('mx-browser-rail (US1 #2, contracts/score-browser.md §1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('renders Continue, All, the section tree and My files as role="tree" items, every folder expanded', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    expect(el.getAttribute('role')).toBe('tree');
    const items = Array.from(el.querySelectorAll('[role="treeitem"]'));
    const labels = items.map((i) => i.textContent?.trim());
    expect(labels).toEqual(['Continue', 'All', 'Repertoire', 'Beginner', 'My files']);
    // Every folder with children is expanded by default (contracts/score-browser.md §1).
    const repertoire = items.find((i) => i.textContent?.trim() === 'Repertoire');
    expect(repertoire?.getAttribute('aria-expanded')).toBe('true');
  });

  it('selecting a folder emits browserviewchange and updates browserState.view.folder', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    const changed = new Promise<{ view: { folder: unknown } }>((resolve) => {
      el.addEventListener('browserviewchange', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    const beginner = Array.from(el.querySelectorAll('[role="treeitem"]')).find(
      (i) => i.textContent?.trim() === 'Beginner',
    );
    (beginner as HTMLElement).click();

    return changed.then((detail) => {
      expect(detail.view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
      expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
    });
  });
});

describe('mx-browser-list (US1 #2)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('renders role="listbox" rows with title, subtitle, level, key and length', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    expect(el.getAttribute('role')).toBe('listbox');
    const row = el.querySelector('[role="option"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.dataset.ref).toBe('library:repertoire/beginner/ode-to-joy');
    expect(row.textContent).toContain('Ode to Joy');
    expect(row.textContent).toContain('Beethoven');
    expect(row.textContent).toContain('Beginner');
    expect(row.textContent).toContain('C major');
    expect(row.textContent).toContain('1:20');
  });

  it('shows "Library unavailable" with a Retry button when the index failed, and Retry emits browserretrylibrary (Edge Cases)', () => {
    browserState.open();
    browserState.indexFailed('unavailable', [], []);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    expect(el.querySelector('.browser-error-message')?.textContent).toBe('Library unavailable.');
    const retried = new Promise<void>((resolve) => {
      el.addEventListener('browserretrylibrary', () => resolve(), { once: true });
    });
    (el.querySelector('.browser-retry') as HTMLButtonElement).click();
    return retried;
  });

  it('double click on a row emits browseropenitem with its ItemRef', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const opened = new Promise<{ ref: unknown }>((resolve) => {
      el.addEventListener('browseropenitem', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    const row = el.querySelector('[role="option"]') as HTMLElement;
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    return opened.then((detail) => {
      expect(detail.ref).toEqual({ kind: 'library', id: 'repertoire/beginner/ode-to-joy' });
    });
  });

  it('a real double click (click, click, dblclick) still opens - the first click never re-renders the row out from under the second (found live in e2e)', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const opened = new Promise<{ ref: unknown }>((resolve) => {
      el.addEventListener('browseropenitem', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    const row = el.querySelector('[role="option"]') as HTMLElement;
    // A native double click fires click, click, then dblclick, all within milliseconds - well before the
    // deferred single-click selection (300ms) would otherwise replace this element's own innerHTML.
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    // The row is still the same element (no re-render happened): the deferred select() was cancelled.
    expect(el.querySelector('[role="option"]')).toBe(row);

    return opened.then((detail) => {
      expect(detail.ref).toEqual({ kind: 'library', id: 'repertoire/beginner/ode-to-joy' });
    });
  });

  it('Enter on the active row emits browseropenitem', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const opened = new Promise<{ ref: unknown }>((resolve) => {
      el.addEventListener('browseropenitem', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    return opened.then((detail) => {
      expect(detail.ref).toEqual({ kind: 'library', id: 'repertoire/beginner/ode-to-joy' });
    });
  });
});

describe('mx-browser-detail (FR-013)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it("shows metadata and, for a library item, source/licence text equal to mx-score-source's for the same item", () => {
    const item = libraryItem('repertoire/beginner/ode-to-joy');
    loadIndex([item]);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    expect(el.getAttribute('role')).toBe('region');
    expect(el.textContent).toContain('Ode to Joy');
    expect(el.textContent).toContain('Beethoven');
    const lines = Array.from(el.querySelectorAll('.score-source-line')).map((l) => l.textContent);
    expect(lines).toEqual(scoreSourceLines(item));
  });

  it('the Open button emits browseropenitem with the selected ItemRef', () => {
    const item = libraryItem('repertoire/beginner/ode-to-joy');
    loadIndex([item]);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const opened = new Promise<{ ref: unknown }>((resolve) => {
      el.addEventListener('browseropenitem', (e) => resolve((e as CustomEvent).detail), { once: true });
    });
    (el.querySelector('.browser-detail-open') as HTMLButtonElement).click();

    return opened.then((detail) => {
      expect(detail.ref).toEqual({ kind: 'library', id: item.id });
    });
  });
});
