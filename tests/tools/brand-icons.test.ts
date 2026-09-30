import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { logoTileSvg } from '../../src/ui/brand/logo.js';
import { readIco, SHEET_BACKGROUNDS, writeIco } from '../../tools/brand/build-icons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function makeMinimalPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(8 + 25 + 12);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length: 13
  buf.writeUInt32BE(13, 8);
  // IHDR type
  buf.write('IHDR', 12);
  // width, height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // bit depth: 8, color type: 6 (RGBA), comp: 0, filter: 0, interlace: 0
  buf.writeUInt8(8, 24);
  buf.writeUInt8(6, 25);
  buf.writeUInt8(0, 26);
  buf.writeUInt8(0, 27);
  buf.writeUInt8(0, 28);
  // IHDR CRC
  buf.writeUInt32BE(0, 29);
  // IEND length: 0
  buf.writeUInt32BE(0, 33);
  buf.write('IEND', 37);
  buf.writeUInt32BE(0xae426082, 41);
  return buf;
}

describe('brand icons and ICO writer/reader (brand.md section 3, T025)', () => {
  it('(a) given PNG buffers of 16..256 px, it writes the ICO header and valid directory entries', () => {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = sizes.map((s) => makeMinimalPng(s, s));

    const ico = writeIco(pngBuffers);

    // Header: 6 bytes
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type 1 (icon)
    expect(ico.readUInt16LE(4)).toBe(7); // count 7

    // Directory entries: 16 bytes each
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i]!;
      const offset = 6 + i * 16;
      const expectedDimension = size === 256 ? 0 : size;
      expect(ico.readUInt8(offset)).toBe(expectedDimension); // bWidth
      expect(ico.readUInt8(offset + 1)).toBe(expectedDimension); // bHeight
      expect(ico.readUInt8(offset + 2)).toBe(0); // bColorCount
      expect(ico.readUInt8(offset + 3)).toBe(0); // bReserved

      const bytesInRes = ico.readUInt32LE(offset + 8);
      const imgOffset = ico.readUInt32LE(offset + 12);

      const expectedPng = pngBuffers[i]!;
      expect(bytesInRes).toBe(expectedPng.length);
      expect(imgOffset).toBeGreaterThanOrEqual(6 + 7 * 16);

      // Verify signature at image offset
      const sig = ico.subarray(imgOffset, imgOffset + 8);
      expect(Array.from(sig)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });

  it('(b) it rejects a non-PNG input', () => {
    const invalidBuffer = Buffer.from('not a png image');
    expect(() => writeIco([invalidBuffer])).toThrow(/PNG/i);
  });

  it('(c) the committed build/icon.ico parses with readIco into 7 entries of sizes in brand.md', () => {
    const icoPath = path.join(rootDir, 'build/icon.ico');
    expect(fs.existsSync(icoPath), `build/icon.ico must exist at ${icoPath}`).toBe(true);

    const icoBuffer = fs.readFileSync(icoPath);
    const entries = readIco(icoBuffer);

    const expectedSizes = [16, 24, 32, 48, 64, 128, 256];
    expect(entries).toHaveLength(expectedSizes.length);

    for (let i = 0; i < expectedSizes.length; i++) {
      const entry = entries[i]!;
      const expectedSize = expectedSizes[i]!;
      expect(entry.width).toBe(expectedSize);
      expect(entry.height).toBe(expectedSize);

      // Check PNG signature
      const sig = entry.buffer.subarray(0, 8);
      expect(Array.from(sig)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      // Check IHDR width and height
      const ihdrWidth = entry.buffer.readUInt32BE(16);
      const ihdrHeight = entry.buffer.readUInt32BE(20);
      expect(ihdrWidth).toBe(expectedSize);
      expect(ihdrHeight).toBe(expectedSize);
    }
  });

  it('(d) public/favicon.svg equals logoTileSvg(32)', () => {
    const faviconPath = path.join(rootDir, 'public/favicon.svg');
    expect(fs.existsSync(faviconPath), `public/favicon.svg must exist at ${faviconPath}`).toBe(true);

    const faviconSvg = fs.readFileSync(faviconPath, 'utf8').trim();
    expect(faviconSvg).toBe(logoTileSvg(32).trim());
  });

  it('(e) the review sheet shows each theme on its real surface, in its real ink (themes.css)', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/ui/styles/themes.css'), 'utf8');
    const token = (id: string, name: string) => {
      const start = css.indexOf(`:root[data-theme="${id}"]`);
      const block = start < 0 ? '' : css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
      const line = block.split(';').find((decl) => decl.trim().startsWith(`${name}:`));
      return line?.split(':')[1]?.trim();
    };
    const themed = SHEET_BACKGROUNDS.filter((b) => b.name !== 'White' && b.name !== 'Black');
    expect(themed.map((b) => b.name.toLowerCase())).toEqual(['paper', 'ivory', 'slate', 'night', 'walnut', 'midnight']);
    for (const b of themed) {
      const id = b.name.toLowerCase();
      expect(b.surface, `${id} surface`).toBe(token(id, '--mx-surface'));
      expect(b.ink, `${id} ink`).toBe(token(id, '--mx-ink'));
    }
  });
});
