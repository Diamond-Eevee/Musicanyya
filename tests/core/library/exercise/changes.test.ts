import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateChangeFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(__dirname, '../../../../content/library/exercises');

const changeFiles = fs.readdirSync(contentDir).filter((f) => f.startsWith('changes-'));

describe('chord-change drills (data-model.md §5.2)', () => {
  it('at least 12 drills are defined across all changes-*.json files (FR-004/SC-004)', () => {
    let total = 0;
    for (const file of changeFiles) {
      const def = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;
      total += def.keys.length;
    }
    expect(changeFiles.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(12);
  });

  for (const file of changeFiles) {
    it(`${file}: generates loadable MusicXML with no unexpected notices and full fingering coverage`, () => {
      const def = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;
      const items = generateChangeFamily(def, '2026-09-22');
      expect(items.length).toBe(def.keys.length);
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
