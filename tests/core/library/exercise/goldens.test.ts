import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  generateKeyChangeFamily,
  generatePatternFamily,
  generateTriadFamily,
} from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { readXml } from '../../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The 1.0.0 triads definitions live in tests/fixtures/exercises since feature 011 retired them from the shelf; the step
// definitions are the shelf's own content.
const fixtureDir = path.join(__dirname, '../../../fixtures/exercises');
const contentDir = path.join(__dirname, '../../../../content/library/exercises');

function loadDefinition(fileName: string): ExerciseDefinition {
  const dir = fileName.startsWith('step-') || fileName.startsWith('key-change-') ? contentDir : fixtureDir;
  return JSON.parse(fs.readFileSync(path.join(dir, fileName), 'utf-8')) as ExerciseDefinition;
}

const majorDef = loadDefinition('triads-major.json');
const minorDef = loadDefinition('triads-minor.json');

function onlyKey(def: ExerciseDefinition, tonic: string): ExerciseDefinition {
  const key = def.keys?.find((k) => k.tonic === tonic);
  if (!key) throw new Error(`No key ${tonic} in ${def.family}`);
  return { ...def, keys: [key] };
}

/** `def.keys` always has exactly one entry after `onlyKey`, so this never actually throws - it just
 *  gives the test a typed, non-optional item without a non-null assertion. */
function single<T>(items: readonly T[]): T {
  if (items.length !== 1) throw new Error(`Expected exactly one item, got ${items.length}`);
  const [item] = items;
  if (item === undefined) throw new Error('Unreachable');
  return item;
}

describe('triad family goldens (contracts/exercise-definition.md §3)', () => {
  const cases: Array<[string, ExerciseDefinition]> = [
    ['C major', onlyKey(majorDef, 'C')],
    ['F# major', onlyKey(majorDef, 'F#')],
    ['A minor', onlyKey(minorDef, 'A')],
    ['Eb minor', onlyKey(minorDef, 'Eb')],
  ];

  for (const [label, def] of cases) {
    it(`generates deterministic, round-trippable MusicXML for ${label}`, () => {
      const item = single(generateTriadFamily(def, '2026-09-22'));
      expect(item.xml).toMatchSnapshot();

      const { doc } = readXml(item.xml);
      const { score, report } = buildScore(doc);
      const unexpected = report.entries.filter((e) => e.code !== 'defaultTempo');
      expect(unexpected).toEqual([]);
      expect(score.parts[0]?.notes.length).toBeGreaterThan(0);
      // Every generated note carries exactly one fingering (FR-006).
      expect(score.parts[0]?.notes.every((n) => n.fingerings.length === 1)).toBe(true);
    });
  }

  it('regenerating the same definition is byte-identical (determinism)', () => {
    const def = onlyKey(majorDef, 'C');
    const a = single(generateTriadFamily(def, '2026-09-22'));
    const b = single(generateTriadFamily(def, '2026-09-22'));
    expect(a.xml).toBe(b.xml);
    expect(a.meta).toEqual(b.meta);
  });
});

// Feature 011 T019: the four step definitions (contract exercise-definition 1.1) in the keys that stress the spelling
// and the register - C major, F# major (6 sharps), G# minor (F double sharp) and Eb minor (6 flats).
describe('step family goldens (feature 011, pattern form)', () => {
  const steps = ['introduction', 'beginner', 'intermediate', 'advanced'] as const;
  const keyCases: Array<[string, string, 'major' | 'minor']> = [
    ['C major', 'C', 'major'],
    ['F# major', 'F#', 'major'],
    ['G# minor', 'G#', 'minor'],
    ['Eb minor', 'Eb', 'minor'],
  ];

  for (const step of steps) {
    const definition = loadDefinition(`step-${step}.json`);
    for (const [label, tonic, mode] of keyCases) {
      it(`generates deterministic, round-trippable MusicXML for ${label} ${step}`, () => {
        const key = definition.keys?.find((k) => k.tonic === tonic && k.mode === mode);
        if (!key) throw new Error(`No key ${label} in step-${step}`);
        const item = single(generatePatternFamily({ ...definition, keys: [key] }, '2026-09-26'));
        expect(item.xml).toMatchSnapshot();

        const { doc } = readXml(item.xml);
        const { score, report } = buildScore(doc);
        expect(report.entries).toEqual([]);
        expect(score.parts[0]?.notes.length).toBeGreaterThan(0);
        expect(score.parts[0]?.notes.every((n) => n.fingerings.length === 1)).toBe(true);
        const again = single(generatePatternFamily({ ...definition, keys: [key] }, '2026-09-26'));
        expect(again.xml).toBe(item.xml);
      });
    }
  }
});

// Feature 011 T042: three key-change pairs (a relative change with an unchanged signature, a parallel change that
// drops three flats, a relative change that adds sharps) for each of the three steps.
describe('key-change family goldens (feature 011, key-change form)', () => {
  const steps = ['introduction', 'beginner', 'intermediate'] as const;
  const pairCases: Array<[string, 'relative' | 'parallel', string, string, string, string]> = [
    ['c-major-to-a-minor', 'relative', 'C', 'major', 'A', 'minor'],
    ['c-minor-to-c-major', 'parallel', 'C', 'minor', 'C', 'major'],
    ['d-major-to-b-minor', 'relative', 'D', 'major', 'B', 'minor'],
  ];

  for (const step of steps) {
    for (const [slug, relation, fromTonic, fromMode, toTonic, toMode] of pairCases) {
      it(`generates deterministic, round-trippable MusicXML for ${slug} ${step}`, () => {
        const definition = loadDefinition(`key-change-${relation}-${step}.json`);
        const pair = definition.keyPairs?.find(
          (p) =>
            p.from.tonic === fromTonic && p.from.mode === fromMode && p.to.tonic === toTonic && p.to.mode === toMode,
        );
        if (!pair) throw new Error(`No pair ${slug} in key-change-${relation}-${step}`);
        const item = single(generateKeyChangeFamily({ ...definition, keyPairs: [pair] }, '2026-09-26'));
        expect(item.section).toBe(`learning/key-changes/${slug}`);
        expect(item.xml).toMatchSnapshot();

        const { doc } = readXml(item.xml);
        const { score, report } = buildScore(doc);
        expect(report.entries).toEqual([]);
        expect(score.parts[0]?.notes.length).toBeGreaterThan(0);
        expect(score.parts[0]?.notes.every((n) => n.fingerings.length === 1)).toBe(true);
        const again = single(generateKeyChangeFamily({ ...definition, keyPairs: [pair] }, '2026-09-26'));
        expect(again.xml).toBe(item.xml);
      });
    }
  }
});
