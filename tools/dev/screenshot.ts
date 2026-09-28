/**
 * Look at the running app without a browser tool: start a Vite dev server, open the app in the Chromium that
 * Playwright already installed for `pnpm test:e2e`, optionally open a library item or a local file, and save a PNG.
 * Meant for agents doing a quickstart "Manual verification" step (docs/agents/reference.md R7), and for people who
 * want a quick picture.
 *
 *   pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme
 *   pnpm screenshot -- --file tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml --out shots/bare.png
 *   pnpm screenshot -- --url http://localhost:5173 --width 1280 --height 720 --full
 *   pnpm screenshot -- --browser --width 900 --height 700
 *
 * Options:
 *   --item <id>      open this library item (its `id` in public/library/index.json) through the Score browser
 *   --file <path>    open this MusicXML/.mxl file through the Open button
 *   --out <path>     where to write the PNG (default test-results/screenshots/<item|file|app>.png, git-ignored)
 *   --width, --height  viewport in CSS px (default 1600 x 900)
 *   --full           capture the whole scrollable page instead of the viewport
 *   --url <url>      use an already running server instead of starting one
 *   --browser        take the picture with the Score browser open (feature 013). Without it, the browser that
 *                    opens at start-up (FR-001, no Score loaded yet) is closed before the picture; `--item`/`--file`
 *                    close it themselves by opening something, same as a person double-clicking a row - combined
 *                    with `--browser`, it is reopened afterwards, e.g. `--file <path> --browser` to see a *My
 *                    files* entry (US3) the open just created
 *   --practice       after opening the score, switch to Practice and press Start (fakes a MIDI keyboard through the
 *                    same `e2e-midi` window event the e2e tests use; needs --item or --file)
 *   --play <n>       with --practice or --run: first play the correct keys of the first n events (a chord: all its
 *                    keys down, then all up), read from the running session - for real scores whose notes you do not
 *                    know by heart. With --run, timed off the run's own clock (013, T048's `__PLAY_STATE__.expected`
 *                    seam), the same way the e2e Play spec presses a real, unfamiliar Score deterministically
 *   --run            after opening the score, switch to Play mode and press Play: the count-in and the run start and go on
 *                    while the --keys steps are played (same fake MIDI keyboard; needs --item or --file). Without
 *                    --grade the picture is taken after the last step, mid-run, so the cursor can be looked at
 *   --grade          with --run: wait for the run to end and its Grade to appear before the picture (up to 3 minutes)
 *   --keys "<steps>" with --practice or --run: comma-separated steps `+<midi>` (key down), `-<midi>` (key up), `wait`
 *                    (one drawn frame) or `sleep:<ms>` (a real wait, to play in time with a run), e.g.
 *                    "+76,-76,+75,-75,+74" or "sleep:3500,+72,sleep:400,-72". The picture is taken after the last step,
 *                    and keys still down stay held (tools/dev/key-steps.ts)
 *   --piano          switch the on-screen piano layer on through the View menu before the picture (feature 010)
 *   --greyscale      apply `filter: grayscale(1)` to the page just before the picture, to check that states can be told
 *                    apart without colour (feature 010, SC-004)
 *   --seed-progress <path>  seeds progress before the picture, through the `e2e-progress-seed` window event (013,
 *                    T094): the file's own `events` array (tests/fixtures/progress/*.json), e.g.
 *                    tests/fixtures/progress/mixed-statuses.json. Best combined with `--browser`
 *   --filter <name>=<value>  with --browser: choose a filter in the browser's toolbar (013 US5), after selecting the
 *                    *All* folder. Name is level, key, tag or status; repeat it for several, e.g.
 *                    `--filter status=playedNotMastered --filter key="G major"`
 *   --sort <by:dir>  with --browser: choose the sort, e.g. `best:asc` (Best result, lowest first), `title:desc`,
 *                    `lastPlayed:desc`, `library:asc`
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
    browser: { type: 'boolean', default: false },
    practice: { type: 'boolean', default: false },
    run: { type: 'boolean', default: false },
    grade: { type: 'boolean', default: false },
    keys: { type: 'string' },
    play: { type: 'string' },
    piano: { type: 'boolean', default: false },
    greyscale: { type: 'boolean', default: false },
    'seed-progress': { type: 'string' },
    filter: { type: 'string', multiple: true },
    sort: { type: 'string' },
  },
  allowPositionals: false,
});

const LOAD_TIMEOUT_MS = 60_000;

/** Opens a tool of the slim bar the way a person does (tests/e2e/helpers/panels.ts): the menu that holds it, then its
 *  entry. Waits until the slim bar has folded its menus; a string because tools/ compiles without the DOM lib. */
async function openPanel(page: Page, id: string): Promise<void> {
  await page.waitForFunction(
    "(() => { const bar = document.querySelector('#mx-bar'); return bar !== null && bar.scrollWidth <= bar.clientWidth; })()",
  );
  const menu = page
    .locator('#menu-controls mx-menu:visible')
    .filter({ has: page.locator(`[role="menuitem"][data-panel="${id}"]`) })
    .first();
  await menu.locator('button[aria-haspopup="menu"]').click();
  await menu.locator(`[role="menuitem"][data-panel="${id}"]`).click();
}

/** Switches the on-screen piano layer on through the View panel, then closes the panel (feature 010). */
async function showPiano(page: Page): Promise<void> {
  await openPanel(page, 'view');
  await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
  await page.keyboard.press('Escape');
}

/** Opens the Score browser (tests/e2e/helpers/browser.ts's `openBrowser`), unless FR-001 already did at start-up. */
async function openBrowserDialog(page: Page): Promise<void> {
  const dialog = page.locator('dialog.browser');
  if (await dialog.isVisible()) return;
  await page.locator('mx-open-button .mx-open-button').click();
  await dialog.waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
}

/** Closes the Score browser if it is open (tests/e2e/helpers/browser.ts's `closeBrowser`). */
async function closeBrowserDialog(page: Page): Promise<void> {
  const dialog = page.locator('dialog.browser');
  if (!(await dialog.isVisible())) return;
  await dialog.locator('.browser-close').click();
  await dialog.waitFor({ state: 'hidden', timeout: LOAD_TIMEOUT_MS });
}

/** Opens a library item through the Score browser (feature 013, R-20), the way a person does: *All* lists every
 *  item regardless of folder (tests/e2e/helpers/library.ts's `revealLibraryItem`), then a double click on its row. */
async function openLibraryItem(page: Page, id: string): Promise<void> {
  await openBrowserDialog(page);
  const all = page.locator('[role="treeitem"][data-key="all"]');
  // Below 1024px the rail is a folder-picker overlay, closed by default (contracts/score-browser.md §1).
  if (!(await all.isVisible())) await page.locator('.browser-folder-picker').click();
  await all.click();
  const item = page.locator(`.browser-row[data-ref="library:${id}"]`);
  await item.waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
  await item.dblclick();
}

/** T094: reads a `tests/fixtures/progress/*.json` seed file and dispatches its `events` array through the
 *  `e2e-progress-seed` window event, then gives the app a moment to resolve and apply them (real `ProgressStore`
 *  round trips, not synchronous). A string, like `pressKeys`/`playEvents` above - tools/ compiles without the DOM
 *  lib, so `window`/`CustomEvent` are not typed identifiers here. */
async function seedProgress(page: Page, filePath: string): Promise<void> {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const parsed = JSON.parse(raw) as { events: unknown };
  await page.evaluate(
    `window.dispatchEvent(new CustomEvent('e2e-progress-seed', { detail: ${JSON.stringify(parsed.events)} }))`,
  );
  await page.waitForTimeout(300);
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

const GRADE_TIMEOUT_MS = 180_000;

/** Play as the e2e tests start it (tests/e2e/helpers/play.ts): fake a granted MIDI device, switch to Play, press Play. */
async function startRun(page: Page): Promise<void> {
  await page.locator('mx-transport .play-btn:not([disabled])').waitFor({ timeout: LOAD_TIMEOUT_MS });
  await page.evaluate("window.dispatchEvent(new CustomEvent('e2e-ready'))");
  // mx-view-panel.ts has a second mx-mode-switch for phone width (T049) - always in the DOM, so `.first()` picks
  // the primary toolbar one regardless of viewport, the same as a person would use it at this tool's default size.
  await page.locator('mx-mode-switch input[value=play]').first().check();
  await page.locator('mx-transport .play-btn').click();
  await pollUntil(page, 'window.__PLAY_STATE__.get().run !== null', LOAD_TIMEOUT_MS);
}

/** Waits until the run has ended and its Grade is on screen. */
async function waitForGrade(page: Page): Promise<void> {
  await pollUntil(page, 'window.__PLAY_STATE__.get().grade !== null', GRADE_TIMEOUT_MS);
}

/** Polls a page expression until it is true (a plain evaluate, because the page's CSP forbids string `waitForFunction`). */
async function pollUntil(page: Page, expression: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await page.evaluate(expression))) {
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${expression}`);
    await page.waitForTimeout(100);
  }
}

/** Plays the correct keys of the first `count` events of the running session, one event after the other. */
async function playEvents(page: Page, count: number): Promise<void> {
  const eventKeys = (await page.evaluate(
    `window.__PRACTICE_STATE__.get().session.events.slice(0, ${count}).map((e) => e.required.map((r) => r.key))`,
  )) as number[][];
  for (const keys of eventKeys) {
    for (const key of keys)
      await page.evaluate(`window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, ${key}, 100] }))`);
    for (const key of keys)
      await page.evaluate(`window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, ${key}, 0] }))`);
  }
}

/** Plays the correct keys of the first `count` expected notes of the running Play session (013, T048's
 *  `__PLAY_STATE__.get().expected` e2e seam), timed off the run's own `positionRunTick` the same way
 *  `pressFirstExpectedNotes` (tests/e2e/helpers/play.ts) does - a chord's members share one `onsetTick` and are
 *  pressed together. String-evaluated like every other page call in this file (the app's CSP forbids function
 *  serialization). */
async function playRunEvents(page: Page, count: number): Promise<void> {
  await page.evaluate(`(async () => {
    const state = window.__PLAY_STATE__;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const groups = [];
    for (const note of state.get().expected.slice(0, ${count})) {
      const last = groups[groups.length - 1];
      if (last && last.onsetTick === note.onsetTick) last.keys.push(note.key);
      else groups.push({ onsetTick: note.onsetTick, keys: [note.key] });
    }
    for (const group of groups) {
      const deadline = performance.now() + 30000;
      while (performance.now() < deadline) {
        const run = state.get().run;
        if (!run) break;
        const dueRunTick = group.onsetTick - run.tickMap.rangeStartTick + run.tickMap.countInTicks;
        if (run.positionRunTick >= dueRunTick) break;
        await sleep(15);
      }
      for (const key of group.keys) window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, key, 100] }));
      await sleep(40);
      for (const key of group.keys) window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, key, 0] }));
    }
  })()`);
}

async function pressKeys(page: Page, steps: string): Promise<void> {
  for (const step of parseKeySteps(steps)) {
    if (step.kind === 'sleep') {
      await page.waitForTimeout(step.ms);
    } else if (step.kind === 'wait') {
      await page.evaluate('new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))');
    } else {
      await page.evaluate(
        `window.dispatchEvent(new CustomEvent('e2e-midi', { detail: ${JSON.stringify(keyStepBytes(step))} }))`,
      );
    }
  }
}

async function main(): Promise<void> {
  if ((values.practice || values.run || values.keys) && !values.item && !values.file) {
    throw new Error('--practice, --run and --keys need a score: give --item <id> or --file <path>');
  }
  if (values.practice && values.run) throw new Error('--practice and --run are different modes: give one of them');
  if (values.grade && !values.run) throw new Error('--grade needs --run');
  if (values.play && !values.practice && !values.run) throw new Error('--play needs --practice or --run');
  if (values.keys && !values.practice && !values.run) throw new Error('--keys needs --practice or --run');
  if (values.play !== undefined && !/^\d+$/.test(values.play)) throw new Error('--play needs a number of events');
  if (values.keys) parseKeySteps(values.keys); // fail early on a bad step, before a server is started
  if (values['seed-progress']) JSON.parse(fs.readFileSync(path.resolve(values['seed-progress']), 'utf8')); // fail early
  const filters = (values.filter ?? []).map((f) => {
    const at = f.indexOf('=');
    if (at < 1) throw new Error(`--filter needs <name>=<value>, got "${f}"`);
    return { name: f.slice(0, at), value: f.slice(at + 1) };
  });
  if ((filters.length > 0 || values.sort) && !values.browser) throw new Error('--filter and --sort need --browser');
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
    if (values['seed-progress']) await seedProgress(page, values['seed-progress']);
    // FR-001: with no Score loaded, the browser is already open, in front of the bar and the View menu `--piano`
    // needs - open (or leave open) an item or file first, which closes it on success; otherwise close it now
    // unless `--browser` asks to see it (feature 013, R-20, T033).
    if (values.item) await openLibraryItem(page, values.item);
    else if (values.file)
      await page.locator('mx-open-button input[type=file]').setInputFiles(path.resolve(values.file));
    else if (!values.browser) await closeBrowserDialog(page);

    const opened = Boolean(values.item || values.file);
    if (opened) {
      await page.locator('.mx-score-page svg').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT_MS });
      // `--file --browser` together (013 US3): the open closed the dialog on success, same as a person's own
      // double click would - reopen it so the picture shows the item (or, for --file, the *My files* entry
      // `putFile` just wrote) selected, instead of contradicting `--browser`'s own "take the picture with the
      // Score browser open".
      if (values.browser) {
        await openBrowserDialog(page);
        // A file ref has nothing to select in the list (browserState.ts openSucceeded), so the picture would
        // otherwise still show whatever folder the view last had - go straight to *My files* so it is visible.
        if (values.file) {
          const myFiles = page.locator('[role="treeitem"][data-key="myFiles"]');
          if (!(await myFiles.isVisible())) await page.locator('.browser-folder-picker').click();
          await myFiles.click();
        }
      }
    }
    if (values.browser && (filters.length > 0 || values.sort)) {
      // The controls a person uses (013 US5): the *All* folder first, so the filters apply to every item.
      const all = page.locator('[role="treeitem"][data-key="all"]');
      if (!(await all.isVisible())) await page.locator('.browser-folder-picker').click();
      await all.click();
      for (const { name, value } of filters) {
        await page.locator(`select[data-filter="${name}"]`).selectOption(value);
      }
      if (values.sort) await page.locator('select[data-sort]').selectOption(values.sort);
    }
    if (values.piano) await showPiano(page);
    // Let Verovio finish the neighbouring pages and the notice tray settle before the picture.
    await page.waitForTimeout(1000);
    if (values.practice) {
      await startPractice(page);
      if (values.play) await playEvents(page, Number(values.play));
      if (values.keys) await pressKeys(page, values.keys);
      await page.waitForTimeout(300); // a few frames for the marks to draw
    }
    if (values.run) {
      await startRun(page);
      if (values.play) await playRunEvents(page, Number(values.play));
      if (values.keys) await pressKeys(page, values.keys);
      if (values.grade) await waitForGrade(page);
      await page.waitForTimeout(300); // a few frames for the cursor or the marks to draw
    }

    // A `showModal()` dialog (e.g. the score browser, T058) paints in the top layer, which does not inherit an
    // ancestor's `filter` - grey it out directly too, or `--browser --greyscale` would still show it in colour.
    if (values.greyscale)
      await page.evaluate(
        "document.documentElement.style.filter = 'grayscale(1)'; document.querySelectorAll('dialog[open]').forEach((d) => { d.style.filter = 'grayscale(1)'; });",
      );

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
