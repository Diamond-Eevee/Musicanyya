import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-rail.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { libraryIndexOf } from '../../fakes/progress-builders.js';

/** 018 T015 (R-8, FR-010): a restored selection is scrolled into view once - the row in the list, the chosen folder
 *  in the rail - without moving focus. The store raises `revealSelection`; the list lowers it again. */
const INTRO = { kind: 'library', id: 'learning/keys/key-0/introduction' } as const;
const FOLDER = { kind: 'section', id: 'learning/keys/key-0' } as const;

interface ScrollCall {
  element: HTMLElement;
  options: unknown;
}

describe('scrolling the restored selection into view (018 US3, R-8)', () => {
  const calls: ScrollCall[] = [];
  const original = Element.prototype.scrollIntoView;

  beforeEach(() => {
    calls.length = 0;
    Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
      calls.push({ element: this as HTMLElement, options });
    };
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    document.body.innerHTML = '';
    browserState.reset();
    localStorage.removeItem('musicanyya.browser.v1');
  });

  function mount() {
    const rail = document.createElement('mx-browser-rail');
    const list = document.createElement('mx-browser-list');
    document.body.append(rail, list);
    return { rail, list };
  }
  /** The state a restore finds: the chosen folder and selection (with the path open), and the next index load coming. */
  function restore(selected: typeof INTRO | null) {
    browserState.open();
    browserState.indexLoaded(libraryIndexOf(8), [], []);
    browserState.setView({ folder: FOLDER, selected, expanded: ['learning', 'learning/keys'] });
    browserState.startRefresh();
  }

  it('the list scrolls the selected row into view once, and clears the request', async () => {
    restore(INTRO);
    const { list } = mount();
    browserState.indexLoaded(libraryIndexOf(8), [], []);
    expect(browserState.get().revealSelection).toBe(true);
    await Promise.resolve(); // the list lowers the flag after both elements have drawn

    const rowCalls = calls.filter((c) => list.contains(c.element));
    expect(rowCalls).toHaveLength(1);
    expect(rowCalls[0]?.element.getAttribute('data-ref')).toBe('library:learning/keys/key-0/introduction');
    expect(rowCalls[0]?.options).toEqual({ block: 'nearest' });
    expect(browserState.get().revealSelection).toBe(false);
  });

  it('the rail scrolls the chosen folder into view', async () => {
    restore(INTRO);
    const { rail } = mount();
    browserState.indexLoaded(libraryIndexOf(8), [], []);
    await Promise.resolve();

    const folderCalls = calls.filter((c) => rail.contains(c.element));
    expect(folderCalls).toHaveLength(1);
    expect(folderCalls[0]?.element.getAttribute('data-key')).toBe('section:learning/keys/key-0');
    expect(folderCalls[0]?.options).toEqual({ block: 'nearest' });
  });

  it('does not scroll again on later updates, and not at all without a restored selection', async () => {
    restore(INTRO);
    mount();
    browserState.indexLoaded(libraryIndexOf(8), [], []);
    await Promise.resolve();
    const afterLoad = calls.length;

    browserState.setView({ search: 'intro' });
    browserState.setView({ search: '' });
    expect(calls).toHaveLength(afterLoad);

    calls.length = 0;
    browserState.close();
    browserState.reset();
    restore(null);
    mount();
    browserState.indexLoaded(libraryIndexOf(8), [], []);
    await Promise.resolve();
    expect(calls).toHaveLength(0);
  });

  it('does not move focus', async () => {
    restore(INTRO);
    const { list } = mount();
    const field = document.createElement('input');
    document.body.prepend(field);
    field.focus();

    browserState.indexLoaded(libraryIndexOf(8), [], []);
    await Promise.resolve();

    expect(document.activeElement).toBe(field);
    expect(list.contains(document.activeElement)).toBe(false);
  });
});
