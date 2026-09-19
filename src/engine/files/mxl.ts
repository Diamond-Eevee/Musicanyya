import { MAX_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRIES } from '../config.js';

export async function readMxl(bytes: Uint8Array): Promise<Uint8Array> {
  const eocdIndex = findEOCD(bytes);
  if (eocdIndex < 0) {
    throw new Error('Unsupported archive');
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cdCount = dv.getUint16(eocdIndex + 10, true);
  if (cdCount > MAX_ZIP_ENTRIES) {
    throw new Error('Too many entries');
  }
  let cdOffset = dv.getUint32(eocdIndex + 16, true);

  const entries: any[] = [];
  for (let i = 0; i < cdCount; i++) {
    if (dv.getUint32(cdOffset, true) !== 0x02014b50) throw new Error('Unsupported archive');
    
    const flags = dv.getUint16(cdOffset + 8, true);
    if ((flags & 1) !== 0) throw new Error('Unsupported archive');

    const method = dv.getUint16(cdOffset + 10, true);
    const compressedSize = dv.getUint32(cdOffset + 20, true);
    const uncompressedSize = dv.getUint32(cdOffset + 24, true);
    const nameLen = dv.getUint16(cdOffset + 28, true);
    const extraLen = dv.getUint16(cdOffset + 30, true);
    const commentLen = dv.getUint16(cdOffset + 32, true);
    const localHeaderOffset = dv.getUint32(cdOffset + 42, true);

    if (uncompressedSize === 0xFFFFFFFF || compressedSize === 0xFFFFFFFF) {
      throw new Error('Unsupported archive');
    }

    const nameBytes = bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  let containerEntry = entries.find(e => e.name === 'META-INF/container.xml');
  let rootFilePath = '';

  if (containerEntry) {
    const containerData = await extractEntry(bytes, dv, containerEntry);
    const containerXml = new TextDecoder('utf-8').decode(containerData);
    const match = containerXml.match(/<rootfile\s+[^>]*full-path=["']([^"']+)["']/i);
    if (match) {
      rootFilePath = match[1];
    }
  } else {
    const fallback = entries.find(e => e.name.endsWith('.xml') || e.name.endsWith('.musicxml'));
    if (fallback) rootFilePath = fallback.name;
  }

  if (!rootFilePath) throw new Error('No rootfile found');

  const rootEntry = entries.find(e => e.name === rootFilePath);
  if (!rootEntry) throw new Error('Rootfile not found in archive');

  return extractEntry(bytes, dv, rootEntry);
}

function findEOCD(bytes: Uint8Array): number {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x05 && bytes[i+3] === 0x06) {
      return i;
    }
  }
  return -1;
}

async function extractEntry(bytes: Uint8Array, dv: DataView, entry: any): Promise<Uint8Array> {
  const lfhOffset = entry.localHeaderOffset;
  if (dv.getUint32(lfhOffset, true) !== 0x04034b50) throw new Error('Unsupported archive');
  const nameLen = dv.getUint16(lfhOffset + 26, true);
  const extraLen = dv.getUint16(lfhOffset + 28, true);
  const dataOffset = lfhOffset + 30 + nameLen + extraLen;

  const data = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.method === 0) {
    return data;
  } else if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(data).catch(() => {});
    writer.close().catch(() => {});
    
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalLength += value.length;
          if (totalLength > MAX_UNCOMPRESSED_BYTES) {
            throw new Error('Archive too large');
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock();
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } else {
    throw new Error('Unsupported archive');
  }
}
