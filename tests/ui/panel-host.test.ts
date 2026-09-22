import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-panel.js';
import { en } from '../../src/ui/i18n/en.js';
import { mountPanels, type PanelTools } from '../../src/ui/layout/panel-host.js';
import { PANEL_IDS, type PanelId } from '../../src/ui/state/viewState.js';

/** Stands in for the ten existing elements `session.ts` builds and wires; `setup` carries two (Practice and Play). */
function tools(): PanelTools {
  const one = (id: PanelId) => {
    const el = document.createElement('div');
    el.className = `tool-${id}`;
    return [el];
  };
  const built = Object.fromEntries(PANEL_IDS.map((id) => [id, one(id)])) as PanelTools;
  const play = document.createElement('div');
  play.className = 'tool-setup-play';
  return { ...built, setup: [...(built.setup ?? []), play] };
}

/** `ui-shell.md` sections 1 and 3: every secondary tool lives in `#panel-host`, wrapped in `mx-panel`. */
describe('mountPanels', () => {
  let bar: HTMLElement;
  let main: HTMLElement;
  let scoreView: HTMLElement;
  let host: HTMLElement;

  beforeEach(() => {
    bar = document.createElement('header');
    bar.id = 'mx-bar';
    main = document.createElement('main');
    main.id = 'mx-main';
    scoreView = document.createElement('mx-score-view');
    host = document.createElement('div');
    host.id = 'panel-host';
    main.append(scoreView, host);
    document.body.append(bar, main);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps each of the ten tools in an mx-panel with its own data-panel and heading', () => {
    mountPanels(host, tools());
    const panels = Array.from(host.querySelectorAll<HTMLElement>(':scope > mx-panel'));
    expect(panels.map((panel) => panel.dataset.panel).sort()).toEqual([...PANEL_IDS].sort());
    for (const panel of panels) {
      expect(panel.getAttribute('heading')).toBe(en.panels[panel.dataset.panel as PanelId]);
    }
  });

  it('puts each tool inside the panel with its id, unchanged', () => {
    const built = tools();
    mountPanels(host, built);
    for (const id of PANEL_IDS) {
      const panel = host.querySelector(`mx-panel[data-panel="${id}"]`);
      for (const element of built[id] ?? []) expect(element.parentElement, id).toBe(panel);
    }
    expect(host.querySelectorAll('mx-panel[data-panel="setup"] > div')).toHaveLength(2);
  });

  it('starts with every panel hidden', () => {
    mountPanels(host, tools());
    for (const panel of host.querySelectorAll<HTMLElement>('mx-panel')) expect(panel.hidden).toBe(true);
  });

  it('none of the tools is a child of the bar or of the Score view', () => {
    const built = tools();
    mountPanels(host, built);
    for (const id of PANEL_IDS) {
      for (const element of built[id] ?? []) {
        expect(bar.contains(element), id).toBe(false);
        expect(scoreView.contains(element), id).toBe(false);
        expect(host.contains(element), id).toBe(true);
      }
    }
  });

  it('adds nothing but the ten panels to the host', () => {
    mountPanels(host, tools());
    expect(host.children).toHaveLength(PANEL_IDS.length);
  });
});
