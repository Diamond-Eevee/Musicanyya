import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../../dist');
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

test.describe('Static host with sub-path', () => {
  let server: http.Server;
  let serverUrl: string;

  test.beforeAll(async () => {
    // Start a basic HTTP server serving dist/ under /subpath/
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      if (!url.pathname.startsWith('/subpath/')) {
        res.writeHead(404);
        res.end();
        return;
      }

      let relativePath = url.pathname.slice('/subpath/'.length);
      if (!relativePath) relativePath = 'index.html';

      const filePath = path.join(distDir, relativePath);
      if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }

      const ext = path.extname(filePath);
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.wasm': 'application/wasm',
        '.sf2': 'application/octet-stream',
      };
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      fs.createReadStream(filePath).pipe(res);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        serverUrl = `http://127.0.0.1:${address.port}/subpath/`;
        resolve();
      });
    });
  });

  test.afterAll(() => {
    server.close();
  });

  test('loads app, opens fixture and plays', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run static-host test on chromium only');

    // Check that it's actually built
    if (!fs.existsSync(distDir)) {
      test.skip();
    }

    await page.goto(serverUrl);
    await expect(page.locator('.mx-empty-state')).toBeVisible();
    await expect(page.locator('mx-environment-panel')).toBeHidden();

    // Check environment panel shows Browser
    await page.getByRole('button', { name: 'Environment' }).click();
    await expect(page.locator('mx-environment-panel')).toBeVisible();
    await expect(page.locator('mx-environment-panel')).toContainText('Browser');

    // Open a fixture
    const fileInput = page.locator('mx-open-button input[type=file]');
    await fileInput.setInputFiles(path.join(fixturesDir, 'scale-c-major-q100.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.mx-empty-state')).toBeHidden();

    // Play. Uses the class selector rather than getByRole('button', { name: 'Play' }): repeatedly polling a
    // role+accessible-name locator forces Chromium to recompute the accessibility tree on every retry, which
    // starves the page's main thread and can stall the SoundFont fetch that Play depends on indefinitely.
    const playBtn = page.locator('.play-btn');
    await playBtn.click();

    // Let it load the soundfont and play
    await expect(playBtn).toContainText('Pause', { timeout: 15000 });
  });
});
