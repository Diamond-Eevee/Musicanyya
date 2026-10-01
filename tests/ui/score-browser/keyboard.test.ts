import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../src/ui/elements/mx-browser-detail.js';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-rail.js';
import '../../../src/ui/elements/mx-score-browser.js';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { itemRefKey } from '../../../src/core/progress/types.js';
import { BROWSER_ANNOUNCE_DEBOUNCE_MS, UNDO_WINDOW_MS } from '../../../src/engine/config.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { libraryIndexOf, userFile } from '../../fakes/progress-builders.js';

const key = (target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

function loadIndex(
  itemCount: number,
  files = [] as ReturnType<typeof userFile>[],
  adjust: (index: LibraryIndex) => LibraryIndex = (index) => index,
): void {
  browserState.open();
  browserState.indexLoaded(adjust(libraryIndexOf(itemCount)), files, []);
}

/** `libraryIndexOf` makes every item beginner; the fifth (Key 1's first) becomes advanced, so a level filter has
 *  something to keep and something to drop. */
function withOneAdvanced(index: LibraryIndex): LibraryIndex {
  return {
    ...index,
    items: index.items.map((item, i) => (i === 4 ? { ...item, meta: { ...item.meta, level: 'advanced' } } : item)),
  };
}

const labelOf = (el: Element | null) => el?.querySelector('.browser-rail-label')?.textContent?.trim();

describe('mx-browser-rail keyboard model (T080, FR-028, WAI-ARIA tree pattern)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function mountRail(): HTMLElement {
    loadIndex(8); // Learning > Keys > Key 0, Key 1
    // 018: the rail starts collapsed; these tests walk the whole tree, so every folder is opened first.
    browserState.setView({ expanded: ['learning', 'learning/keys'] });
    const rail = document.createElement('mx-browser-rail');
    document.body.appendChild(rail);
    return rail;
  }
  const treeitem = (rail: HTMLElement, label: string) =>
    Array.from(rail.querySelectorAll('[role="treeitem"]')).find((i) => labelOf(i) === label) as HTMLElement;
  const focused = (rail: HTMLElement) => labelOf(rail.contains(document.activeElement) ? document.activeElement : null);

  it('has exactly one tab stop (roving tabindex): the focused folder, the selected one to begin with', () => {
    const rail = mountRail();
    const stops = Array.from(rail.querySelectorAll('[role="treeitem"]')).filter(
      (i) => i.getAttribute('tabindex') === '0',
    );
    expect(stops.map(labelOf)).toEqual(['Continue']);

    treeitem(rail, 'Continue').focus();
    key(document.activeElement as Element, 'ArrowDown');

    expect(focused(rail)).toBe('All');
    expect(Array.from(rail.querySelectorAll('[role="treeitem"][tabindex="0"]')).map(labelOf)).toEqual(['All']);
  });

  it('Up and Down move focus to the previous or next visible folder without selecting it', () => {
    const rail = mountRail();
    treeitem(rail, 'Continue').focus();

    key(document.activeElement as Element, 'ArrowDown');
    key(document.activeElement as Element, 'ArrowDown');
    expect(focused(rail)).toBe('Learning');
    expect(browserState.get().view.folder).toEqual({ kind: 'continue' }); // moving is not choosing

    key(document.activeElement as Element, 'ArrowUp');
    expect(focused(rail)).toBe('All');
    key(document.activeElement as Element, 'ArrowUp');
    key(document.activeElement as Element, 'ArrowUp'); // already at the first
    expect(focused(rail)).toBe('Continue');
  });

  it('Home and End go to the first and last visible folder', () => {
    const rail = mountRail();
    treeitem(rail, 'Continue').focus();
    key(document.activeElement as Element, 'End');
    expect(focused(rail)).toBe('My files');
    key(document.activeElement as Element, 'Home');
    expect(focused(rail)).toBe('Continue');
  });

  it('Enter and Space select the focused folder; the list updates and focus stays on it', () => {
    const rail = mountRail();
    treeitem(rail, 'Continue').focus();
    key(document.activeElement as Element, 'ArrowDown'); // All
    key(document.activeElement as Element, 'ArrowDown'); // Learning

    key(document.activeElement as Element, 'Enter');
    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'learning' });
    // the rail re-rendered for the new selection; the musician's place in it did not change
    expect(focused(rail)).toBe('Learning');
    expect(treeitem(rail, 'Learning').getAttribute('aria-selected')).toBe('true');

    key(document.activeElement as Element, 'ArrowUp'); // All
    const space = key(document.activeElement as Element, ' ');
    expect(space.defaultPrevented).toBe(true);
    expect(browserState.get().view.folder).toEqual({ kind: 'all' });
    expect(focused(rail)).toBe('All');
  });

  it('Left closes an open folder, then moves to its parent; Right opens a closed one, then moves to its first child', () => {
    const rail = mountRail();
    const learning = treeitem(rail, 'Learning');
    expect(learning.getAttribute('aria-expanded')).toBe('true'); // opened by mountRail
    learning.focus();

    key(document.activeElement as Element, 'ArrowRight'); // open: to the first child
    expect(focused(rail)).toBe('Keys');

    key(document.activeElement as Element, 'ArrowLeft'); // Keys is open: closes it
    expect(treeitem(rail, 'Keys').getAttribute('aria-expanded')).toBe('false');
    expect(treeitem(rail, 'Key 0')).toBeUndefined(); // its folders are no longer visible
    expect(focused(rail)).toBe('Keys');

    key(document.activeElement as Element, 'ArrowDown'); // the next visible folder is not a hidden child
    expect(focused(rail)).toBe('My files');
    key(document.activeElement as Element, 'ArrowUp');

    key(document.activeElement as Element, 'ArrowLeft'); // already closed: to the parent
    expect(focused(rail)).toBe('Learning');

    key(document.activeElement as Element, 'ArrowRight');
    expect(focused(rail)).toBe('Keys');
    key(document.activeElement as Element, 'ArrowRight'); // closed: opens it, focus stays
    expect(treeitem(rail, 'Keys').getAttribute('aria-expanded')).toBe('true');
    expect(treeitem(rail, 'Key 0')).toBeDefined();
    expect(focused(rail)).toBe('Keys');
    key(document.activeElement as Element, 'ArrowRight'); // open: to the first child
    expect(focused(rail)).toBe('Key 0');

    key(document.activeElement as Element, 'ArrowRight'); // a folder with no sub-folders: nothing to open
    expect(focused(rail)).toBe('Key 0');
    key(document.activeElement as Element, 'ArrowLeft'); // and Left goes to the parent
    expect(focused(rail)).toBe('Keys');
  });

  it('every folder announces its depth (aria-level) so a screen reader can say where it is', () => {
    const rail = mountRail();
    expect(treeitem(rail, 'Continue').getAttribute('aria-level')).toBe('1');
    expect(treeitem(rail, 'Learning').getAttribute('aria-level')).toBe('1');
    expect(treeitem(rail, 'Keys').getAttribute('aria-level')).toBe('2');
    expect(treeitem(rail, 'Key 0').getAttribute('aria-level')).toBe('3');
  });
});

describe('mx-browser-list keyboard model (T080, FR-028)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
  });

  function mountListAndDetail() {
    loadIndex(25);
    browserState.setView({ folder: { kind: 'all' } });
    const list = document.createElement('mx-browser-list');
    const detail = document.createElement('mx-browser-detail');
    document.body.append(list, detail);
    const refs = () => Array.from(list.querySelectorAll('.browser-row')).map((r) => r.getAttribute('data-ref'));
    const selectedKey = () => {
      const selected = browserState.get().view.selected;
      return selected === null ? null : itemRefKey(selected);
    };
    return { list, detail, refs, selectedKey };
  }

  it('Up and Down move the active row and the selection follows; the detail pane shows the selected item', () => {
    const { list, detail, refs, selectedKey } = mountListAndDetail();
    list.focus();

    key(list, 'ArrowDown');
    key(list, 'ArrowDown');
    expect(selectedKey()).toBe(refs()[2]);
    expect(list.getAttribute('aria-activedescendant')).toBe('browser-row-2');
    expect(detail.textContent).toContain(refs()[2]?.replace('library:', '') ?? 'missing');

    key(list, 'ArrowUp');
    expect(selectedKey()).toBe(refs()[1]);
    key(list, 'ArrowUp');
    key(list, 'ArrowUp'); // at the top: stays
    expect(selectedKey()).toBe(refs()[0]);
  });

  it('Home and End go to the first and last row', () => {
    const { list, refs, selectedKey } = mountListAndDetail();
    list.focus();
    key(list, 'End');
    expect(selectedKey()).toBe(refs().at(-1));
    key(list, 'Home');
    expect(selectedKey()).toBe(refs()[0]);
  });

  it('PageDown and PageUp move ten rows at a time and stop at the ends', () => {
    const { list, refs, selectedKey } = mountListAndDetail();
    list.focus();
    key(list, 'Home');
    key(list, 'PageDown');
    expect(selectedKey()).toBe(refs()[10]);
    key(list, 'PageDown');
    expect(selectedKey()).toBe(refs()[20]);
    key(list, 'PageDown');
    expect(selectedKey()).toBe(refs()[24]);
    key(list, 'PageUp');
    expect(selectedKey()).toBe(refs()[14]);
    key(list, 'PageUp');
    key(list, 'PageUp');
    expect(selectedKey()).toBe(refs()[0]);
  });

  it('the navigation keys do not scroll the page: each one is handled', () => {
    const { list } = mountListAndDetail();
    list.focus();
    for (const name of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) {
      expect(key(list, name).defaultPrevented).toBe(true);
    }
  });

  it('Enter opens the active row', () => {
    const { list, refs } = mountListAndDetail();
    list.focus();
    key(list, 'ArrowDown');
    const opened: unknown[] = [];
    list.addEventListener('browseropenitem', (e) => opened.push((e as CustomEvent).detail.ref));
    key(list, 'Enter');
    expect(opened.map((r) => itemRefKey(r as never))).toEqual([refs()[1]]);
  });
});

describe('mx-score-browser keyboard model (T080, FR-028)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    browserState.reset();
  });

  function mountBrowser(
    itemCount = 6,
    files = [] as ReturnType<typeof userFile>[],
    adjust?: (index: LibraryIndex) => LibraryIndex,
  ) {
    const el = document.createElement('mx-score-browser');
    document.body.appendChild(el);
    el.querySelector('.browser-body')?.append(
      document.createElement('mx-browser-rail'),
      document.createElement('mx-browser-list'),
      document.createElement('mx-browser-detail'),
    );
    loadIndex(itemCount, files, adjust);
    browserState.setView({ folder: { kind: 'all' } });
    const search = el.querySelector('.browser-search') as HTMLInputElement;
    const status = el.querySelector('.browser-status') as HTMLElement;
    return { el, search, status };
  }

  it('/ focuses the search field from anywhere in the browser, but not while typing in a field', () => {
    const { el, search } = mountBrowser();
    const list = el.querySelector('mx-browser-list') as HTMLElement;
    list.focus();

    const fromList = key(list, '/');
    expect(fromList.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search);

    // in the search field itself it is an ordinary character
    const typed = key(search, '/');
    expect(typed.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(search);

    // and so it is in a filter control
    const level = el.querySelector('select[data-filter="level"]') as HTMLSelectElement;
    level.focus();
    expect(key(level, '/').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(level);
  });

  it('Escape clears a non-empty search and keeps the browser open; the next Escape closes it', () => {
    const { el, search } = mountBrowser();
    const dialog = el.querySelector('dialog') as HTMLDialogElement;
    browserState.setView({ search: 'piece' });
    search.value = 'piece';
    search.focus();

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(browserState.get().view.search).toBe('');
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(search); // focus stays
    // the field itself is emptied, not only the stored view: a browser that does not clear a search field on Escape
    // by itself (WebKit) would otherwise keep showing text the list no longer filters by
    expect(search.value).toBe('');

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog.open).toBe(false);
  });

  it('Tab order runs search, filters, sort, rail, list, detail, close', () => {
    const { el } = mountBrowser();
    browserState.setView({ selected: { kind: 'library', id: 'learning/keys/key-0/introduction' } });

    const groupOf = (node: Element): string | null => {
      if (node.matches('.browser-search')) return 'search';
      if (node.matches('[data-filter]')) return 'filters';
      if (node.matches('[data-sort]')) return 'sort';
      if (node.closest('mx-browser-rail')) return 'rail';
      if (node.matches('mx-browser-list')) return 'list';
      if (node.closest('mx-browser-detail')) return 'detail';
      if (node.matches('.browser-close')) return 'close';
      return null; // Open file..., and the folder picker / Back buttons that CSS shows only at some widths
    };
    const tabbable = Array.from(el.querySelectorAll('input, select, button, [tabindex]')).filter(
      (node) =>
        node.getAttribute('tabindex') !== '-1' &&
        node.getAttribute('type') !== 'file' &&
        !node.hasAttribute('hidden') &&
        !node.closest('[hidden]') &&
        !(node as HTMLButtonElement).disabled,
    );
    const order: string[] = [];
    for (const node of tabbable) {
      const group = groupOf(node);
      if (group !== null && order.at(-1) !== group) order.push(group);
    }
    expect(order).toEqual(['search', 'filters', 'sort', 'rail', 'list', 'detail', 'close']);
  });

  it('Tab from the last control goes back to search and Shift+Tab from search to the last: the order is cyclic', () => {
    const { el, search } = mountBrowser();
    const close = el.querySelector('.browser-close') as HTMLButtonElement;

    close.focus();
    const forward = key(close, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search);

    const backward = key(search, 'Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    // anywhere else Tab is left to the browser
    const level = el.querySelector('select[data-filter="level"]') as HTMLSelectElement;
    expect(key(level, 'Tab').defaultPrevented).toBe(false);
    expect(key(search, 'Tab').defaultPrevented).toBe(false);
  });

  describe('the aria-live line', () => {
    it('is polite and announces the item count after the debounce, not on every keystroke', () => {
      const { search, status, el } = mountBrowser();
      expect(el.querySelector('.browser-status')?.getAttribute('aria-live')).toBe('polite');
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS);
      expect(status.textContent).toBe('6 items');

      browserState.setView({ search: 'key 0' });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS - 1);
      expect(status.textContent).toBe('6 items'); // still the old text: nothing announced yet
      vi.advanceTimersByTime(1);
      expect(status.textContent).toBe('4 items');

      // typing on: every change inside the window restarts it, so only the last count is spoken
      browserState.setView({ search: 'key 0 intro' });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS - 100);
      browserState.setView({ search: 'key 0 introduction' });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS - 1);
      expect(status.textContent).toBe('4 items');
      vi.advanceTimersByTime(1);
      expect(status.textContent).toBe('1 item');
      expect(search).toBeDefined();
    });

    it('announces a folder change and a filter change too', () => {
      const { status } = mountBrowser(6, [], withOneAdvanced);
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS);
      browserState.setView({ folder: { kind: 'section', id: 'learning/keys/key-1' } });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS);
      expect(status.textContent).toBe('2 items');

      browserState.setView({ filters: { level: 'advanced', key: null, tag: null, status: null } });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS);
      expect(status.textContent).toBe('1 item');
    });

    it('says so when nothing matches (US5 #2)', () => {
      const { status } = mountBrowser();
      browserState.setView({ filters: { level: 'introduction', key: 'F# minor', tag: null, status: null } });
      vi.advanceTimersByTime(BROWSER_ANNOUNCE_DEBOUNCE_MS);
      expect(status.textContent).toBe('No items match these filters.');
    });

    it('T097: announces a new best once, when the browser next opens on that item (contracts §6)', () => {
      const index = libraryIndexOf(6);
      const item = index.items[0];
      if (!item) throw new Error('fixture');
      const el = document.createElement('mx-score-browser');
      document.body.appendChild(el);
      const status = el.querySelector('.browser-status') as HTMLElement;

      // A run finished while the browser was closed and was a new best of this item.
      browserState.setNewBest(item.hash);
      expect(status.textContent).toBe(''); // closed: nothing is announced yet
      browserState.open();
      browserState.indexLoaded(index, [], []);

      expect(status.textContent).toBe(`New best for ${item.meta.title}`);
      expect(browserState.get().newBestScoreKey).toBeNull(); // said once

      browserState.close();
      status.textContent = '';
      browserState.open();
      browserState.indexLoaded(index, [], []);
      expect(status.textContent).not.toContain('New best');
    });

    it('T097: a new best of an item that is not in the library or My files is dropped, not announced', () => {
      const index = libraryIndexOf(6);
      const el = document.createElement('mx-score-browser');
      document.body.appendChild(el);
      const status = el.querySelector('.browser-status') as HTMLElement;
      browserState.setNewBest('f'.repeat(64));
      browserState.open();
      browserState.indexLoaded(index, [], []);
      expect(status.textContent).not.toContain('New best');
      expect(browserState.get().newBestScoreKey).toBeNull();
    });

    it('announces a removal and a reset at once, with the undo window in seconds', () => {
      const file = userFile({ fileName: 'Etude.musicxml', title: 'Etude in E' });
      const { status } = mountBrowser(6, [file]);
      browserState.setPending({
        kind: 'removeFile',
        fileKey: file.fileKey,
        keepProgress: true,
        deadline: Date.now() + UNDO_WINDOW_MS,
      });
      expect(status.textContent).toBe(
        `Etude in E removed from My files. Undo available for ${UNDO_WINDOW_MS / 1000} seconds.`,
      );

      browserState.clearPending();
      browserState.setPending({
        kind: 'reset',
        ref: { kind: 'library', id: 'learning/keys/key-0/introduction' },
        deadline: Date.now() + UNDO_WINDOW_MS,
      });
      expect(status.textContent).toBe('Progress of learning/keys/key-0/introduction reset.');
    });
  });
});
