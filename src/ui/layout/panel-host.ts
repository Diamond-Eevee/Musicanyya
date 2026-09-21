import '../elements/mx-panel.js';
import { en } from '../i18n/en.js';
import { PANEL_IDS, type PanelId } from '../state/viewState.js';

/** The existing element(s) each secondary tool is made of, already built and wired by the caller (`session.ts`).
 *  `setup` carries two: the Practice and the Play setup, each of which shows itself for its own mode. */
export type PanelTools = Record<PanelId, readonly HTMLElement[]>;

/**
 * Wraps every secondary tool in an `mx-panel` inside the panel host (`contracts/ui-shell.md` section 3). The tools
 * themselves are not changed; the panels start hidden and open only through `viewState.openPanel`.
 */
export function mountPanels(host: HTMLElement, tools: PanelTools): void {
  for (const id of PANEL_IDS) {
    const panel = document.createElement('mx-panel');
    panel.dataset.panel = id;
    panel.setAttribute('heading', en.panels[id]);
    panel.append(...tools[id]);
    host.appendChild(panel);
  }
}
