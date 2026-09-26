import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateFamily } from '../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../src/core/library/exercise/types.js';
import { hashFile } from '../../src/engine/files/hash.js';
import { keepStamps } from './stamps.js';
import { SUCCESSORS } from './successors.js';

/** Reads every `content/library/exercises/*.json` definition (contracts/exercise-definition.md, 1.1.0) and
 *  writes each generated item's `.musicxml` + `.json` pair into `public/library/<section>/` (data-model.md §2; the section
 *  and file stem come from the definition, `{key}` / `{pair}` resolved per item). A sidecar gets `supersedes: [{id, hash}]`
 *  when its definition names old items: the ids must be in the successor table (`successors.ts`) under this very item's
 *  id, and the hash is the table's - checked against the old file when it is still on disk. Never touches an item whose
 *  sidecar already says `provenance.origin` is `downloaded` (contracts/exercise-definition.md §2.6) - this tool only ever
 *  writes files it also generated. Importable so tests can call it directly; runnable as `pnpm library:exercises`. */
export interface BuildExercisesResult {
  written: string[];
  skipped: string[];
}

/** `supersedes` for one item, from the successor table (the single source, data-model.md §7). Throws when a definition
 *  names an old id the table does not know, or the table says another item replaces it, or the old file on disk has
 *  changed since the table was recorded. */
async function supersedesOf(
  itemId: string,
  oldIds: readonly string[],
  libraryRoot: string,
): Promise<{ id: string; hash: string }[]> {
  const out: { id: string; hash: string }[] = [];
  for (const oldId of oldIds) {
    const successor = SUCCESSORS.find((s) => s.oldId === oldId);
    if (!successor) throw new Error(`${itemId}: supersedes ${oldId}, which is not in tools/library/successors.ts`);
    if (successor.newId !== itemId) {
      throw new Error(`${itemId}: supersedes ${oldId}, but the successor table says ${successor.newId} replaces it`);
    }
    const oldFile = path.join(libraryRoot, `${oldId}.musicxml`);
    if (fs.existsSync(oldFile)) {
      const onDisk = await hashFile(new Uint8Array(fs.readFileSync(oldFile)));
      if (onDisk !== successor.hash) {
        throw new Error(`${itemId}: the old file ${oldId} on disk no longer has the SHA-256 recorded in successors.ts`);
      }
    }
    out.push({ id: oldId, hash: successor.hash });
  }
  return out;
}

export async function buildExercises(
  contentDir: string,
  libraryRoot: string,
  generatedOn: string,
): Promise<BuildExercisesResult> {
  const written: string[] = [];
  const skipped: string[] = [];

  const definitionFiles = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const file of definitionFiles) {
    const definition = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;

    for (const item of generateFamily(definition, generatedOn)) {
      const sectionDir = path.join(libraryRoot, item.section);
      fs.mkdirSync(sectionDir, { recursive: true });
      const xmlPath = path.join(sectionDir, `${item.fileStem}.musicxml`);
      const sidecarPath = path.join(sectionDir, `${item.fileStem}.json`);

      if (fs.existsSync(sidecarPath)) {
        const existing = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')) as { provenance?: { origin?: string } };
        if (existing.provenance?.origin === 'downloaded') {
          skipped.push(path.relative(libraryRoot, sidecarPath));
          continue;
        }
      }

      const supersedes = await supersedesOf(`${item.section}/${item.fileStem}`, item.supersedes, libraryRoot);
      const stamped = keepStamps(item.meta, sidecarPath, generatedOn);
      const meta = supersedes.length > 0 ? { ...stamped, supersedes } : stamped;
      fs.writeFileSync(xmlPath, item.xml);
      fs.writeFileSync(sidecarPath, `${JSON.stringify(meta, null, 2)}\n`);
      written.push(path.relative(libraryRoot, xmlPath));
    }
  }

  return { written, skipped };
}

async function main() {
  const contentDir = fileURLToPath(new URL('../../content/library/exercises/', import.meta.url));
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const generatedOn = new Date().toISOString().slice(0, 10);

  const { written, skipped } = await buildExercises(contentDir, libraryRoot, generatedOn);

  console.log(`Wrote ${written.length} generated item(s).`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} downloaded item(s) with a matching file stem:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(String(err));
    process.exitCode = 1;
  });
}
