import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAX_FILE_BYTES } from '../../src/core/defaults.js';
import { deriveFacts } from '../../src/core/library/facts.js';
import { validMetadata } from '../../src/core/library/index-model.js';
import { checkLevel } from '../../src/core/library/levels.js';
import type { LibraryIndex, LibraryItem, LibrarySection } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { hashFile } from '../../src/engine/files/hash.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { LIBRARY_SECTIONS } from './sections.js';

export interface BuildLibraryIndexResult {
  index: LibraryIndex;
  /** Non-empty means generation failed (data-model.md §3): a missing/invalid sidecar, a file that
   *  does not load, a silent item, or a file outside any declared section. No placeholders (AGENTS.md
   *  §4) - a problem stops the item from being listed rather than listing it half-formed. */
  problems: string[];
}

function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function walkScoreFiles(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkScoreFiles(full, base));
    } else if (/\.(musicxml|mxl)$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

function sectionIdForFile(relFile: string): string | null {
  const dir = relFile.split('/').slice(0, -1).join('/');
  return LIBRARY_SECTIONS.find((s) => s.path === dir)?.id ?? null;
}

/** Walks `libraryRoot`, validates every sidecar, loads every score through the app's own `readXml` +
 *  `buildScore` (never a second, looser parser) and derives its facts, then produces the index the
 *  app reads (contracts/library-index.md §2, §4). Importable so `tests/library/*.test.ts` can call it
 *  directly, and runnable as `pnpm library:index` (the block at the bottom of this file). */
export async function buildLibraryIndex(libraryRoot: string): Promise<BuildLibraryIndexResult> {
  const problems: string[] = [];
  const items: LibraryItem[] = [];

  for (const relFile of walkScoreFiles(libraryRoot)) {
    const sidecarRelPath = relFile.replace(/\.(musicxml|mxl)$/i, '.json');
    const sidecarFullPath = path.join(libraryRoot, sidecarRelPath);
    if (!fs.existsSync(sidecarFullPath)) {
      problems.push(`${relFile}: missing sidecar ${sidecarRelPath}`);
      continue;
    }

    let rawMeta: unknown;
    try {
      rawMeta = JSON.parse(fs.readFileSync(sidecarFullPath, 'utf-8'));
    } catch (err) {
      problems.push(`${sidecarRelPath}: invalid JSON (${String(err)})`);
      continue;
    }
    const meta = validMetadata(rawMeta);
    if (!meta) {
      problems.push(`${sidecarRelPath}: fails the item-metadata schema (contracts/library-index.md §1)`);
      continue;
    }

    const sectionId = sectionIdForFile(relFile);
    if (!sectionId) {
      problems.push(`${relFile}: its folder is not one of tools/library/sections.ts's declared sections`);
      continue;
    }

    const fileBuffer = fs.readFileSync(path.join(libraryRoot, relFile));
    if (fileBuffer.byteLength === 0) {
      problems.push(`${relFile}: the file is empty`);
      continue;
    }
    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      problems.push(`${relFile}: ${fileBuffer.byteLength} bytes exceeds MAX_FILE_BYTES`);
      continue;
    }

    let rawBytes = toUint8Array(fileBuffer);
    if (relFile.toLowerCase().endsWith('.mxl')) {
      try {
        rawBytes = await readMxl(rawBytes);
      } catch (err) {
        problems.push(`${relFile}: could not open the .mxl archive (${String(err)})`);
        continue;
      }
    }

    let facts: ReturnType<typeof deriveFacts>;
    try {
      const xmlString = decodeXml(rawBytes);
      const { doc } = readXml(xmlString);
      const { score, report } = buildScore(doc);
      const { timeline, notices: timelineNotices } = buildTimeline(score);
      facts = deriveFacts({ doc, score, timeline, report, timelineNotices });
    } catch (err) {
      problems.push(`${relFile}: failed to load (${String(err)})`);
      continue;
    }

    if (facts.notes === 0) {
      problems.push(`${relFile}: silent - it parses but has no sounding note (FR-021)`);
      continue;
    }
    if (meta.kind === 'exercise' && facts.fingeringCoverage !== 1) {
      problems.push(
        `${relFile}: fingeringCoverage ${facts.fingeringCoverage} - every note of an exercise needs a fingering (FR-006)`,
      );
    }
    if (meta.arrangement) {
      const label = `${meta.title} ${meta.subtitle ?? ''}`.toLowerCase();
      if (!label.includes('arrange')) {
        problems.push(`${relFile}: arrangement: true but "arrangement" is not in the title or subtitle (FR-007)`);
      }
    }

    const levelCheck = checkLevel(facts, meta.level, {
      ...(meta.raisedBecause !== undefined ? { raisedBecause: meta.raisedBecause } : {}),
      expectedNotices: meta.expected?.notices ?? [],
      kind: meta.kind,
      ...(meta.arrangement !== undefined ? { arrangement: meta.arrangement } : {}),
    });
    if (!levelCheck.pass) {
      problems.push(
        `${relFile}: level check failed for "${meta.level}" - failed criteria [${levelCheck.failed.join(', ')}] (data-model.md §4)`,
      );
    }

    const hash = await hashFile(rawBytes.slice(0));
    const id = relFile.replace(/\.(musicxml|mxl)$/i, '');
    items.push({ id, section: sectionId, file: relFile, bytes: fileBuffer.byteLength, hash, meta, facts, levelCheck });
  }

  const usedSectionIds = new Set(items.map((i) => i.section));
  const sections: LibrarySection[] = LIBRARY_SECTIONS.filter((s) => usedSectionIds.has(s.id)).map((s) => ({ ...s }));

  const index: LibraryIndex = {
    version: 1,
    generated: new Date().toISOString(),
    sections,
    items: items.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return { index, problems };
}

async function main() {
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const { index, problems } = await buildLibraryIndex(libraryRoot);

  if (problems.length > 0) {
    console.error(`Library index generation failed (${problems.length} problem(s)):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  const outPath = path.join(libraryRoot, 'index.json');
  fs.writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    `Wrote ${path.relative(process.cwd(), outPath)}: ${index.items.length} items, ${index.sections.length} sections.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
