// pnpm library:orchestra <item-id> [--check] (contract fidelity-tools.md 1.14.0 section 1, orchestration-definition.md section 2):
// writes a library item's Orchestra parts from content/library/orchestra/<item-slug>.json into public/library/<item-id>.musicxml,
// after every check (O1-O3 and O5) passes. `--check` writes nothing and exits 1 when the committed file differs from a fresh
// generation (the regeneration test, rule O4).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkOrchestra } from '../fidelity/orchestra';
import { DefinitionError, parseDefinition } from './definition';
import { GenerateError, generateOrchestra } from './generate';

export interface CliIo {
  /** The repository root. */
  root: string;
  out: (line: string) => void;
}

const USAGE = 'usage: pnpm library:orchestra <item-id> [--check]';

/** Where an item's definition lives: its last path segment is the slug (`repertoire/listening/grieg-morning-mood`). */
export const definitionPath = (root: string, itemId: string): string =>
  join(root, 'content/library/orchestra', `${basename(itemId)}.json`);

export function main(args: string[], io: CliIo): number {
  const check = args.includes('--check');
  const rest = args.filter((a) => a !== '--check');
  if (rest.length !== 1 || (rest[0] as string).startsWith('--')) {
    io.out(USAGE);
    return 2;
  }
  const itemId = rest[0] as string;
  try {
    return run(itemId, check, io);
  } catch (e) {
    if (e instanceof DefinitionError || e instanceof GenerateError) io.out(`error: ${e.message}`);
    else io.out(`error: ${(e as Error).message}`);
    return 1;
  }
}

function run(itemId: string, check: boolean, io: CliIo): number {
  const itemFile = join(io.root, 'public/library', `${itemId}.musicxml`);
  const definitionFile = definitionPath(io.root, itemId);
  if (!existsSync(itemFile)) {
    io.out(`no library item "${itemId}" (public/library/${itemId}.musicxml does not exist)`);
    return 1;
  }
  if (!existsSync(definitionFile)) {
    io.out(`no orchestration definition for "${itemId}" (${definitionFile.slice(io.root.length + 1)} does not exist)`);
    return 1;
  }
  const definition = parseDefinition(JSON.parse(readFileSync(definitionFile, 'utf8')));
  if (definition.itemId !== itemId) {
    io.out(`the definition is for "${definition.itemId}", not "${itemId}"`);
    return 1;
  }
  const committed = readFileSync(itemFile, 'utf8');
  const { xml, notes } = generateOrchestra(committed, definition);

  if (check) {
    if (xml !== committed) {
      io.out(
        `${itemId}: the Orchestra parts differ from a fresh generation from the definition (run pnpm library:orchestra ${itemId})`,
      );
      return 1;
    }
    io.out(`${itemId}: the Orchestra parts equal a fresh generation`);
    return 0;
  }

  // Everything but the regeneration rule, which holds by construction here
  const findings = checkOrchestra(xml, definition).filter((f) => f.rule !== 'O4');
  if (findings.length > 0) {
    for (const f of findings) io.out(`  ${f.rule}: ${f.detail}`);
    io.out(`${itemId}: nothing written - ${findings.length} finding${findings.length === 1 ? '' : 's'}`);
    return 1;
  }
  if (xml === committed) {
    io.out(`${itemId}: unchanged (${notes} doubled notes, ${definition.instruments.length} instruments)`);
    return 0;
  }
  writeFileSync(itemFile, xml, 'utf8');
  io.out(`${itemId}: wrote ${definition.instruments.length} Orchestra parts (${notes} doubled notes)`);
  io.out('next: pnpm library:engrave, pnpm library:index, pnpm library:fidelity');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), { root: process.cwd(), out: (line) => console.log(line) });
}
