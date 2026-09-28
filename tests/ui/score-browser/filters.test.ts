import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-score-browser.js';
import type { BrowserViewState } from '../../../src/core/browser/types.js';
import type { LibraryIndex, LibraryItem } from '../../../src/core/library/types.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { libraryIndexOf, record, result } from '../../fakes/progress-builders.js';

/** Six items in one key folder, with different levels, keys, skills and progress, so every filter has something to
 *  keep and something to drop. */
function buildIndex(): LibraryIndex {
  const base = libraryIndexOf(6);
  const shape: Array<{ level: LibraryItem['meta']['level']; keys: string[]; tags: LibraryItem['meta']['tags'] }> = [
    { level: 'beginner', keys: ['G major'], tags: ['sight-reading'] },
    { level: 'beginner', keys: ['G major'], tags: ['scales'] },
    { level: 'intermediate', keys: ['C major'], tags: ['scales', 'ties'] },
    { level: 'advanced', keys: ['E minor'], tags: ['ties'] },
    { level: 'beginner', keys: ['C major'], tags: ['sight-reading'] },
    { level: 'intermediate', keys: ['G major', 'E minor'], tags: ['sight-reading'] },
  ];
  return {
    ...base,
    items: base.items.map((item, i) => {
      const s = shape[i];
      if (!s) return item;
      return {
        ...item,
        meta: { ...item.meta, title: `Piece ${i}`, level: s.level, tags: s.tags },
        facts: { ...item.facts, keys: s.keys },
      };
    }),
  };
}

const DEFAULT_FILTERS: BrowserViewState['filters'] = { level: null, key: null, tag: null, status: null };

function mount(records = [] as ReturnType<typeof record>[]) {
  const el = document.createElement('mx-score-browser');
  document.body.appendChild(el);
  el.querySelector('.browser-body')?.append(document.createElement('mx-browser-list'));
  browserState.open();
  browserState.indexLoaded(buildIndex(), [], records);
  browserState.setView({ folder: { kind: 'all' } });
  return el;
}

function select(el: HTMLElement, name: string): HTMLSelectElement {
  const found = el.querySelector<HTMLSelectElement>(`select[data-filter="${name}"]`);
  if (!found) throw new Error(`no ${name} control`);
  return found;
}

function choose(control: HTMLSelectElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

const titles = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.browser-row .browser-row-title')).map((t) => t.textContent);
const chips = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('.browser-chip'));
const optionLabels = (control: HTMLSelectElement) => Array.from(control.options).map((o) => o.textContent?.trim());

/** The played-once record of the second item: status Played, best 70 %. */
function playedSecondItem() {
  const item = buildIndex().items[1];
  if (!item) throw new Error('fixture');
  const best = result({ notesCorrect: { count: 70, total: 100 }, notesOnTime: { count: 60, total: 70 } });
  return record({ scoreKey: item.hash, attempts: 1, lastPlayedAt: best.finishedAt, best, results: [best] });
}

describe('mx-score-browser filter controls (T079, FR-027, US5 #1)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  it('offers level, key, skill and status controls, each with an "any" choice and a visible label', () => {
    const el = mount();
    const labels = Array.from(el.querySelectorAll('.browser-filters label')).map((l) => l.textContent?.trim());
    expect(labels.some((l) => l?.startsWith('Level'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Key'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Skill'))).toBe(true);
    expect(labels.some((l) => l?.startsWith('Status'))).toBe(true);

    expect(optionLabels(select(el, 'level'))).toEqual([
      'Any level',
      'Introduction',
      'Beginner',
      'Intermediate',
      'Advanced',
    ]);
    // Keys and skills come from the items that exist, sorted: nothing is offered that lists nothing.
    expect(optionLabels(select(el, 'key'))).toEqual(['Any key', 'C major', 'E minor', 'G major']);
    expect(optionLabels(select(el, 'tag'))).toEqual(['Any skill', 'Scales', 'Sight-reading', 'Ties']);
    expect(optionLabels(select(el, 'status'))).toEqual([
      'Any status',
      'New',
      'Practised',
      'Played',
      'Mastered',
      'Not mastered',
      'Played, not mastered',
    ]);
  });

  it('choosing a value filters the list, stores the filter and emits browserviewchange', () => {
    const el = mount();
    expect(titles(el)).toHaveLength(6);
    const changed: Array<Partial<BrowserViewState>> = [];
    el.addEventListener('browserviewchange', (e) => changed.push((e as CustomEvent).detail.view));

    choose(select(el, 'key'), 'G major');

    expect(browserState.get().view.filters).toEqual({ ...DEFAULT_FILTERS, key: 'G major' });
    expect(titles(el)).toEqual(['Piece 0', 'Piece 1', 'Piece 5']);
    expect(changed.at(-1)?.filters).toEqual({ ...DEFAULT_FILTERS, key: 'G major' });
  });

  it('US5 #1: key G major and status New lists only never-attempted G-major items', () => {
    const el = mount([playedSecondItem()]);

    choose(select(el, 'key'), 'G major');
    choose(select(el, 'status'), 'new');

    expect(titles(el)).toEqual(['Piece 0', 'Piece 5']); // Piece 1 is G major too, but it was played
  });

  it('every active filter is a removable chip; removing one keeps the others; Clear all removes every one', () => {
    const el = mount([playedSecondItem()]);
    expect(chips(el)).toHaveLength(0);
    expect(el.querySelector('.browser-clear-all')).toBeNull();

    choose(select(el, 'level'), 'beginner');
    choose(select(el, 'key'), 'G major');
    choose(select(el, 'status'), 'played');

    expect(chips(el).map((c) => c.textContent?.replace('×', '').trim())).toEqual([
      'Level: Beginner',
      'Key: G major',
      'Status: Played',
    ]);
    // A chip's accessible name says what pressing it does, not only what it shows.
    expect(chips(el)[1]?.getAttribute('aria-label')).toBe('Remove filter Key: G major');
    expect(titles(el)).toEqual(['Piece 1']);

    chips(el)[1]?.click();
    expect(browserState.get().view.filters).toEqual({ ...DEFAULT_FILTERS, level: 'beginner', status: 'played' });
    expect(select(el, 'key').value).toBe('');
    expect(chips(el)).toHaveLength(2);

    (el.querySelector('.browser-clear-all') as HTMLButtonElement).click();
    expect(browserState.get().view.filters).toEqual(DEFAULT_FILTERS);
    expect(chips(el)).toHaveLength(0);
    expect(el.querySelector('.browser-clear-all')).toBeNull();
    expect(titles(el)).toHaveLength(6);
  });

  it('the controls show the filters that were stored, and Clear all leaves search and folder alone', () => {
    const el = document.createElement('mx-score-browser');
    document.body.appendChild(el);
    browserState.open();
    browserState.indexLoaded(buildIndex(), [], []);
    browserState.setView({
      folder: { kind: 'all' },
      search: 'piece',
      filters: { level: 'advanced', key: null, tag: 'ties', status: null },
    });

    expect(select(el, 'level').value).toBe('advanced');
    expect(select(el, 'tag').value).toBe('ties');
    expect(chips(el)).toHaveLength(2);

    (el.querySelector('.browser-clear-all') as HTMLButtonElement).click();
    expect(browserState.get().view.search).toBe('piece');
    expect(browserState.get().view.folder).toEqual({ kind: 'all' });
  });

  it('US5 #2: a combination that matches nothing says so and offers Clear filters, which restores the list', () => {
    const el = mount();
    choose(select(el, 'level'), 'advanced');
    choose(select(el, 'key'), 'C major');

    expect(titles(el)).toEqual([]);
    expect(el.querySelector('.browser-empty')?.textContent).toContain('No items match these filters.');
    const clear = Array.from(el.querySelectorAll<HTMLButtonElement>('.browser-empty button')).find(
      (b) => b.textContent?.trim() === 'Clear filters',
    );
    expect(clear).toBeDefined();

    clear?.click();

    expect(browserState.get().view.filters).toEqual(DEFAULT_FILTERS);
    const gone = el.querySelector<HTMLElement>('.browser-empty');
    expect(gone?.hidden).toBe(true);
    expect(gone?.textContent).toBe('');
    expect(titles(el)).toHaveLength(6);
  });

  it('an empty result with no filter active (an empty search, say) offers no Clear filters button', () => {
    const el = mount();
    browserState.setView({ search: 'nothing matches this' });
    expect(titles(el)).toEqual([]);
    expect(el.querySelector('.browser-empty')?.textContent).toContain('No items match these filters.');
    expect(el.querySelector('.browser-empty button')).toBeNull();
  });
});

describe('mx-score-browser sort control (T079, FR-027)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function sortControl(el: HTMLElement): HTMLSelectElement {
    const found = el.querySelector<HTMLSelectElement>('select[data-sort]');
    if (!found) throw new Error('no sort control');
    return found;
  }

  it('offers library order, title, last played and best result, each in both directions', () => {
    const el = mount();
    const control = sortControl(el);
    expect(optionLabels(control)).toEqual([
      'Library order',
      'Library order, reversed',
      'Title, A to Z',
      'Title, Z to A',
      'Last played, newest first',
      'Last played, oldest first',
      'Best result, highest first',
      'Best result, lowest first',
    ]);
    expect(Array.from(control.options).map((o) => o.value)).toEqual([
      'library:asc',
      'library:desc',
      'title:asc',
      'title:desc',
      'lastPlayed:desc',
      'lastPlayed:asc',
      'best:desc',
      'best:asc',
    ]);
  });

  it('shows the current sort, changes it on choice and re-orders the list', () => {
    const el = mount([playedSecondItem()]);
    const control = sortControl(el);
    expect(control.value).toBe('library:asc');

    choose(control, 'title:desc');
    expect(browserState.get().view.sort).toEqual({ by: 'title', dir: 'desc' });
    expect(titles(el)).toEqual(['Piece 5', 'Piece 4', 'Piece 3', 'Piece 2', 'Piece 1', 'Piece 0']);

    choose(control, 'best:asc');
    expect(browserState.get().view.sort).toEqual({ by: 'best', dir: 'asc' });
    expect(titles(el)[0]).toBe('Piece 1'); // the only item with a best result comes first, the rest follow
    expect(sortControl(el).value).toBe('best:asc');
  });

  it('the Independent Test of US5: played, not mastered, best result lowest first', () => {
    const items = buildIndex().items;
    const played = (i: number, correct: number) => {
      const item = items[i];
      if (!item) throw new Error('fixture');
      const best = result({
        notesCorrect: { count: correct, total: 100 },
        notesOnTime: { count: correct, total: correct },
      });
      return record({ scoreKey: item.hash, attempts: 1, lastPlayedAt: best.finishedAt, best, results: [best] });
    };
    const masteredItem = items[4];
    if (!masteredItem) throw new Error('fixture');
    const best = result({ notesCorrect: { count: 98, total: 100 }, notesOnTime: { count: 98, total: 98 } });
    const mastered = record({
      scoreKey: masteredItem.hash,
      attempts: 1,
      lastPlayedAt: best.finishedAt,
      best,
      masteredAt: best.finishedAt,
      masteredBy: best.runId,
      results: [best],
    });
    const el = mount([played(0, 85), played(1, 60), played(2, 72), mastered]);

    choose(select(el, 'status'), 'playedNotMastered');
    choose(sortControl(el), 'best:asc');

    expect(titles(el)).toEqual(['Piece 1', 'Piece 2', 'Piece 0']);
  });
});
