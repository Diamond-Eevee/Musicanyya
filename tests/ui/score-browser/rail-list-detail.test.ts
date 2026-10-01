import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-detail.js';
import '../../../src/ui/elements/mx-score-browser.js';
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
  browserState.setView({ expanded: ['repertoire'] }); // 018: the rail starts collapsed; Beginner sits under Repertoire
}

describe('mx-browser-rail (US1 #2, contracts/score-browser.md §1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('renders Continue, All, the section tree and My files as role="tree" items, with the folders open', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    expect(el.getAttribute('role')).toBe('tree');
    const items = Array.from(el.querySelectorAll('[role="treeitem"]'));
    const labels = items.map((i) => i.querySelector('.browser-rail-label')?.textContent?.trim());
    expect(labels).toEqual(['Continue', 'All', 'Repertoire', 'Beginner', 'My files']);
    // A folder listed in view.expanded is shown expanded (018 contract §1; 013 showed every folder expanded).
    const repertoire = items.find((i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === 'Repertoire');
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
      (i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === 'Beginner',
    );
    (beginner as HTMLElement).click();

    return changed.then((detail) => {
      expect(detail.view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
      expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
    });
  });

  it('with a search active, All is shown selected even though the stored folder is something else (US1 #4, spec.md scenario 4)', () => {
    loadIndex([libraryItem('repertoire/beginner/ode-to-joy')]);
    browserState.setView({ folder: { kind: 'section', id: 'repertoire/beginner' } });
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);
    browserState.setView({ search: 'joy' });

    const items = Array.from(el.querySelectorAll('[role="treeitem"]'));
    const byLabel = (label: string) =>
      items.find((i) => i.querySelector('.browser-rail-label')?.textContent?.trim() === label);
    expect(byLabel('All')?.getAttribute('aria-selected')).toBe('true');
    expect(byLabel('Beginner')?.getAttribute('aria-selected')).toBe('false');
    // The stored folder itself is untouched - clearing the search returns to it (spec.md scenario 5).
    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'repertoire/beginner' });
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
    // The message is the dialog's, beside the list, not a child of the listbox (a listbox holds options only,
    // T089); it belongs to the library's folders, so the default Continue view does not show it.
    const browser = document.createElement('mx-score-browser');
    document.body.appendChild(browser);
    const list = document.createElement('mx-browser-list');
    browser.querySelector('.browser-body')?.appendChild(list);
    browserState.open();
    browserState.indexFailed('unavailable', [], []);
    const banner = browser.querySelector('.browser-error') as HTMLElement;
    expect(banner.hidden).toBe(true);

    browserState.setView({ folder: { kind: 'all' } });

    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('.browser-error-message')?.textContent).toBe('Library unavailable.');
    expect(list.querySelector('.browser-error')).toBeNull();
    const retried = new Promise<void>((resolve) => {
      browser.addEventListener('browserretrylibrary', () => resolve(), { once: true });
    });
    (banner.querySelector('.browser-retry') as HTMLButtonElement).click();
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

// Owner decision 2026-09-28 (T098-T100): what the retired Scores panel showed is carried into the browser first.
describe('the old panel presentation, carried over (T098-T100)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('T098: a row shows its step before its level ("1 Introduction" ... "Song"), and nothing for an item with no step', () => {
    const stepped = libraryItem('repertoire/beginner/a', {
      meta: { ...libraryItem('x').meta, title: 'Stepped', level: 'introduction', step: 'introduction', stepOrder: 0 },
    });
    const song = libraryItem('repertoire/beginner/b', {
      meta: { ...libraryItem('x').meta, title: 'A song', step: 'song', stepOrder: 10 },
    });
    const plain = libraryItem('repertoire/beginner/c', { meta: { ...libraryItem('x').meta, title: 'Plain' } });
    loadIndex([stepped, song, plain]);
    browserState.setView({ folder: { kind: 'all' } });
    const el = document.createElement('mx-browser-list');
    document.body.appendChild(el);

    const row = (id: string) => el.querySelector(`[data-ref="library:repertoire/beginner/${id}"]`) as HTMLElement;
    expect(row('a').querySelector('.browser-row-step')?.textContent).toBe('1 Introduction');
    expect(row('b').querySelector('.browser-row-step')?.textContent).toBe('Song');
    expect(row('c').querySelector('.browser-row-step')).toBeNull();
    // before the level chip (both on the row's second line, `.browser-row-meta` since feature 016 R-13)
    const children = Array.from(row('a').querySelector('.browser-row-meta')?.children ?? []).map((c) => c.className);
    expect(children.indexOf('browser-row-step')).toBeLessThan(children.indexOf('browser-row-level'));
  });

  it('T099: a key-change folder shows its relation word beside its name in the rail; other folders show none', () => {
    const sections = [
      { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
      { id: 'learning/key-changes', title: 'Key changes', path: 'learning/key-changes', parent: 'learning', order: 1 },
      {
        id: 'learning/key-changes/c-major-to-a-minor',
        title: 'C major to A minor',
        path: 'learning/key-changes/c-major-to-a-minor',
        parent: 'learning/key-changes',
        order: 1,
        description: 'relative minor',
      },
    ];
    const item = libraryItem('learning/key-changes/c-major-to-a-minor/introduction', {
      section: 'learning/key-changes/c-major-to-a-minor',
    });
    browserState.open();
    browserState.indexLoaded({ version: 1, generated: '2026-09-22T00:00:00.000Z', sections, items: [item] }, [], []);
    browserState.setView({ expanded: ['learning', 'learning/key-changes'] }); // 018: the rail starts collapsed
    const el = document.createElement('mx-browser-rail');
    document.body.appendChild(el);

    const relationOf = (key: string) =>
      el.querySelector(`[data-key="section:${key}"] .browser-rail-relation`)?.textContent;
    expect(relationOf('learning/key-changes/c-major-to-a-minor')).toBe('relative minor');
    expect(relationOf('learning/key-changes')).toBeUndefined();
    expect(relationOf('learning')).toBeUndefined();
  });

  it("T100: the detail pane labels a library item's key, metre, tempo, measures, duration, hands and skills", () => {
    const base = libraryItem('repertoire/beginner/ode-to-joy');
    const item = libraryItem('repertoire/beginner/ode-to-joy', { meta: { ...base.meta, hands: 'both' } });
    loadIndex([item]);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const meta = el.querySelector('.browser-detail-facts')?.textContent ?? '';
    expect(meta).toContain('Key: C major');
    expect(meta).toContain('Metre: 4/4');
    expect(meta).toContain('Tempo: 100 BPM');
    expect(meta).toContain('Measures: 16');
    expect(meta).toContain('Duration: 1:20');
    expect(meta).toContain('Hands: both');
    expect(meta).toContain('Skill: Sight-reading');
  });

  it('T100: a fact an item does not have is left out, not shown empty', () => {
    const base = libraryItem('repertoire/beginner/ode-to-joy');
    const item = libraryItem('repertoire/beginner/ode-to-joy', {
      facts: { ...base.facts, keys: [], metres: [], tempoBpm: null },
    });
    loadIndex([item]);
    browserState.setView({ selected: { kind: 'library', id: item.id } });
    const el = document.createElement('mx-browser-detail');
    document.body.appendChild(el);

    const meta = el.querySelector('.browser-detail-facts')?.textContent ?? '';
    expect(meta).not.toContain('Key:');
    expect(meta).not.toContain('Metre:');
    expect(meta).not.toContain('Tempo:');
    expect(meta).not.toContain('Hands:');
    expect(meta).toContain('Measures: 16');
  });
});
