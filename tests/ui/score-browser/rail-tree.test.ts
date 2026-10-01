import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-browser-list.js';
import '../../../src/ui/elements/mx-browser-rail.js';
import { browserState } from '../../../src/ui/state/browserState.js';
import { libraryIndexOf } from '../../fakes/progress-builders.js';

/** 018 T009 (US1, US2): the rail's disclosure control and its remembered open/closed state. The fixture is
 *  `Learning > Keys > Key 0, Key 1` (eight items), plus Continue, All and My files. */

const ITEM = { kind: 'library', id: 'learning/keys/key-0/introduction' } as const;
const BOTH_OPEN = ['learning', 'learning/keys'];

function setup(view: Parameters<typeof browserState.setView>[0] = {}): { rail: HTMLElement; list: HTMLElement } {
  browserState.open();
  browserState.indexLoaded(libraryIndexOf(8), [], []);
  browserState.setView(view);
  const rail = document.createElement('mx-browser-rail');
  const list = document.createElement('mx-browser-list');
  document.body.append(rail, list);
  return { rail, list };
}

const labelText = (item: Element | null) => item?.querySelector('.browser-rail-label')?.firstChild?.textContent?.trim();
const items = (rail: HTMLElement) => Array.from(rail.querySelectorAll<HTMLElement>('[role="treeitem"]'));
const treeitem = (rail: HTMLElement, label: string) => items(rail).find((i) => labelText(i) === label);
const labels = (rail: HTMLElement) => items(rail).map(labelText);
const toggleOf = (rail: HTMLElement, label: string) =>
  treeitem(rail, label)?.querySelector<HTMLElement>('.browser-rail-toggle');
const rowRefs = (list: HTMLElement) =>
  Array.from(list.querySelectorAll('.browser-row')).map((r) => r.getAttribute('data-ref'));
const key = (target: Element, name: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe('mx-browser-rail disclosure control (018 US1, US2)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    browserState.reset();
    localStorage.removeItem('musicanyya.browser.v1');
  });

  it('1. a click on the toggle of an expanded folder collapses it and leaves folder, selection and list alone (US1 #1, FR-002, SC-005)', () => {
    const { rail, list } = setup({ folder: { kind: 'all' }, selected: ITEM, expanded: BOTH_OPEN });
    expect(labels(rail)).toContain('Key 0');
    const rowsBefore = rowRefs(list);
    expect(rowsBefore.length).toBeGreaterThan(0);

    toggleOf(rail, 'Keys')?.click();

    expect(treeitem(rail, 'Keys')?.getAttribute('aria-expanded')).toBe('false');
    expect(labels(rail)).not.toContain('Key 0');
    expect(labels(rail)).not.toContain('Key 1');
    expect(browserState.get().view.folder).toEqual({ kind: 'all' });
    expect(browserState.get().view.selected).toEqual(ITEM);
    expect(rowRefs(list)).toEqual(rowsBefore);
  });

  it('2. a second click restores the descendants with their own previous states (US1 #2, FR-005)', () => {
    const { rail } = setup({ expanded: BOTH_OPEN });

    toggleOf(rail, 'Learning')?.click(); // closes Learning; Keys stays open underneath
    expect(labels(rail)).toEqual(['Continue', 'All', 'Learning', 'My files']);
    expect(browserState.get().view.expanded).toEqual(['learning/keys']);

    toggleOf(rail, 'Learning')?.click();
    expect(labels(rail)).toEqual(['Continue', 'All', 'Learning', 'Keys', 'Key 0', 'Key 1', 'My files']);
    expect(treeitem(rail, 'Keys')?.getAttribute('aria-expanded')).toBe('true');
    expect(browserState.get().view.expanded).toEqual(BOTH_OPEN);
  });

  it('3. a click on the name of a collapsed folder chooses it and expands it (US1 #3, FR-003)', () => {
    const { rail } = setup();
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('false');

    treeitem(rail, 'Learning')?.querySelector<HTMLElement>('.browser-rail-label')?.click();

    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'learning' });
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('true');
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-selected')).toBe('true');
    expect(browserState.get().view.expanded).toEqual(['learning']);
  });

  it('4. a click on the name of an expanded folder chooses it and it stays expanded (US1 #4)', () => {
    const { rail } = setup({ expanded: BOTH_OPEN });
    expect(toggleOf(rail, 'Keys')).toBeTruthy(); // it has a toggle, and the name click must not use it to collapse

    treeitem(rail, 'Keys')?.querySelector<HTMLElement>('.browser-rail-label')?.click();

    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'learning/keys' });
    expect(treeitem(rail, 'Keys')?.getAttribute('aria-expanded')).toBe('true');
    expect(browserState.get().view.expanded).toEqual(BOTH_OPEN);
  });

  it('5. collapsing the parent of the chosen folder keeps the list and marks that parent (US1 #5, FR-006)', () => {
    const { rail, list } = setup({ folder: { kind: 'section', id: 'learning/keys/key-0' }, expanded: BOTH_OPEN });
    const rowsBefore = rowRefs(list);
    expect(rowsBefore.length).toBeGreaterThan(0);
    expect(rail.querySelector('[data-contains-selected]')).toBeNull(); // the chosen folder is visible: no marker

    toggleOf(rail, 'Learning')?.click();

    const learning = treeitem(rail, 'Learning');
    expect(learning?.hasAttribute('data-contains-selected')).toBe(true);
    expect(learning?.querySelector('.visually-hidden')?.textContent).toContain('contains the chosen folder');
    expect(learning?.getAttribute('aria-selected')).toBe('false');
    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'learning/keys/key-0' });
    expect(rowRefs(list)).toEqual(rowsBefore);
    expect(rail.querySelectorAll('[data-contains-selected]')).toHaveLength(1);
  });

  it('6. Right expands a collapsed folder, Left collapses it, Enter chooses and expands it (US1 #6, FR-004)', () => {
    const { rail } = setup();
    treeitem(rail, 'Learning')?.focus();

    key(document.activeElement as Element, 'ArrowRight');
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('true');
    expect(browserState.get().view.expanded).toEqual(['learning']);

    key(document.activeElement as Element, 'ArrowLeft');
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('false');
    expect(browserState.get().view.expanded).toEqual([]);

    key(document.activeElement as Element, 'Enter');
    expect(browserState.get().view.folder).toEqual({ kind: 'section', id: 'learning' });
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('true');
    expect(browserState.get().view.expanded).toEqual(['learning']);
  });

  it('7. only folders with sub-folders have a toggle and aria-expanded (US1 #7, FR-001, FR-017)', () => {
    const { rail } = setup({ expanded: BOTH_OPEN });

    for (const label of ['Continue', 'All', 'My files', 'Key 0', 'Key 1']) {
      const item = treeitem(rail, label);
      expect(item, label).toBeDefined();
      expect(item?.querySelector('.browser-rail-toggle'), label).toBeNull();
      expect(item?.querySelector('.browser-rail-toggle-space'), label).toBeTruthy(); // keeps the labels aligned
      expect(item?.hasAttribute('aria-expanded'), label).toBe(false);
    }
    for (const label of ['Learning', 'Keys']) {
      expect(toggleOf(rail, label), label).toBeTruthy();
      expect(treeitem(rail, label)?.hasAttribute('aria-expanded'), label).toBe(true);
    }
  });

  it('8. each toggle dispatches browserviewchange with the new expanded list', () => {
    const { rail } = setup();
    const seen: unknown[] = [];
    rail.addEventListener('browserviewchange', (e) => seen.push((e as CustomEvent).detail));

    toggleOf(rail, 'Learning')?.click();
    toggleOf(rail, 'Learning')?.click();

    expect(seen).toEqual([{ view: { expanded: ['learning'] } }, { view: { expanded: [] } }]);
  });

  it('9. with view.expanded empty the rail shows only the top-level entries (US2 #1, FR-007)', () => {
    const { rail } = setup();
    expect(labels(rail)).toEqual(['Continue', 'All', 'Learning', 'My files']);
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('10. two quick clicks on the same toggle leave the folder as it was, and the rail follows view.expanded after each (edge case)', () => {
    const { rail } = setup();
    const rendered = () => labels(rail).includes('Keys');

    toggleOf(rail, 'Learning')?.click();
    expect(browserState.get().view.expanded).toEqual(['learning']);
    expect(rendered()).toBe(true);

    toggleOf(rail, 'Learning')?.click();
    expect(browserState.get().view.expanded).toEqual([]);
    expect(rendered()).toBe(false);
    expect(treeitem(rail, 'Learning')?.getAttribute('aria-expanded')).toBe('false');
  });
});
