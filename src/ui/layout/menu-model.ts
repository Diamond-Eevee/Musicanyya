import { en } from '../i18n/en.js';
import type { PanelId } from '../state/viewState.js';

export type MenuId = 'score' | 'setup' | 'view' | 'help';

export interface MenuEntry {
  /** The one panel this entry opens. */
  panel: PanelId;
  label: string;
  /** Disabled (never hidden, so the menu keeps its shape) while no Score is loaded. */
  needsScore: boolean;
}

export interface MenuGroup {
  id: MenuId;
  label: string;
  entries: readonly MenuEntry[];
}

const entry = (panel: PanelId, needsScore = false): MenuEntry => ({ panel, label: en.panels[panel], needsScore });

/** The static menu structure of `data-model.md` section 5. `grade` has no entry: a finished Play run opens it. */
export const MENU_GROUPS: readonly MenuGroup[] = [
  { id: 'score', label: en.menus.score, entries: [entry('scores'), entry('attempts', true)] },
  { id: 'setup', label: en.menus.setup, entries: [entry('setup', true), entry('midi'), entry('latency')] },
  { id: 'view', label: en.menus.view, entries: [entry('view')] },
  { id: 'help', label: en.menus.help, entries: [entry('help'), entry('diagnostics'), entry('environment')] },
];

export function menuGroup(id: MenuId): MenuGroup {
  const group = MENU_GROUPS.find((candidate) => candidate.id === id);
  if (!group) throw new Error(`Unknown menu: ${id}`);
  return group;
}

export function panelTitle(panel: PanelId): string {
  return en.panels[panel];
}
