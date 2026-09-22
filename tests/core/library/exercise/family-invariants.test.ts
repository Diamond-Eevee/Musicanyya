import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateTriadFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(__dirname, '../../../../content/library/exercises');

function loadDefinition(fileName: string): ExerciseDefinition {
  return JSON.parse(fs.readFileSync(path.join(contentDir, fileName), 'utf-8')) as ExerciseDefinition;
}

/** FR-005: every key in the triads family shares measure count, chord onset ticks, durations and
 *  fingering sequence - only pitches and the key signature may differ. tests/core/library/exercise/
 *  goldens.test.ts only samples four keys; this is the direct test across all 24 (analyze A2). */
describe('triads family invariants across all 24 keys (FR-005)', () => {
  const majorDef = loadDefinition('triads-major.json');
  const minorDef = loadDefinition('triads-minor.json');
  const allItems = [...generateTriadFamily(majorDef, '2026-09-22'), ...generateTriadFamily(minorDef, '2026-09-22')];

  it('generates exactly 24 items', () => {
    expect(allItems).toHaveLength(24);
  });

  interface Shape {
    measureCount: number;
    onsets: Array<{ measureIndex: number; onsetInMeasure: number; staff: number; durationTicks: number }>;
    fingerings: readonly (1 | 2 | 3 | 4 | 5 | null)[];
  }

  function shapeOf(xml: string): Shape {
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    const notes = [...(score.parts[0]?.notes ?? [])].sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
      if (a.onsetInMeasure !== b.onsetInMeasure) return a.onsetInMeasure - b.onsetInMeasure;
      if (a.staff !== b.staff) return a.staff - b.staff;
      return a.soundingKey - b.soundingKey;
    });
    return {
      measureCount: score.measures.length,
      onsets: notes.map((n) => ({
        measureIndex: n.measureIndex,
        onsetInMeasure: n.onsetInMeasure,
        staff: n.staff,
        durationTicks: n.durationTicks,
      })),
      fingerings: notes.map((n) => n.fingerings[0]?.finger ?? null),
    };
  }

  const shapes = allItems.map((item) => ({ key: item.fileStem, shape: shapeOf(item.xml) }));
  const [reference, ...rest] = shapes;
  if (!reference) throw new Error('Expected at least one generated item');

  it('has no null fingerings (every note is fingered, FR-006)', () => {
    for (const { key, shape } of shapes) {
      expect(
        shape.fingerings.every((f) => f !== null),
        `${key} has an unfingered note`,
      ).toBe(true);
    }
  });

  for (const { key, shape } of rest) {
    it(`${key}: same measure count, onsets, durations and fingering sequence as ${reference.key}`, () => {
      expect(shape.measureCount).toBe(reference.shape.measureCount);
      expect(shape.onsets).toEqual(reference.shape.onsets);
      expect(shape.fingerings).toEqual(reference.shape.fingerings);
    });
  }

  it('pitches differ from key to key (it is not the same file 24 times)', () => {
    const [first, second] = allItems;
    if (!first || !second) throw new Error('Expected at least two generated items');
    const { doc } = readXml(first.xml);
    const { score: cScore } = buildScore(doc);
    const { doc: doc2 } = readXml(second.xml);
    const { score: gScore } = buildScore(doc2);
    const cPitches = cScore.parts[0]?.notes.map((n) => n.soundingKey);
    const gPitches = gScore.parts[0]?.notes.map((n) => n.soundingKey);
    expect(cPitches).not.toEqual(gPitches);
  });
});
