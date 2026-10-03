// pnpm library:lessons [--lesson <id>] (contract lesson-definition 1.0.0 §4, feature 022): builds the Basics and chord
// lessons from content/library/lessons/*.json. Every definition is validated and built in memory first; on any error
// nothing is written and the command exits 1, naming the file, the bar and the token. Then each item's .musicxml and
// sidecar are written under public/library/, keeping the `created` stamps of unchanged items.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LessonDefinitionError, validateLessonDefinition } from './lessons/definition.js';
import { type BuiltLesson, buildLessonItems } from './lessons/write.js';
import { keepStamps } from './stamps.js';

const LEVEL_RANK: Readonly<Record<string, number>> = { introduction: 0, beginner: 1, intermediate: 2, advanced: 3 };

/** Validates and builds every definition in `contentDir`, then writes them into `libraryRoot` (only `only` when given);
 *  returns the written .musicxml paths relative to `libraryRoot`. Throws LessonDefinitionError before writing anything. */
export async function buildLessons(
  contentDir: string,
  libraryRoot: string,
  generatedOn: string,
  only?: string,
): Promise<string[]> {
  const built: BuiltLesson[] = [];
  for (const file of readdirSync(contentDir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    try {
      const definition = validateLessonDefinition(JSON.parse(readFileSync(join(contentDir, file), 'utf8')));
      built.push(...buildLessonItems(definition, file, generatedOn));
    } catch (e) {
      const detail = (e as Error).message.replace(/^lesson definition: /, '');
      throw new LessonDefinitionError(`${file}: ${detail}`);
    }
  }

  // The rules across definitions (§4 step 1): unique ids and stepOrder per section; a simplified lesson's target exists
  // and is harder
  const byId = new Map<string, BuiltLesson>();
  const stepOrders = new Map<string, string>();
  for (const item of built) {
    if (byId.has(item.id)) throw new LessonDefinitionError(`two definitions write ${item.id}`);
    byId.set(item.id, item);
    const key = `${item.section}|${item.stepOrder}`;
    const other = stepOrders.get(key);
    if (other !== undefined)
      throw new LessonDefinitionError(
        `${item.section}: stepOrder ${item.stepOrder} is used by ${other} and ${item.id}`,
      );
    stepOrders.set(key, item.id);
  }
  for (const item of built) {
    if (item.simplifies === undefined) continue;
    const target = byId.get(item.simplifies);
    if (!target)
      throw new LessonDefinitionError(`${item.id}: simplifies ${item.simplifies}, which no definition writes`);
    if ((LEVEL_RANK[target.level] ?? 0) <= (LEVEL_RANK[item.level] ?? 0))
      throw new LessonDefinitionError(
        `${item.id}: simplifies ${item.simplifies}, which is ${target.level} - it needs a higher level than ${item.level}`,
      );
  }

  const selected = only === undefined ? built : built.filter((item) => item.id === only);
  if (only !== undefined && selected.length === 0) throw new LessonDefinitionError(`no lesson has the id ${only}`);
  for (const item of selected) {
    const sidecarPath = join(libraryRoot, `${item.id}.json`);
    if (existsSync(sidecarPath)) {
      const existing = JSON.parse(readFileSync(sidecarPath, 'utf8')) as { provenance?: { origin?: string } };
      if (existing.provenance?.origin === 'downloaded')
        throw new LessonDefinitionError(`${item.id}: a downloaded item is there; a lesson never replaces it`);
    }
  }

  const written: string[] = [];
  for (const item of selected) {
    const xmlPath = join(libraryRoot, `${item.id}.musicxml`);
    mkdirSync(dirname(xmlPath), { recursive: true });
    writeFileSync(xmlPath, item.xml);
    const sidecarPath = join(libraryRoot, `${item.id}.json`);
    const sidecar = keepStamps(item.sidecar, sidecarPath, generatedOn);
    writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
    written.push(`${item.id}.musicxml`);
  }
  return written;
}

export interface LessonsCommand {
  contentDir: string;
  libraryRoot: string;
  generatedOn: string;
  only?: string;
}

/** The command: exit code 0 and what was written, or 1 and why nothing was. */
export async function runLessonsCommand(command: LessonsCommand): Promise<{ code: number; message: string }> {
  try {
    const written = await buildLessons(command.contentDir, command.libraryRoot, command.generatedOn, command.only);
    return { code: 0, message: `Wrote ${written.length} lesson item(s).` };
  } catch (e) {
    return { code: 1, message: `error: ${(e as Error).message}` };
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const at = args.indexOf('--lesson');
  const only = at >= 0 ? args[at + 1] : undefined;
  if (at >= 0 && only === undefined) {
    console.log('usage: pnpm library:lessons [--lesson <id>]');
    return 2;
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const contentDir = join(root, 'content/library/lessons');
  if (!existsSync(contentDir)) {
    console.log('no content/library/lessons folder: nothing to build');
    return 0;
  }
  const result = await runLessonsCommand({
    contentDir,
    libraryRoot: join(root, 'public/library'),
    generatedOn: new Date().toISOString().slice(0, 10),
    ...(only !== undefined ? { only } : {}),
  });
  console.log(result.message);
  return result.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
