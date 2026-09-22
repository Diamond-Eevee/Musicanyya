import { en } from '../i18n/en.js';
import type { PanelId } from '../state/viewState.js';

export type MenuId = 'score' | 'setup' | 'view' | 'help' | 'more';

export interface MenuEntry {
  /** The one panel this entry opens. */
  panel: PanelId;
  label: string;
  /** Disabled (never hidden, so the menu keeps its shape) while no Score is loaded. */
  needsScore: boolean;
  /** Disabled while a run is active. A popup would cover music (the whole score of a short piece is one page, so
   *  nothing could scroll clear of it), the setup must not show during a run (FR-007), and the attempts list can ask
   *  for a confirmation, which nothing may do during one (Principle VI). SC-004: nothing but the Score, the bar and
   *  notices is on screen during a run. */
  idleOnly: boolean;
}

export interface MenuGroup {
  id: MenuId;
  label: string;
  entries: readonly MenuEntry[];
}

const entry = (panel: PanelId, needsScore = false, idleOnly = true): MenuEntry => ({
  panel,
  label: en.panels[panel],
  needsScore,
  idleOnly,
});

/** The static menu structure of `data-model.md` section 5. `grade` has no entry: a finished Play run opens it. */
export const MENU_GROUPS: readonly MenuGroup[] = [
  { id: 'score', label: en.menus.score, entries: [entry('scores'), entry('attempts', true)] },
  { id: 'setup', label: en.menus.setup, entries: [entry('setup', true), entry('midi'), entry('latency')] },
  { id: 'view', label: en.menus.view, entries: [entry('view')] },
  { id: 'help', label: en.menus.help, entries: [entry('help'), entry('diagnostics'), entry('environment')] },
];

/**
 * The four menus folded into one, for a bar too narrow to show them side by side (contracts/ui-shell.md section 2:
 * secondary controls collapse into an overflow menu instead of wrapping into a second row). Every entry appears once.
 */
export const OVERFLOW_MENU: MenuGroup = {
  id: 'more',
  label: en.menus.more,
  entries: MENU_GROUPS.flatMap((group) => group.entries),
};

export function menuGroup(id: MenuId): MenuGroup {
  const group = [...MENU_GROUPS, OVERFLOW_MENU].find((candidate) => candidate.id === id);
  if (!group) throw new Error(`Unknown menu: ${id}`);
  return group;
}

export function panelTitle(panel: PanelId): string {
  return en.panels[panel];
}
