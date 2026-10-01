import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

const progressFixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/progress');

/** The modal window itself (contracts/score-browser.md §1, §8: `data-testid="browser"`). */
export const browserDialog = (page: Page) => page.locator('dialog.browser');

/** Opens it the way a person does (the bar's Open button), if it is not open already (FR-001 may have opened it
 *  already at start-up - racily so on a fresh load, since it happens once the app finishes booting, not on
 *  `firstWindow()`/`goto()` itself). A plain "check then click" loses that race on a slow boot: the check finds it
 *  closed, but FR-001 opens it before the click lands, and the dialog's own header then permanently covers the
 *  Open button, so the click just times out. Retrying the click (ignoring an interception) and rechecking after
 *  each attempt makes either order work. */
export async function openBrowser(page: Page): Promise<void> {
  const dialog = browserDialog(page);
  for (let i = 0; i < 20; i++) {
    if (await dialog.isVisible()) return;
    await page
      .locator('mx-open-button .mx-open-button')
      .click({ timeout: 500 })
      .catch(() => {});
  }
  await expect(dialog).toBeVisible();
}

/** Closes it with its own close button, if it is open. A fresh load races FR-001's own auto-open exactly like
 *  `openBrowser` above: a check made before FR-001 has run finds nothing to close, but the dialog then opens a
 *  moment later and permanently covers whatever the caller does next. Polling briefly for it to appear (instead of
 *  a single check) gives that race a chance to resolve before this declares there is nothing to do. */
export async function closeBrowser(page: Page): Promise<void> {
  const dialog = browserDialog(page);
  for (let i = 0; i < 10; i++) {
    if (await dialog.isVisible()) {
      await dialog.locator('.browser-close').click();
      await expect(dialog).toBeHidden();
      return;
    }
    await page.waitForTimeout(50);
  }
}

/** Sets a file on the bar's own open control (`mx-open-button`'s hidden input, R-20) - works whether the browser
 *  is showing or not, and closes it once the Score loads (contracts §5: "closes on ... a file"). `openBrowserFile`
 *  below is the dialog's own *Open file...* input (US3), a second, equally valid path to the same event. */
export async function openScoreFile(page: Page, path: string): Promise<void> {
  await page.locator('mx-open-button input[type=file]').setInputFiles(path);
  await expect(browserDialog(page)).toBeHidden();
}

/** US3: the score browser dialog's own *Open file...* input (contracts §3, T069) - the dialog must already be
 *  open. Closes it once the Score loads, same as `openScoreFile`. */
export async function openBrowserFile(page: Page, path: string): Promise<void> {
  await browserDialog(page).locator('.browser-open-file-input').setInputFiles(path);
  await expect(browserDialog(page)).toBeHidden();
}

/** A row of the list, by its `data-ref` (`library:<id>` or `file:<fileKey>`, contracts §8). */
export const rowByRef = (page: Page, ref: string): Locator => page.locator(`.browser-row[data-ref="${ref}"]`);

/** Opens a library item through the browser: search for it (simplest reliable path regardless of which folder is
 *  selected) and double-click its row. */
export async function openLibraryItem(page: Page, itemId: string, searchText: string): Promise<void> {
  await openBrowser(page);
  await page.locator('.browser-search').fill(searchText);
  const row = rowByRef(page, `library:${itemId}`);
  await expect(row).toBeVisible();
  await row.dblclick();
  await expect(browserDialog(page)).toBeHidden();
}

/** Seeds progress the way a played history would (contracts/score-browser.md §8, T094): reads a
 *  `tests/fixtures/progress/<name>.json` file and dispatches its `events` through the `e2e-progress-seed` window event.
 *  The events go through the ordinary `ProgressStore.apply`; the open browser refreshes itself afterwards, so callers
 *  wait on what they expect to see, not on this. */
export async function seedProgress(page: Page, fixtureName: string): Promise<void> {
  const seed = JSON.parse(fs.readFileSync(path.join(progressFixtures, fixtureName), 'utf8')) as { events: unknown };
  await page.evaluate((events) => {
    window.dispatchEvent(new CustomEvent('e2e-progress-seed', { detail: events }));
  }, seed.events);
}

/** 018: the rail starts collapsed, so a test that needs a nested folder opens its ancestors first, with the
 *  disclosure control a person would use. Section ids are path-like (`learning/keys/c-major`), so the ancestors are
 *  the id's own prefixes. A folder that is open already is left alone. */
export async function revealFolder(page: Page, sectionId: string): Promise<void> {
  const parts = sectionId.split('/');
  for (let i = 1; i < parts.length; i++) {
    const ancestor = page.locator(`.browser-rail-item[data-key="section:${parts.slice(0, i).join('/')}"]`);
    await expect(ancestor).toBeVisible();
    if ((await ancestor.getAttribute('aria-expanded')) === 'false') {
      await ancestor.locator('.browser-rail-toggle').click();
    }
  }
}

/** The folders a returning musician has open when they use the C major key folder (018: the rail starts collapsed). */
export const KEYS_OPEN = ['learning', 'learning/keys'] as const;

/** 018: before the first `goto`, stores a browser view record the way a previous visit would have left it (the
 *  `musicanyya.browser.v1` record, contracts/browser-view.md section 5). It only writes when there is no record yet, so
 *  a reload within the test keeps what the app saved itself. `view` may be partial; `corrupt` stores unparsable text. */
export async function seedBrowserView(page: Page, view: Record<string, unknown> | 'corrupt'): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      } catch {
        // storage unavailable: the test then runs with the default view
      }
    },
    {
      key: 'musicanyya.browser.v1',
      value: view === 'corrupt' ? '{not json' : JSON.stringify({ version: 1, view }),
    },
  );
}

/** The same for the rail's open folders alone (018: the rail starts collapsed). */
export async function seedOpenFolders(page: Page, expanded: readonly string[]): Promise<void> {
  await seedBrowserView(page, { expanded: [...expanded] });
}
