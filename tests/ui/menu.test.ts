import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-menu.js';
import '../../src/ui/elements/mx-panel.js';
import { MENU_GROUPS, type MenuId, menuGroup } from '../../src/ui/layout/menu-model.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { scoreState } from '../../src/ui/state/scoreState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { PANEL_IDS, viewState } from '../../src/ui/state/viewState.js';

function makeMenu(id: MenuId): HTMLElement {
  const menu = document.createElement('mx-menu');
  menu.setAttribute('menu', id);
  document.body.appendChild(menu);
  return menu;
}

const trigger = (menu: HTMLElement) => menu.shadowRoot?.querySelector('button[aria-haspopup]') as HTMLButtonElement;
const items = (menu: HTMLElement) =>
  Array.from(menu.shadowRoot?.querySelectorAll('[role="menuitem"]') ?? []) as HTMLButtonElement[];
const focused = (menu: HTMLElement) => menu.shadowRoot?.activeElement as HTMLElement | null;
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));

/** `data-model.md` section 5 and `ui-shell.md` sections 4 and 6. */
describe('menu model', () => {
  it('matches the four menus of data-model.md section 5', () => {
    expect(MENU_GROUPS.map((group) => group.id)).toEqual(['score', 'setup', 'view', 'help']);
    expect(menuGroup('score').entries.map((entry) => entry.panel)).toEqual(['scores', 'attempts']);
    expect(menuGroup('setup').entries.map((entry) => entry.panel)).toEqual(['setup', 'midi', 'latency']);
    expect(menuGroup('view').entries.map((entry) => entry.panel)).toEqual(['view']);
    expect(menuGroup('help').entries.map((entry) => entry.panel)).toEqual(['help', 'diagnostics', 'environment']);
  });

  it('reaches every panel that a person opens by hand from exactly one entry (grade is opened by a run)', () => {
    const reachable = MENU_GROUPS.flatMap((group) => group.entries.map((entry) => entry.panel)).sort();
    expect(reachable).toEqual(PANEL_IDS.filter((id) => id !== 'grade').sort());
    expect(new Set(reachable).size).toBe(reachable.length);
  });

  it('gives every menu and entry a non-empty label', () => {
    for (const group of MENU_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      for (const entry of group.entries) expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe('mx-menu', () => {
  beforeEach(() => {
    viewState.closePanel();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.closePanel();
    vi.restoreAllMocks();
  });

  it('renders the entries of its own menu group, in order', () => {
    const menu = makeMenu('help');
    expect(trigger(menu).textContent?.trim()).toBe(menuGroup('help').label);
    expect(items(menu).map((item) => item.dataset.panel)).toEqual(['help', 'diagnostics', 'environment']);
    expect(items(menu).map((item) => item.textContent?.trim())).toEqual(menuGroup('help').entries.map((e) => e.label));
  });

  it('exposes menu semantics and starts closed', () => {
    const menu = makeMenu('setup');
    expect(trigger(menu).getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger(menu).getAttribute('aria-expanded')).toBe('false');
    expect(menu.shadowRoot?.querySelector<HTMLElement>('[role="menu"]')?.hidden).toBe(true);
    expect(items(menu).every((item) => item.getAttribute('role') === 'menuitem')).toBe(true);
  });

  it('opens on click and moves focus to the first entry', () => {
    const menu = makeMenu('help');
    trigger(menu).click();
    expect(trigger(menu).getAttribute('aria-expanded')).toBe('true');
    expect(menu.shadowRoot?.querySelector<HTMLElement>('[role="menu"]')?.hidden).toBe(false);
    expect(focused(menu)).toBe(items(menu)[0]);
  });

  it('activating an entry opens exactly that panel and closes the menu', () => {
    const menu = makeMenu('help');
    trigger(menu).click();
    (items(menu)[1] as HTMLButtonElement).click();
    expect(viewState.get().openPanel).toBe('diagnostics');
    expect(trigger(menu).getAttribute('aria-expanded')).toBe('false');
  });

  it('activating a different entry replaces the open panel (FR-004)', () => {
    const menu = makeMenu('help');
    trigger(menu).click();
    items(menu)[0]?.click();
    trigger(menu).click();
    items(menu)[2]?.click();
    expect(viewState.get().openPanel).toBe('environment');
  });

  describe('keyboard', () => {
    it('ArrowDown / ArrowUp move through the entries and wrap around', () => {
      const menu = makeMenu('help');
      trigger(menu).click();
      const list = items(menu);
      press(list[0] as Element, 'ArrowDown');
      expect(focused(menu)).toBe(list[1]);
      press(list[1] as Element, 'ArrowDown');
      expect(focused(menu)).toBe(list[2]);
      press(list[2] as Element, 'ArrowDown');
      expect(focused(menu)).toBe(list[0]);
      press(list[0] as Element, 'ArrowUp');
      expect(focused(menu)).toBe(list[2]);
    });

    it('Home and End jump to the first and last entry', () => {
      const menu = makeMenu('help');
      trigger(menu).click();
      const list = items(menu);
      press(list[0] as Element, 'End');
      expect(focused(menu)).toBe(list[2]);
      press(list[2] as Element, 'Home');
      expect(focused(menu)).toBe(list[0]);
    });

    it('ArrowDown on the closed trigger opens the menu on its first entry', () => {
      const menu = makeMenu('help');
      press(trigger(menu), 'ArrowDown');
      expect(trigger(menu).getAttribute('aria-expanded')).toBe('true');
      expect(focused(menu)).toBe(items(menu)[0]);
    });

    it('Escape closes the menu, returns focus to its button and does not stop the transport', () => {
      initShortcuts();
      const stop = vi.spyOn(transportState, 'stop');
      const menu = makeMenu('help');
      trigger(menu).click();
      press(items(menu)[1] as Element, 'Escape');

      expect(trigger(menu).getAttribute('aria-expanded')).toBe('false');
      expect(focused(menu)).toBe(trigger(menu));
      expect(stop).not.toHaveBeenCalled();
    });

    it('Tab leaves the menu closed behind it', () => {
      const menu = makeMenu('help');
      trigger(menu).click();
      press(items(menu)[0] as Element, 'Tab');
      expect(trigger(menu).getAttribute('aria-expanded')).toBe('false');
    });

    it('a click outside closes the menu', () => {
      const menu = makeMenu('help');
      trigger(menu).click();
      document.body.click();
      expect(trigger(menu).getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('focus return (FR-005)', () => {
    it('closing the panel that a menu entry opened puts focus back on that menu button', () => {
      const menu = makeMenu('help');
      const panel = document.createElement('mx-panel');
      panel.dataset.panel = 'diagnostics';
      panel.setAttribute('heading', 'Diagnostics');
      document.body.appendChild(panel);

      trigger(menu).click();
      items(menu)[1]?.click();
      expect(viewState.get().openPanel).toBe('diagnostics');
      viewState.closePanel();

      expect(document.activeElement).toBe(menu);
      expect(focused(menu)).toBe(trigger(menu));
    });
  });

  describe('entries that cannot apply are disabled, not hidden (no Score loaded)', () => {
    it('keeps every entry in the list, and disables the ones that need a Score', () => {
      const menu = makeMenu('score');
      expect(items(menu)).toHaveLength(2);
      const attempts = items(menu).find((item) => item.dataset.panel === 'attempts');
      const scores = items(menu).find((item) => item.dataset.panel === 'scores');
      expect(attempts?.disabled).toBe(true);
      expect(attempts?.getAttribute('aria-disabled')).toBe('true');
      expect(scores?.disabled).toBe(false);
    });

    it('a disabled entry opens nothing', () => {
      const menu = makeMenu('setup');
      trigger(menu).click();
      const setup = items(menu).find((item) => item.dataset.panel === 'setup');
      expect(setup?.disabled).toBe(true);
      setup?.click();
      expect(viewState.get().openPanel).toBeNull();
    });

    it('the setup menu still offers MIDI and latency without a Score', () => {
      const menu = makeMenu('setup');
      const enabled = items(menu)
        .filter((item) => !item.disabled)
        .map((item) => item.dataset.panel);
      expect(enabled).toEqual(['midi', 'latency']);
    });

    // Last on purpose: scoreState has no way back to "empty" once a Score has loaded.
    it('enables them all once a Score is loaded, without re-creating the menu', () => {
      const menu = makeMenu('score');
      scoreState.succeeded({
        fileName: 'good.musicxml',
        summary: {
          title: 'Good',
          composer: null,
          parts: [],
          measureCount: 1,
          measureIds: ['m1'],
          defaultTempoUsed: false,
        },
        report: { entries: [], skippedElementCount: 0 },
        renderXml: '<x/>',
        contentHash: 'hash1',
      });
      expect(items(menu).every((item) => !item.disabled)).toBe(true);
      expect(items(menu).every((item) => item.getAttribute('aria-disabled') !== 'true')).toBe(true);
    });
  });
});

describe('the overflow menu (the bar folds the four menus into one when it runs out of width)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    viewState.closePanel();
  });

  it('holds every entry of the four menus exactly once, in order', () => {
    const fromMenus = MENU_GROUPS.flatMap((group) => group.entries.map((entry) => entry.panel));
    expect(menuGroup('more').entries.map((entry) => entry.panel)).toEqual(fromMenus);
    expect(new Set(fromMenus).size).toBe(fromMenus.length);
  });

  it('renders as a menu of its own and opens the same panels', () => {
    const menu = makeMenu('more');
    expect(trigger(menu).textContent?.trim()).toBe(menuGroup('more').label);
    expect(items(menu)).toHaveLength(menuGroup('more').entries.length);
    trigger(menu).click();
    items(menu)
      .find((item) => item.dataset.panel === 'midi')
      ?.click();
    expect(viewState.get().openPanel).toBe('midi');
  });
});
