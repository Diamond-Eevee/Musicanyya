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

  it('SC-007: a synthetic 200-item index renders within the 1 s budget', () => {
    const bigItems = Array.from({ length: 200 }, (_, i) =>
      item(`repertoire/${i % 2 === 0 ? 'beginner' : 'intermediate'}/piece-${i}`, {
        section: i % 2 === 0 ? 'repertoire/beginner' : 'repertoire/intermediate',
      }),
    );
    libraryState.indexLoaded(index(bigItems));
    const el = document.createElement('mx-library');

    const start = performance.now();
    document.body.appendChild(el);
    const elapsedMs = performance.now() - start;

    expect(el.querySelectorAll('.library-item').length).toBe(200);
    expect(elapsedMs).toBeLessThan(1000);
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

// Feature 011 T022 (contracts/library-port.md 1.2.0 §2, §4): the panel is a folder tree of native <details>.
describe('mx-library: the folder tree (feature 011)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    libraryState.reset();
  });

  const SECTIONS: LibraryIndex['sections'] = [
    { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
    { id: 'learning/keys', title: 'Keys', path: 'learning/keys', parent: 'learning', order: 1 },
    { id: 'learning/keys/c-major', title: 'C major', path: 'learning/keys/c-major', parent: 'learning/keys', order: 1 },
    { id: 'learning/keys/a-minor', title: 'A minor', path: 'learning/keys/a-minor', parent: 'learning/keys', order: 2 },
    { id: 'learning/key-changes', title: 'Key changes', path: 'learning/key-changes', parent: 'learning', order: 2 },
    {
      id: 'learning/key-changes/c-major-to-a-minor',
      title: 'C major -> A minor',
      description: 'relative',
      path: 'learning/key-changes/c-major-to-a-minor',
      parent: 'learning/key-changes',
      order: 1,
    },
    { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 2 },
    { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
  ];

  function stepItem(
    id: string,
    section: string,
    step: string,
    level: string,
    title: string,
    stepOrder = 0,
  ): LibraryItem {
    const base = item(id, { section });
    return {
      ...base,
      meta: {
        ...base.meta,
        title,
        kind: 'exercise',
        level: level as 'beginner',
        step: step as 'beginner',
        stepOrder,
        tags: ['chords'],
      },
    };
  }

  function treeIndex(): LibraryIndex {
    return {
      version: 1,
      generated: '2026-09-26T00:00:00.000Z',
      sections: SECTIONS,
      items: [
        stepItem(
          'learning/keys/c-major/introduction',
          'learning/keys/c-major',
          'introduction',
          'introduction',
          'C major - introduction',
        ),
        stepItem(
          'learning/keys/c-major/beginner',
          'learning/keys/c-major',
          'beginner',
          'beginner',
          'C major - beginner',
        ),
        stepItem(
          'learning/keys/c-major/intermediate',
          'learning/keys/c-major',
          'intermediate',
          'intermediate',
          'C major - intermediate',
        ),
        stepItem(
          'learning/keys/c-major/advanced',
          'learning/keys/c-major',
          'advanced',
          'advanced',
          'C major - advanced',
        ),
        stepItem('learning/keys/c-major/song-x', 'learning/keys/c-major', 'song', 'beginner', 'A song', 10),
        stepItem(
          'learning/keys/a-minor/advanced',
          'learning/keys/a-minor',
          'advanced',
          'advanced',
          'A minor - advanced',
        ),
        stepItem(
          'learning/key-changes/c-major-to-a-minor/introduction',
          'learning/key-changes/c-major-to-a-minor',
          'introduction',
          'introduction',
          'C major to A minor - introduction',
        ),
        item('repertoire/beginner/ode-to-joy', { section: 'repertoire/beginner' }),
      ],
    };
  }

  const mount = (): HTMLElement => {
    libraryState.indexLoaded(treeIndex());
    const el = document.createElement('mx-library');
    document.body.appendChild(el);
    return el;
  };
  const folder = (el: Element, id: string): HTMLDetailsElement | null =>
    el.querySelector<HTMLDetailsElement>(`details.library-section[data-section="${id}"]`);

  it('renders every section as a native <details> with a <summary>, nested as the tree is', () => {
    const el = mount();
    const learning = folder(el, 'learning');
    expect(learning?.querySelector(':scope > summary')?.textContent).toContain('Learning');
    const keys = learning?.querySelector<HTMLDetailsElement>(':scope > details[data-section="learning/keys"]');
    expect(keys?.querySelector(':scope > summary')?.textContent).toContain('Keys');
    const cMajor = keys?.querySelector<HTMLDetailsElement>(':scope > details[data-section="learning/keys/c-major"]');
    expect(cMajor?.querySelector(':scope > summary')?.textContent).toContain('C major');
    expect(cMajor?.querySelectorAll(':scope > ul.library-items > li.library-item')).toHaveLength(5);
    expect(folder(el, 'repertoire/beginner')?.parentElement).toBe(folder(el, 'repertoire'));
  });

  it('orders siblings by their order', () => {
    const el = mount();
    const titles = Array.from(el.querySelectorAll('details[data-section="learning/keys"] > details > summary')).map(
      (s) => s.textContent?.trim(),
    );
    expect(titles).toEqual(['C major', 'A minor']);
    const roots = Array.from(el.querySelectorAll(':scope > .library > details.library-section')).map(
      (d) => (d as HTMLElement).dataset.section,
    );
    expect(roots).toEqual(['learning', 'repertoire']);
  });

  it('opens the roots and their children by default, and leaves the key folders closed', () => {
    const el = mount();
    for (const id of ['learning', 'learning/keys', 'learning/key-changes', 'repertoire', 'repertoire/beginner']) {
      expect(folder(el, id)?.open, id).toBe(true);
    }
    for (const id of ['learning/keys/c-major', 'learning/keys/a-minor', 'learning/key-changes/c-major-to-a-minor']) {
      expect(folder(el, id)?.open, id).toBe(false);
    }
  });

  it('shows the relation word of a key-change folder in its summary', () => {
    const el = mount();
    const summary = folder(el, 'learning/key-changes/c-major-to-a-minor')?.querySelector(':scope > summary');
    expect(summary?.textContent).toContain('C major -> A minor');
    expect(summary?.textContent).toContain('relative');
  });

  it('a filter opens every folder with a match and omits the rest', () => {
    libraryState.indexLoaded(treeIndex());
    libraryState.setFilter({ sectionId: null, level: 'introduction', key: null, tag: null, text: '' });
    const el = document.createElement('mx-library');
    document.body.appendChild(el);
    expect(folder(el, 'learning/keys/c-major')?.open).toBe(true);
    expect(folder(el, 'learning/key-changes/c-major-to-a-minor')?.open).toBe(true);
    expect(folder(el, 'learning/keys')?.open).toBe(true);
    // a folder with no introduction item, and the whole repertoire, are left out
    expect(folder(el, 'learning/keys/a-minor')).toBeNull();
    expect(folder(el, 'repertoire')).toBeNull();
    expect(el.querySelectorAll('.library-item')).toHaveLength(2);
  });

  it('a filter with no match shows the no-results line, not empty folders', () => {
    libraryState.indexLoaded(treeIndex());
    libraryState.setFilter({ sectionId: null, level: null, key: null, tag: null, text: 'no such item' });
    const el = document.createElement('mx-library');
    document.body.appendChild(el);
    expect(el.querySelectorAll('details.library-section')).toHaveLength(0);
    expect(el.querySelector('.library-no-results')).not.toBeNull();
  });

  it('a folder the user toggles stays that way across a re-render', () => {
    const el = mount();
    const cMajor = folder(el, 'learning/keys/c-major');
    if (!cMajor) throw new Error('no C major folder');
    cMajor.open = true;
    cMajor.dispatchEvent(new Event('toggle'));
    const repertoire = folder(el, 'repertoire');
    if (!repertoire) throw new Error('no repertoire folder');
    repertoire.open = false;
    repertoire.dispatchEvent(new Event('toggle'));

    // any state change re-renders the panel
    libraryState.setFilter({ sectionId: null, level: null, key: null, tag: null, text: 'x' });
    libraryState.setFilter({ sectionId: null, level: null, key: null, tag: null, text: '' });
    expect(folder(el, 'learning/keys/c-major')?.open).toBe(true);
    expect(folder(el, 'repertoire')?.open).toBe(false);
  });

  it("while a filter is active the user's folder state is left untouched and comes back when the filter clears", () => {
    const el = mount();
    const cMajor = folder(el, 'learning/keys/c-major');
    if (!cMajor) throw new Error('no C major folder');
    cMajor.open = true;
    cMajor.dispatchEvent(new Event('toggle'));

    libraryState.setFilter({ sectionId: null, level: null, key: null, tag: null, text: 'advanced' });
    // the filter opened A minor (a match) but that is not the user's doing
    expect(folder(el, 'learning/keys/a-minor')?.open).toBe(true);
    libraryState.setFilter({ sectionId: null, level: null, key: null, tag: null, text: '' });
    expect(folder(el, 'learning/keys/a-minor')?.open).toBe(false);
    expect(folder(el, 'learning/keys/c-major')?.open).toBe(true);
  });

  it('shows the step before the level chip: "1 Introduction" to "4 Advanced", "Song" for a song', () => {
    const el = mount();
    const stepOf = (id: string) => el.querySelector(`button[data-id="${id}"] .library-item-step`)?.textContent?.trim();
    expect(stepOf('learning/keys/c-major/introduction')).toBe('1 Introduction');
    expect(stepOf('learning/keys/c-major/beginner')).toBe('2 Beginner');
    expect(stepOf('learning/keys/c-major/intermediate')).toBe('3 Intermediate');
    expect(stepOf('learning/keys/c-major/advanced')).toBe('4 Advanced');
    expect(stepOf('learning/keys/c-major/song-x')).toBe('Song');
    // an item with no step shows none
    expect(el.querySelector('button[data-id="repertoire/beginner/ode-to-joy"] .library-item-step')).toBeNull();

    const button = el.querySelector('button[data-id="learning/keys/c-major/introduction"]');
    const step = button?.querySelector('.library-item-step');
    const level = button?.querySelector('.library-item-level');
    expect(step && level && step.compareDocumentPosition(level) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(level?.textContent).toBe('Introduction');
  });

  it('lists the items of a key folder in step order', () => {
    const el = mount();
    const ids = Array.from(
      folder(el, 'learning/keys/c-major')?.querySelectorAll<HTMLButtonElement>('button.library-item-open') ?? [],
    ).map((b) => b.dataset.id);
    expect(ids).toEqual([
      'learning/keys/c-major/introduction',
      'learning/keys/c-major/beginner',
      'learning/keys/c-major/intermediate',
      'learning/keys/c-major/advanced',
      'learning/keys/c-major/song-x',
    ]);
  });

  it('SC-007: a synthetic 200-item index in a 3-level tree renders within the library-port budget', () => {
    const sections: LibraryIndex['sections'] = [{ id: 'l', title: 'L', path: 'l', parent: null, order: 1 }];
    const items: LibraryItem[] = [];
    for (let k = 0; k < 20; k++) {
      sections.push({ id: `l/k${k}`, title: `K${k}`, path: `l/k${k}`, parent: 'l', order: k + 1 });
      for (let j = 0; j < 4; j++) {
        sections.push({ id: `l/k${k}/s${j}`, title: `S${j}`, path: `l/k${k}/s${j}`, parent: `l/k${k}`, order: j + 1 });
        for (let i = 0; i < 2 + (k % 2 === 0 ? 0 : 0); i++)
          items.push(item(`l/k${k}/s${j}/i${i}`, { section: `l/k${k}/s${j}` }));
      }
    }
    while (items.length < 200) items.push(item(`l/extra-${items.length}`, { section: 'l' }));
    libraryState.indexLoaded({ version: 1, generated: '', sections, items });
    const el = document.createElement('mx-library');
    const start = performance.now();
    document.body.appendChild(el);
    const elapsedMs = performance.now() - start;
    expect(el.querySelectorAll('.library-item').length).toBe(items.length);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
