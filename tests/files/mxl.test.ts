import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readMxl } from '../../src/engine/files/mxl.js';

function createZip(
  entries: { name: string; data: Uint8Array; method?: 'store' | 'deflate'; encrypted?: boolean; zip64?: boolean }[],
): Uint8Array {
  const chunks: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const isDeflate = entry.method === 'deflate';
    const data = isDeflate ? zlib.deflateRawSync(entry.data) : entry.data;

    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(entry.zip64 ? 45 : 20, 4);
    lfh.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    lfh.writeUInt16LE(isDeflate ? 8 : 0, 8);
    lfh.writeUInt32LE(0, 10);
    lfh.writeUInt32LE(0, 14);
    lfh.writeUInt32LE(entry.zip64 ? 0xffffffff : data.length, 18);
    lfh.writeUInt32LE(entry.zip64 ? 0xffffffff : entry.data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    chunks.push(lfh);
    chunks.push(Buffer.from(data));

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(entry.zip64 ? 45 : 20, 6);
    cdh.writeUInt16LE(entry.encrypted ? 1 : 0, 8);
    cdh.writeUInt16LE(isDeflate ? 8 : 0, 10);
    cdh.writeUInt32LE(0, 12);
    cdh.writeUInt32LE(0, 16);
    cdh.writeUInt32LE(entry.zip64 ? 0xffffffff : data.length, 20);
    cdh.writeUInt32LE(entry.zip64 ? 0xffffffff : entry.data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    cdEntries.push(cdh);
    offset += lfh.length + data.length;
  }

  const cdBuf = Buffer.concat(cdEntries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

const enc = new TextEncoder();

describe('readMxl', () => {
  it('reads single rootfile (stored)', async () => {
    const container = enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`);
    const score = enc.encode('<score-partwise></score-partwise>');

    const zip = createZip([
      { name: 'META-INF/container.xml', data: container, method: 'store' },
      { name: 'score.xml', data: score, method: 'store' },
    ]);

    const result = await readMxl(zip);
    expect(new TextDecoder().decode(result)).toBe('<score-partwise></score-partwise>');
  });

  it('reads single rootfile (deflate)', async () => {
    const container = enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<container><rootfiles><rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>`);
    const score = enc.encode('<score-partwise></score-partwise>');

    const zip = createZip([
      { name: 'META-INF/container.xml', data: container, method: 'deflate' },
      { name: 'score.xml', data: score, method: 'deflate' },
    ]);

    const result = await readMxl(zip);
    expect(new TextDecoder().decode(result)).toBe('<score-partwise></score-partwise>');
  });

  it('no container fallback', async () => {
    const score = enc.encode('<score-partwise></score-partwise>');
    const zip = createZip([{ name: 'score.xml', data: score, method: 'deflate' }]);

    const result = await readMxl(zip);
    expect(new TextDecoder().decode(result)).toBe('<score-partwise></score-partwise>');
  });

  it('throws unsupportedArchive on encrypted', async () => {
    const zip = createZip([{ name: 'score.xml', data: enc.encode('test'), encrypted: true }]);
    await expect(readMxl(zip)).rejects.toThrow('Unsupported archive');
  });

  it('throws unsupportedArchive on ZIP64', async () => {
    const zip = createZip([{ name: 'score.xml', data: enc.encode('test'), zip64: true }]);
    await expect(readMxl(zip)).rejects.toThrow('Unsupported archive');
  });

  it('throws on zip bomb over MAX_UNCOMPRESSED_BYTES', async () => {
    // Generate a very compressible payload but large uncompressed size.
    // 257MB of zeros.
    const largeData = Buffer.alloc(257 * 1024 * 1024);
    const zip = createZip([{ name: 'score.xml', data: largeData, method: 'deflate' }]);
    await expect(readMxl(zip)).rejects.toThrow('Archive too large');
    // Deflating 257 MB takes about a second alone but more than the default 5 s when the whole suite runs in parallel (009 T052).
  }, 60_000);

  it('throws on too many entries', async () => {
    const entries = [];
    for (let i = 0; i < 10001; i++) {
      entries.push({ name: `file${i}.txt`, data: enc.encode('test') });
    }
    const zip = createZip(entries);
    await expect(readMxl(zip)).rejects.toThrow('Too many entries');
  });
});
