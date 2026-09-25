/**
 * Look at the running app without a browser tool: start a Vite dev server, open the app in the Chromium that
 * Playwright already installed for `pnpm test:e2e`, optionally open a library item or a local file, and save a PNG.
 * Meant for agents doing a quickstart "Manual verification" step (docs/agents/reference.md R7), and for people who
 * want a quick picture.
 *
 *   pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme
 *   pnpm screenshot -- --file tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml --out shots/bare.png
 *   pnpm screenshot -- --url http://localhost:5173 --width 1280 --height 720 --full
 *
 * Options:
 *   --item <id>      open this library item (its `id` in public/library/index.json) through the Scores panel
 *   --file <path>    open this MusicXML/.mxl file through the Open button
 *   --out <path>     where to write the PNG (default test-results/screenshots/<item|file|app>.png, git-ignored)
 *   --width, --height  viewport in CSS px (default 1600 x 900)
 *   --full           capture the whole scrollable page instead of the viewport
 *   --url <url>      use an already running server instead of starting one
 *   --practice       after opening the score, switch to Practice and press Start (fakes a MIDI keyboard through the
 *                    same `e2e-midi` window event the e2e tests use; needs --item or --file)
 *   --keys "<steps>" with --practice: comma-separated steps `+<midi>` (key down), `-<midi>` (key up) or `wait` (one
 *                    drawn frame), e.g. "+76,-76,+75,-75,+74". The picture is taken after the last step, and keys
 *                    still down stay held (tools/dev/key-steps.ts)
 *
 * Prints the PNG path, the load notices shown and any browser console errors, so the result can be checked as text
 * too. Exits 1 when the score does not appear.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { keyStepBytes, parseKeySteps } from './key-steps.js';

// `pnpm screenshot -- --item x` (the documented form) passes the `--` through on newer pnpm versions: drop it.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();

const { values } = parseArgs({
  args,
  options: {
    item: { type: 'string' },
    file: { type: 'string' },
    out: { type: 'string' },
    width: { type: 'string', default: '1600' },
    height: { type: 'string', default: '900' },
    full: { type: 'boolean', default: false },
    url: { type: 'string' },
    practice: { type: 'boolean', default: false },
    keys: { type: 'string' },
  },
  allowPositionals: false,
});

const LOAD_TIMEOUT_MS = 60_000;

async function openLibraryItem(page: Page, id: string): Promise<void> {
  // The same two activations a person uses (tests/e2e/helpers/panels.ts): the menu that holds "Scores", then the entry.
  // Wait until the slim bar has folded its menus; a string because tools/ compiles without the DOM lib.
  await page.waitForFunction(
    "(() => { const bar = document.querySelector('#mx-bar'); return bar !== null && bar.scrollWidth <= bar.clientWidth; })()",
  );
  const menu = page
    .locator('#menu-controls mx-menu:visible')
    .filter({ has: page.locator('[role="menuitem"][data-panel="scores"]') })
    .first();
  await menu.locator('button[aria-haspopup="menu"]').click();
  await menu.locator('[role="menuitem"][data-panel="scores"]').click();
  const item = page.locator(`.library-item-open[data-id="${id}"]`);
  await item.waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
  await item.click();
}

/** Practice as the e2e tests start it: fake a granted MIDI device, switch the mode, press Start. Strings, because tools/
 *  compiles without the DOM lib; waits use locators, because the page's CSP forbids the string predicates of `waitForFunction`. */
async function startPractice(page: Page): Promise<void> {
  await page.locator('mx-transport .play-btn:not([disabled])').waitFor({ timeout: LOAD_TIMEOUT_MS });
  await page.evaluate("window.dispatchEvent(new CustomEvent('e2e-ready'))");
  await page.evaluate("window.__PRACTICE_STATE__.setMode('practice')");
  await page.locator('mx-transport .play-btn').click();
  await page.locator('mx-transport .play-btn', { hasText: 'Stop' }).waitFor({ timeout: LOAD_TIMEOUT_MS });
}

async function pressKeys(page: Page, steps: string): Promise<void> {
  for (const step of parseKeySteps(steps)) {
    if (step.kind === 'wait') {
      await page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))');
    } else {
      await page.evaluate(
        `window.dispatchEvent(new CustomEvent('e2e-midi', { detail: ${JSON.stringify(keyStepBytes(step))} }))`,
      );
    }
  }
}

async function main(): Promise<void> {
  if ((values.practice || values.keys) && !values.item && !values.file) {
    throw new Error('--practice and --keys need a score: give --item <id> or --file <path>');
  }
  if (values.keys && !values.practice) throw new Error('--keys needs --practice');
  if (values.keys) parseKeySteps(values.keys); // fail early on a bad step, before a server is started
  let server: ViteDevServer | null = null;
  let baseUrl = values.url;
  if (!baseUrl) {
    server = await createServer({ server: { port: 5173, strictPort: false }, logLevel: 'error' });
    await server.listen();
    baseUrl = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/';
  }

  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: Number(values.width), height: Number(values.height) } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(baseUrl);
    if (values.item) await openLibraryItem(page, values.item);
    if (values.file) await page.locator('mx-open-button input[type=file]').setInputFiles(path.resolve(values.file));

    const opened = Boolean(values.item || values.file);
    if (opened) {
      await page.locator('.mx-score-page svg').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
    }
    // Let Verovio finish the neighbouring pages and the notice tray settle before the picture.
    await page.waitForTimeout(1000);
    if (values.practice) {
      await startPractice(page);
      if (values.keys) await pressKeys(page, values.keys);
      await page.waitForTimeout(300); // a few frames for the marks to draw
    }

    const name = values.item ? path.basename(values.item) : values.file ? path.parse(values.file).name : 'app';
    const out = path.resolve(values.out ?? path.join('test-results', 'screenshots', `${name}.png`));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: values.full });

    const notices = await page.locator('.notice').allInnerTexts();
    console.log(`screenshot: ${out}`);
    console.log(`notices: ${notices.length === 0 ? 'none' : ''}`);
    for (const n of notices) console.log(`  - ${n.replace(/\s+/g, ' ').trim()}`);
    console.log(`console errors: ${errors.length === 0 ? 'none' : ''}`);
    for (const e of errors) console.log(`  - ${e}`);
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
