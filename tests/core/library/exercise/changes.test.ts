import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateChangeFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Feature 011 retired eight of these definitions from content/library/exercises (the generated steps replace them); they stay
// as fixtures of the 1.0.0 `chords` form so the generator keeps its tests (tests/fixtures/exercises/README.md). The five that
// keep their music (I-V-vi-IV, turnaround, diatonic ladder, the two same-tonic drills) are still shelf content.
const directories = [
  path.join(__dirname, '../../../fixtures/exercises'),
  path.join(__dirname, '../../../../content/library/exercises'),
];

const changeFiles = directories.flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('changes-'))
    .map((f) => path.join(dir, f)),
);

function load(file: string): ExerciseDefinition {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as ExerciseDefinition;
}

describe('chord-change drills (data-model.md §5.2)', () => {
  it('at least 12 drills are defined across all changes-*.json files (FR-004/SC-004)', () => {
    let total = 0;
    for (const file of changeFiles) total += load(file).keys?.length ?? 0;
    expect(changeFiles.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(12);
  });

  for (const file of changeFiles) {
    it(`${path.basename(file)}: generates loadable MusicXML with no unexpected notices and full fingering coverage`, () => {
      const def = load(file);
      const items = generateChangeFamily(def, '2026-09-22');
      expect(items.length).toBe(def.keys?.length ?? 0);
      for (const item of items) {
        const { doc } = readXml(item.xml);
        const { score, report } = buildScore(doc);
        const unexpected = report.entries.filter((e) => e.code !== 'defaultTempo');
        expect(unexpected, `${item.fileStem}: ${JSON.stringify(unexpected)}`).toEqual([]);
        const notes = score.parts[0]?.notes ?? [];
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.every((n) => n.fingerings.length === 1)).toBe(true);
        expect(score.navigation.repeats.length).toBeGreaterThanOrEqual(1);
      }
    });
  }
});
