import { en } from '../i18n/en.js';
import type { PanelId } from '../state/viewState.js';

export type MenuId = 'score' | 'setup' | 'view' | 'help' | 'more';

export interface MenuEntry {
  /** The one panel this entry opens, or `'browser'` (feature 013, R-2, R-20): not a `PanelId` - it opens the
   *  score browser's own `<dialog>` instead of a `viewState` popup (contracts/score-browser.md §5). */
  panel: PanelId | 'browser';
  label: string;
  /** Disabled (never hidden, so the menu keeps its shape) while no Score is loaded. */
  needsScore: boolean;
  /** Disabled while a run is active. A popup would cover music (the whole score of a short piece is one page, so
   *  nothing could scroll clear of it), the setup must not show during a run (FR-007), and the attempts list can ask
   *  for a confirmation, which nothing may do during one (Principle VI). SC-004: nothing but the Score, the bar and
   *  notices is on screen during a run. Left `false` for `'browser'`: its own guard is narrower (a Play run or
   *  Practice session, not Listen, R-2) and lives in `BrowserSessionController.open()`, which safely no-ops when
   *  refused - matching the bar's own Open button, which is never disabled either. */
  idleOnly: boolean;
  /** An `idleOnly` entry that stays enabled during a Listen run (ui-shell 1.3.0, feature 016 R-12): only View, so the
   *  theme can be changed while listening (SC-010). Listen grades nothing, and the listener chose to open it. */
  listenOk: boolean;
}

/** The one panel a person may open during a Listen run (ui-shell 1.3.0); `runGuard.ts` leaves it open then. */
export const LISTEN_OK_PANEL: PanelId = 'view';

export interface MenuGroup {
  id: MenuId;
  label: string;
  entries: readonly MenuEntry[];
}

function entry(panel: 'browser', needsScore?: boolean, idleOnly?: boolean): MenuEntry;
function entry(panel: PanelId, needsScore?: boolean, idleOnly?: boolean): MenuEntry;
function entry(panel: PanelId | 'browser', needsScore = false, idleOnly = true): MenuEntry {
  const label = panel === 'browser' ? en.panels.browser : en.panels[panel];
  return { panel, label, needsScore, idleOnly, listenOk: panel === LISTEN_OK_PANEL };
}

/** The static menu structure of `data-model.md` section 5. `grade` has no entry: a finished Play run opens it.
 *  The score menu's *Open...* entry replaced *Recent scores* (R-20) - `scores` is now *About this score*
 *  (`mx-score-source`). It stays reachable with no Score open (`needsScore: false`, tests/ui/menu.test.ts), as it was
 *  while the recent list lived in it; `mx-score-source` alone renders empty until a Score is open. */
export const MENU_GROUPS: readonly MenuGroup[] = [
  {
    id: 'score',
    label: en.menus.score,
    entries: [entry('browser', false, false), entry('scores'), entry('attempts', true)],
  },
  { id: 'setup', label: en.menus.setup, entries: [entry('setup', true), entry('latency')] },
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
