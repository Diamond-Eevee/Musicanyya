// Feature 014: only the 59 in-scope items (54 key-change items, 5 chord-change drills) may change. Every other file
// under public/library/ - the per-key steps, Songs, Repertoire, README.md - must stay byte-identical (FR-003,
// SC-004). Hashes recorded at commit 7f8ab96, before any 014 authoring task touched the shelf; an item added to the shelf
// later is recorded with its hash when it is added (017 T022: the two Petzold minuets and the Musette, BWV Anh. 114,
// 115, 126), so it is held unchanged from then on. The two minuet sidecars were re-recorded in 017 T055, when the
// realised inverted mordent made their `expected` notice and `limitations` obsolete. The Bach prelude BWV 846 sidecar
// and the Silent Night and O Come O Come Emmanuel song sidecars were re-recorded in 022 T010 and T013, when the retired
// level criteria made them need a `raisedBecause` to keep their level (FR-006). The seven song sidecars whose left hand
// plays repeated or broken chords were re-recorded in 022 T072 (constitution audit F9), when their first departure was
// corrected from "... chords ... is our own" to "... are our own".
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import hashes from './out-of-scope-hashes.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const libRoot = path.join(root, 'public/library');

function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

describe('library files held unchanged (014 scope guard, and items added later)', () => {
  const recordedFiles = Object.keys(hashes as Record<string, string>);
  const recordedSet = new Set(recordedFiles);

  it('the recorded set is still exactly every non-in-scope file on the shelf', () => {
    const current = filesUnder(libRoot)
      .map((f) => path.relative(libRoot, f).split(path.sep).join('/'))
      .filter((rel) => rel !== 'index.json');
    const inScope = current.filter((rel) => !recordedSet.has(rel));
    expect(current.length - inScope.length).toBe(recordedFiles.length);
    expect(inScope.length).toBe(118); // 54 key-change items + 5 drills, .json + .musicxml
  });

  it.each(recordedFiles)('%s is byte-identical to its recorded hash (commit 7f8ab96, or when it was added)', (rel) => {
    expect(sha256(path.join(libRoot, rel))).toBe((hashes as Record<string, string>)[rel]);
  });
});
