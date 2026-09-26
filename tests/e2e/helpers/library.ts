import { expect, type Locator, type Page } from '@playwright/test';

/** The ids of every folder above an item: `learning/keys/c-major/beginner` sits in `learning`, `learning/keys` and
 *  `learning/keys/c-major` (the item id is the path, contracts/library-index.md §3). */
function folderIds(itemId: string): string[] {
  const parts = itemId.split('/').slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

/** Opens every closed folder above the item the way a person does - one click on its summary - and returns the item's
 *  button. Folders the panel already shows open are left alone (feature 011: key folders start closed). Returns the number
 *  of clicks in `clicks` so a test can hold to SC-001's "at most 3 selections". */
export async function revealLibraryItem(page: Page, itemId: string): Promise<{ item: Locator; clicks: number }> {
  // the index loads after the panel opens: wait for the tree before looking for folders
  await page.locator('details.library-section').first().waitFor();
  let clicks = 0;
  for (const id of folderIds(itemId)) {
    const folder = page.locator(`details.library-section[data-section="${id}"]`);
    if ((await folder.count()) === 0) continue;
    const open = await folder.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!open) {
      await folder.locator(':scope > summary').click();
      clicks++;
    }
  }
  const item = page.locator(`.library-item-open[data-id="${itemId}"]`);
  await expect(item).toBeVisible();
  return { item, clicks };
}
