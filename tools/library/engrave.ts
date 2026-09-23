import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyInserts, planEngraving } from '../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { decodeXml } from '../../src/engine/files/decode.js';

export interface EngraveFileResult {
  beamGroupsAdded: number;
  accidentalsAdded: { required: number; courtesy: number };
}

/** Completes one MusicXML file in place: read -> plan('library') -> apply -> write back. A no-op
 *  (file unchanged) when the plan is already empty. */
export function engraveFile(filePath: string): EngraveFileResult {
  const xml = decodeXml(fs.readFileSync(filePath));
  const { doc } = readXml(xml);
  const plan = planEngraving(doc, 'library');

  if (plan.inserts.length > 0) {
    fs.writeFileSync(filePath, applyInserts(xml, plan.inserts));
  }

  return { beamGroupsAdded: plan.beamGroupsAdded, accidentalsAdded: plan.accidentalsAdded };
}

function findMusicXmlFiles(dir: string, base: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findMusicXmlFiles(full, base));
    } else if (/\.musicxml$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

export interface EngraveLibraryResult {
  /** Hand-written repertoire files that changed. */
  engraved: string[];
  /** Generated family files under `learning/` this tool never touches (the exercise generator
   *  completes those itself, `library:exercises`). */
  skipped: string[];
}

/** Completes every hand-written repertoire file under `libraryRoot`; never touches `learning/**`
 *  (generated exercise families - `pnpm library:exercises` completes those on its own). */
export function engraveLibrary(libraryRoot: string): EngraveLibraryResult {
  const engraved: string[] = [];
  for (const relFile of findMusicXmlFiles(path.join(libraryRoot, 'repertoire'), libraryRoot)) {
    const result = engraveFile(path.join(libraryRoot, relFile));
    if (result.beamGroupsAdded > 0 || result.accidentalsAdded.required > 0 || result.accidentalsAdded.courtesy > 0) {
      engraved.push(relFile);
    }
  }
  const skipped = findMusicXmlFiles(path.join(libraryRoot, 'learning'), libraryRoot);
  return { engraved, skipped };
}

function main() {
  const libraryRoot = fileURLToPath(new URL('../../public/library/', import.meta.url));
  const { engraved, skipped } = engraveLibrary(libraryRoot);
  for (const file of engraved) console.log(`engraved: ${file}`);
  console.log(
    `Completed ${engraved.length} repertoire file(s); ${skipped.length} generated family file(s) under learning/ left for library:exercises.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
