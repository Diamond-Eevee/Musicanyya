import { expect, type Page } from '@playwright/test';

/** The tools a person opens by hand from a menu of the slim bar (`data-model.md` section 5). `grade` has no entry: a
 *  finished Play run opens it, so wait for it with `expect(panelLocator(page, 'grade')).toBeVisible()`. */
export type ManualPanel =
  | 'scores'
  | 'attempts'
  | 'setup'
  | 'midi'
  | 'latency'
  | 'view'
  | 'help'
  | 'diagnostics'
  | 'environment';

export const panelLocator = (page: Page, id: ManualPanel | 'grade') => page.locator(`mx-panel[data-panel="${id}"]`);

/** Waits until the slim bar has fitted its contents: after content changes it folds the four menus into "More" on the
 *  next animation frame, so a menu resolved a moment too early can vanish under the click. */
export const barFitted = (page: Page) =>
  page.waitForFunction(() => {
    const bar = document.querySelector('#mx-bar');
    return bar !== null && bar.scrollWidth <= bar.clientWidth;
  });

/** The visible menu that holds a tool's entry: its own menu, or "More" when the bar has folded the four into one. */
export const menuFor = (page: Page, id: ManualPanel) =>
  page
    .locator('#menu-controls mx-menu:visible')
    .filter({ has: page.locator(`[role="menuitem"][data-panel="${id}"]`) })
    .first();

export const menuButton = (page: Page, id: ManualPanel) => menuFor(page, id).locator('button[aria-haspopup="menu"]');
export const menuEntry = (page: Page, id: ManualPanel) =>
  menuFor(page, id).locator(`[role="menuitem"][data-panel="${id}"]`);

/** Opens a secondary tool the way a person does: its menu, then its entry (two activations). A tool that is already
 *  showing is left alone. Note that starting a run closes any open panel (FR-006), so call this again afterwards. */
export async function openPanel(page: Page, id: ManualPanel): Promise<void> {
  const panel = panelLocator(page, id);
  if (await panel.isVisible()) return;
  await barFitted(page);
  await menuButton(page, id).click();
  await menuEntry(page, id).click();
  await expect(panel).toBeVisible();
}
