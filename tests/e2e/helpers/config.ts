import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** A named number from `src/engine/config.ts` (Playwright cannot import that file: it imports package.json). */
export function configNumber(name: string): number {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/engine/config.ts'), 'utf8');
  const match = source.match(new RegExp(`export const ${name} = (\\d+(?:\\.\\d+)?);`));
  if (!match) throw new Error(`${name} not found in src/engine/config.ts`);
  return Number(match[1]);
}
