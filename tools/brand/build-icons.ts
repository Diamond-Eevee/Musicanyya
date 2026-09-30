/**
 * Generates every icon file from the one artwork source, `src/ui/brand/logo.ts` (brand.md 1.0.0 section 3,
 * research R-10). Rasterises `logoTileSvg(size)` in the Chromium that Playwright already installed for
 * `pnpm test:e2e`, and packs the Windows icon with the small ICO writer below (no icon package needed).
 *
 *   pnpm brand:icons
 *
 * Writes (committed): public/favicon.svg, public/favicon-32.png, build/icon.ico (16-256 px), build/icon.png (512 px).
 * Writes (git-ignored): tests/.generated/brand-sheet.png, the owner review sheet (gate OD-1): every size on the six
 * themes' surfaces plus white and black, the bar mark with the word, and the small sizes enlarged.
 * Re-run only when logo.ts changes. The output is deterministic for a given Chromium build.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { logoMarkSvg, logoTileSvg } from '../../src/ui/brand/logo.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

/** Sizes packed into build/icon.ico (brand.md section 3). */
export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
const APP_ICON_SIZE = 512;
const FAVICON_PNG_SIZE = 32;

/**
 * Surface and ink of each theme, from the research R-5 design table, for the review sheet only. The themes
 * themselves live in src/ui/styles/themes.css.
 */
export const SHEET_BACKGROUNDS: readonly { name: string; surface: string; ink: string }[] = [
  { name: 'Paper', surface: '#f7f5f0', ink: '#1c1b19' },
  { name: 'Ivory', surface: '#f6efe0', ink: '#2a2118' },
  { name: 'Slate', surface: '#f1f3f5', ink: '#1b2229' },
  { name: 'Night', surface: '#1b1d21', ink: '#e8e6e1' },
  { name: 'Walnut', surface: '#2a2019', ink: '#efe6d8' },
  { name: 'Midnight', surface: '#151e33', ink: '#e6e9f2' },
  { name: 'White', surface: '#ffffff', ink: '#000000' },
  { name: 'Black', surface: '#000000', ink: '#ffffff' },
];
/** Sizes shown on every background; the large ones are shown once, on white. */
const SHEET_ROW_SIZES = [16, 24, 32, 48, 64, 128];
const SHEET_LARGE_SIZES = [256, APP_ICON_SIZE];
const SHEET_ZOOM = 8;
const SHEET_ZOOM_SIZES = [16, 24, 32];

export interface IcoEntry {
  width: number;
  height: number;
  buffer: Buffer;
}

function pngSize(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('ICO entry is not a PNG image (signature or IHDR missing)');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** Packs PNG images into an ICO file with PNG-compressed entries (Windows Vista and later). */
export function writeIco(pngs: readonly Buffer[]): Buffer {
  const sizes = pngs.map(pngSize);
  const header = Buffer.alloc(ICO_HEADER_BYTES + ICO_ENTRY_BYTES * pngs.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const { width, height } = sizes[i] as { width: number; height: number };
    if (width > 256 || height > 256) throw new Error(`ICO entries are at most 256 px, got ${width}x${height}`);
    const at = ICO_HEADER_BYTES + i * ICO_ENTRY_BYTES;
    header.writeUInt8(width === 256 ? 0 : width, at);
    header.writeUInt8(height === 256 ? 0 : height, at + 1);
    header.writeUInt8(0, at + 2); // palette colours
    header.writeUInt8(0, at + 3); // reserved
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
}

/** Reads the entries of an ICO file written by `writeIco` (used by the tests to check the committed icon). */
export function readIco(ico: Buffer): IcoEntry[] {
  if (ico.length < ICO_HEADER_BYTES || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error('Not an ICO file');
  }
  const count = ico.readUInt16LE(4);
  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = ICO_HEADER_BYTES + i * ICO_ENTRY_BYTES;
    const bytes = ico.readUInt32LE(at + 8);
    const offset = ico.readUInt32LE(at + 12);
    if (offset + bytes > ico.length) throw new Error(`ICO entry ${i} runs past the end of the file`);
    entries.push({
      width: ico.readUInt8(at) || 256,
      height: ico.readUInt8(at + 1) || 256,
      buffer: ico.subarray(offset, offset + bytes),
    });
  }
  return entries;
}

function sheetHtml(pngs: ReadonlyMap<number, Buffer>): string {
  const cell = (inner: string, label: string) => `<div class="cell">${inner}<div class="label">${label}</div></div>`;
  const rows = SHEET_BACKGROUNDS.map(({ name, surface, ink }) => {
    const tiles = SHEET_ROW_SIZES.map((s) => cell(logoTileSvg(s), `${s}`)).join('');
    const bar = `<span class="bar" style="color:${ink}">${logoMarkSvg({})}<span class="word">Musicanyya</span></span>`;
    const empty = `<span class="empty" style="color:${ink}">${logoMarkSvg({})}</span>`;
    return (
      `<section style="background:${surface};color:${ink}"><h2>${name}</h2>` +
      `<div class="row">${tiles}${cell(bar, 'bar 24')}${cell(empty, 'empty state 64')}</div></section>`
    );
  }).join('');
  const zoomed = SHEET_ZOOM_SIZES.map((s) => {
    const src = `data:image/png;base64,${(pngs.get(s) as Buffer).toString('base64')}`;
    return cell(`<img src="${src}" width="${s * SHEET_ZOOM}" height="${s * SHEET_ZOOM}">`, `${s} px x${SHEET_ZOOM}`);
  }).join('');
  const large = SHEET_LARGE_SIZES.map((s) => cell(logoTileSvg(s), `${s}`)).join('');
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; font: 13px system-ui, sans-serif; }
    section { padding: 8px 16px 12px; }
    h2 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
    .row { display: flex; align-items: flex-end; gap: 20px; }
    .cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .cell > svg { display: block; }
    .label { font-size: 11px; opacity: 0.75; }
    .bar { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 15px; }
    .bar svg { width: 24px; height: 24px; }
    .empty svg { width: 64px; height: 64px; display: block; }
    img { image-rendering: pixelated; display: block; }
    .zoom { background: #808080; color: #ffffff; }
  </style>${rows}<section class="zoom"><h2>Small sizes enlarged (pixels as rendered)</h2>
  <div class="row">${zoomed}</div></section>
  <section style="background:#ffffff"><h2>Large sizes</h2><div class="row">${large}</div></section>`;
}

async function main(): Promise<void> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = (rel: string) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return file;
  };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const pngs = new Map<number, Buffer>();
    for (const size of [...ICO_SIZES, APP_ICON_SIZE]) {
      await page.setContent(`<body style="margin:0">${logoTileSvg(size)}</body>`);
      pngs.set(size, await page.locator('svg').screenshot({ omitBackground: true }));
    }
    const png = (size: number) => pngs.get(size) as Buffer;

    fs.writeFileSync(out('public/favicon.svg'), `${logoTileSvg(FAVICON_PNG_SIZE)}\n`);
    fs.writeFileSync(out('public/favicon-32.png'), png(FAVICON_PNG_SIZE));
    fs.writeFileSync(out('build/icon.ico'), writeIco(ICO_SIZES.map(png)));
    fs.writeFileSync(out('build/icon.png'), png(APP_ICON_SIZE));

    await page.setContent(sheetHtml(pngs));
    const sheet = out('tests/.generated/brand-sheet.png');
    await page.screenshot({ path: sheet, fullPage: true });
    for (const rel of ['public/favicon.svg', 'public/favicon-32.png', 'build/icon.ico', 'build/icon.png', sheet]) {
      console.log(path.relative(root, path.resolve(root, rel)));
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
