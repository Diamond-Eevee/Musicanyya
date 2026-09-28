// T013 (feature 014, FR-014): `pnpm library:exercises` runs the melody rule check on every generated item that has a
// melody and writes nothing when any finding remains, listing each finding by item, bar and rule.
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExerciseDefinition, MelodyNote } from '../../src/core/library/exercise/types';
import { buildExercises } from '../../tools/library/build-exercises';

let content: string;
let library: string;

beforeEach(() => {
  content = mkdtempSync(join(tmpdir(), 'melody-content-'));
  library = mkdtempSync(join(tmpdir(), 'melody-library-'));
});
afterEach(() => {
  rmSync(content, { recursive: true, force: true });
  rmSync(library, { recursive: true, force: true });
});

const h = (step: number, alter?: 0 | 1): MelodyNote => ({
  step,
  value: 'half',
  ...(alter !== undefined ? { alter } : {}),
});
const w = (step: number, alter?: 0 | 1): MelodyNote => ({
  step,
  value: 'whole',
  ...(alter !== undefined ? { alter } : {}),
});

/** C major to A minor - introduction, in the claim table's layout (4 bars I I I IV, then 8 bars of i), with a melody
 *  in one five-finger position (thumb on F4: step 4 in C major, step -1 in A minor). */
function definition(majorNotes: MelodyNote[]): ExerciseDefinition {
  const I = { degree: 'I', duration: 'whole' as const, minor: { degree: 'i' } };
  const IV = { degree: 'IV', duration: 'whole' as const, minor: { degree: 'VI' } };
  const leadingTone = [h(1), h(0, 1), w(1)];
  return {
    version: 1,
    family: 'test-melody-build',
    form: 'key-change',
    titleTemplate: '{from} to {to} - introduction',
    section: 'learning/key-changes/{pair}',
    fileStem: 'introduction',
    step: 'introduction',
    stepOrder: 0,
    metre: '4/4',
    tempoBpm: 60,
    keyPairs: [
      {
        from: { tonic: 'C', mode: 'major', fifths: 0 },
        to: { tonic: 'A', mode: 'minor', fifths: 0 },
        relation: 'relative',
      },
    ],
    sections: [
      {
        bars: 4,
        inKey: 'from',
        barline: 'light-light',
        right: { melody: { major: [{ position: 4, notes: majorNotes }] } },
        left: { chords: [I, I, I, IV] },
      },
      {
        bars: 8,
        inKey: 'to',
        label: '{toKey}',
        right: {
          melody: {
            minor: [{ position: -1, notes: [...leadingTone, ...leadingTone, ...leadingTone, ...leadingTone] }],
          },
        },
        left: { chords: Array.from({ length: 8 }, () => I) },
      },
    ],
    meta: {
      kind: 'exercise',
      level: 'introduction',
      tags: ['key-changes'],
      trains: 'Moving between relative keys through the shared pivot chord, arriving on the new tonic.',
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test' },
    },
  } as ExerciseDefinition;
}

const CLEAN = [h(5), h(6), w(5), h(5), h(5), w(6)];
/** F against the left hand's E on the third beat of bar 1: a clash. */
const CLASHING = [h(5), h(4), w(5), h(5), h(5), w(6)];

const write = (d: ExerciseDefinition) => writeFileSync(join(content, 'melody.json'), JSON.stringify(d));

describe('library:exercises runs the melody rule check (T013)', () => {
  it('writes an item whose melody passes the check', async () => {
    write(definition(CLEAN));
    const { written } = await buildExercises(content, library, '2026-09-28');
    expect(written).toEqual([join('learning', 'key-changes', 'c-major-to-a-minor', 'introduction.musicxml')]);
  });

  it('writes nothing and lists the item, bar and rule when a finding remains', async () => {
    write(definition(CLASHING));
    await expect(buildExercises(content, library, '2026-09-28')).rejects.toThrow(
      /learning\/key-changes\/c-major-to-a-minor\/introduction: bar 1, beat 3: clash/,
    );
    expect(readdirSync(library)).toEqual([]);
  });
});
