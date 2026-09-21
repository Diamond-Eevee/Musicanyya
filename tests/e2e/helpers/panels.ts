import { expect, type Page } from '@playwright/test';

/** Which menu of the slim bar each secondary tool lives in (`data-model.md` section 5). `grade` has no entry: a
 *  finished Play run opens it, so wait for it with `expect(panelLocator(page, 'grade')).toBeVisible()`. */
const MENU_OF = {
  scores: 'score',
  attempts: 'score',
  setup: 'setup',
  midi: 'setup',
  latency: 'setup',
  view: 'view',
  help: 'help',
  diagnostics: 'help',
  environment: 'help',
} as const;

export type ManualPanel = keyof typeof MENU_OF;

export const panelLocator = (page: Page, id: ManualPanel | 'grade') => page.locator(`mx-panel[data-panel="${id}"]`);

/** Opens a secondary tool the way a person does: its menu, then its entry (two activations). A tool that is already
 *  showing is left alone. Note that starting a run closes any open panel (FR-006), so call this again afterwards. */
export async function openPanel(page: Page, id: ManualPanel): Promise<void> {
  const panel = panelLocator(page, id);
  if (await panel.isVisible()) return;
  const menu = MENU_OF[id];
  await page.locator(`mx-menu[menu="${menu}"] button[aria-haspopup="menu"]`).click();
  await page.locator(`mx-menu[menu="${menu}"] [role="menuitem"][data-panel="${id}"]`).click();
  await expect(panel).toBeVisible();
}
