import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { GeneratedExerciseItem } from '../../src/core/library/exercise/generate.js';
import { generateChangeFamily, generateTriadFamily } from '../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../src/core/library/exercise/types.js';

/** Reads every `content/library/exercises/*.json` definition (contracts/exercise-definition.md) and
 *  writes each generated item's `.musicxml` + `.json` pair into `public/library/`
 *  (data-model.md §2). Never touches an item whose sidecar already says `provenance.origin` is
 *  `downloaded` (contracts/exercise-definition.md §2.6) - this tool only ever writes files it also
 *  generated. Importable so `tests/library/extensibility.test.ts`-style checks can call it directly;
 *  runnable as `pnpm library:exercises`. */
export interface BuildExercisesResult {
  written: string[];
  skipped: string[];
}

function isChangeFamily(definition: ExerciseDefinition): boolean {
  return definition.family.startsWith('changes');
}

function generateFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  return isChangeFamily(definition)
    ? generateChangeFamily(definition, generatedOn)
    : generateTriadFamily(definition, generatedOn);
}

export function buildExercises(contentDir: string, libraryRoot: string, generatedOn: string): BuildExercisesResult {
  const written: string[] = [];
  const skipped: string[] = [];

  const definitionFiles = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const file of definitionFiles) {
    const definition = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;
    const sectionDir = path.join(libraryRoot, definition.section);
    fs.mkdirSync(sectionDir, { recursive: true });

    for (const item of generateFamily(definition, generatedOn)) {
      const xmlPath = path.join(sectionDir, `${item.fileStem}.musicxml`);
      const sidecarPath = path.join(sectionDir, `${item.fileStem}.json`);

      if (fs.existsSync(sidecarPath)) {
        const existing = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')) as { provenance?: { origin?: string } };
        if (existing.provenance?.origin === 'downloaded') {
          skipped.push(path.relative(libraryRoot, sidecarPath));
          continue;
        }
      }

      fs.writeFileSync(xmlPath, item.xml);
      fs.writeFileSync(sidecarPath, `${JSON.stringify(item.meta, null, 2)}\n`);
      written.push(path.relative(libraryRoot, xmlPath));
    }
  }

  return { written, skipped };
}

async function main() {
  const contentDir = fileURLToPath(new URL('../../content/library/exercises/', import.meta.url));
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const generatedOn = new Date().toISOString().slice(0, 10);

  const { written, skipped } = buildExercises(contentDir, libraryRoot, generatedOn);

  console.log(`Wrote ${written.length} generated item(s).`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} downloaded item(s) with a matching file stem:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
