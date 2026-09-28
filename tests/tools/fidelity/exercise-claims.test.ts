// The claim table of the exercise theory check (task T071, data-model.md §5, research R8): what each exercise family
// SAYS it teaches, written by hand from its title and description, never read from the exercise generator's input.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateFamily,
  generateKeyChangeFamily,
  generatePatternFamily,
} from '../../../src/core/library/exercise/generate';
import type { ExerciseDefinition } from '../../../src/core/library/exercise/types';
import { ClaimError, claimForItem, parseExerciseTitle } from '../../../tools/library/fidelity/exercise-claims';
import { type ChordClaim, checkExercise, type ExerciseClaim } from '../../../tools/library/fidelity/theory';
import { SUCCESSORS } from '../../../tools/library/successors';

interface ShelfExercise {
  itemId: string;
  title: string;
  trains: string;
}
// Feature 011 retired 36 of the 41 items this table was written for from the shelf. The table still claims them: the v1 claims are
// checked here on the same 41 items, rebuilt as they were - the retired definitions (tests/fixtures/exercises) through the 1.0.0
// generator, the five drills that kept their music from the current shelf under their old ids (successors.ts), and the
// hand-written scale item, which only its title and description are left of.
const contentExercises = join('content', 'library', 'exercises');
const fixtureExercises = join('tests', 'fixtures', 'exercises');
const generated = (dir: string, files: (name: string) => boolean): ShelfExercise[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json') && files(f))
    .flatMap((f) =>
      generateFamily(JSON.parse(readFileSync(join(dir, f), 'utf8')) as ExerciseDefinition, '2026-09-24').map((item) => {
        const newId = `${item.section}/${item.fileStem}`;
        return {
          itemId: SUCCESSORS.find((s) => s.newId === newId)?.oldId ?? newId,
          title: item.meta.title,
          trains: item.meta.trains ?? '',
        };
      }),
    );
const SCALE_ITEM: ShelfExercise = {
  itemId: 'learning/chords/c-major-scale-and-chords',
  title: 'C major - scale and chords for both hands',
  trains: 'One hand plays the scale while the other holds the chords, then the hands swap.',
};
const shelf: ShelfExercise[] = [
  ...generated(fixtureExercises, () => true),
  ...generated(contentExercises, (f) => f.startsWith('changes-')),
  SCALE_ITEM,
];
const claimOf = (title: string): ExerciseClaim => {
  const item = shelf.find((s) => s.title === title);
  if (!item) throw new Error(`no exercise on the shelf is titled "${title}"`);
  return claimForItem(item);
};
/** "I", "IV6", "V64" -> the Roman numerals and inversions of a claim, as one short string per chord. */
const shortChords = (claim: ExerciseClaim): string[] =>
  claim.chords.map((c) => `${c.roman}${['', '6', '64'][c.inversion]}`);

describe('every exercise on the shelf has a claim', () => {
  it('the audited shelf of feature 007 held 41 exercises: 24 triads, 16 chord-change drills and the hand-written scale item', () => {
    expect(shelf).toHaveLength(41);
    expect(shelf.filter((s) => s.itemId.includes('/triads-'))).toHaveLength(24);
    expect(shelf.filter((s) => s.itemId.includes('/changes/'))).toHaveLength(16);
  });

  it('claimForItem gives each one a claim without throwing', () => {
    for (const item of shelf) {
      const claim = claimForItem(item);
      expect(claim.itemId).toBe(item.itemId);
      expect(claim.chords.length, item.itemId).toBeGreaterThan(0);
    }
  });

  it('every generated title parses to the key its item id names (the id and the title are two witnesses)', () => {
    const slug = /([a-g])(-sharp|-flat)?-(major|minor)$/;
    for (const item of shelf.filter((s) => slug.test(s.itemId))) {
      const m = slug.exec(item.itemId) as RegExpExecArray;
      const fromId = {
        tonicLetter: (m[1] as string).toUpperCase(),
        tonicAlter: m[2] === '-sharp' ? 1 : m[2] === '-flat' ? -1 : 0,
        mode: m[3],
      };
      expect(claimForItem(item).key, item.itemId).toEqual(fromId);
    }
    // The one item without a key in its id names it in the title.
    const scale = shelf.find((s) => s.itemId === 'learning/chords/c-major-scale-and-chords');
    expect(scale && claimForItem(scale).key).toEqual({ tonicLetter: 'C', tonicAlter: 0, mode: 'major' });
  });

  it('the triads cover the 12 major and the 12 minor keys of the content plan, once each', () => {
    const keys = (mode: string) =>
      shelf
        .filter((s) => s.title.endsWith(`${mode} triads`))
        .map((s) => s.title.replace(` ${mode} triads`, ''))
        .sort();
    expect(keys('major')).toEqual(['A', 'A♭', 'B', 'B♭', 'C', 'D', 'D♭', 'E', 'E♭', 'F', 'F♯', 'G'].sort());
    expect(keys('minor')).toEqual(['A', 'B', 'B♭', 'C', 'C♯', 'D', 'E', 'E♭', 'F', 'F♯', 'G', 'G♯'].sort());
  });

  it('a title is read as a key, then either "triads" or " - <name>"', () => {
    expect(parseExerciseTitle('F♯ minor triads')).toEqual({
      key: { tonicLetter: 'F', tonicAlter: 1, mode: 'minor' },
      name: 'triads',
    });
    expect(parseExerciseTitle('B♭ major - I-IV-V-I')).toEqual({
      key: { tonicLetter: 'B', tonicAlter: -1, mode: 'major' },
      name: 'I-IV-V-I',
    });
    expect(() => parseExerciseTitle('Twinkle')).toThrow(ClaimError);
  });
});

describe('the sequences the claim table states', () => {
  it('a drill is its cycle, the same cycle again, and the tonic triad', () => {
    expect(shortChords(claimOf('C major - ii-V-I'))).toEqual(['ii', 'V', 'I', 'I', 'ii', 'V', 'I', 'I', 'I']);
    expect(shortChords(claimOf('C major - I-V-I'))).toEqual(['I', 'V6', 'I', 'I', 'I', 'V6', 'I', 'I', 'I']);
  });

  it('the close-position I-IV-V-I cadence is I IV64 V6 I, in each of its three keys', () => {
    const cadence = ['I', 'IV64', 'V6', 'I'];
    for (const key of ['C', 'G', 'F']) {
      expect(shortChords(claimOf(`${key} major - I-IV-V-I`))).toEqual([...cadence, ...cadence, 'I']);
    }
  });

  it('the minor cadence is i iv64 V6 i, with a major V', () => {
    const claim = claimOf('A minor - i-iv-V-i');
    expect(shortChords(claim)).toEqual(['i', 'iv64', 'V6', 'i', 'i', 'iv64', 'V6', 'i', 'i']);
    expect(claim.chords[2]?.quality).toBe('major');
    expect(claim.chords[1]?.quality).toBe('minor');
  });

  it('the four-chord loops are named by their titles', () => {
    expect(shortChords(claimOf('C major - I-vi-IV-V')).slice(0, 4)).toEqual(['I', 'vi', 'IV', 'V']);
    expect(shortChords(claimOf('C major - I-V-vi-IV')).slice(0, 4)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(shortChords(claimOf('C major - I-vi-ii-V')).slice(0, 4)).toEqual(['I', 'vi', 'ii', 'V']);
  });

  it('the same-tonic drills change only the quality: the parallel major is I, the parallel minor is i', () => {
    const major = claimOf('C major - major and minor').chords;
    expect(major.map((c) => [c.roman, c.quality]).slice(0, 4)).toEqual([
      ['I', 'major'],
      ['i', 'minor'],
      ['I', 'major'],
      ['i', 'minor'],
    ]);
    const minor = claimOf('A minor - minor and major').chords;
    expect(minor.map((c) => [c.roman, c.quality]).slice(0, 4)).toEqual([
      ['i', 'minor'],
      ['I', 'major'],
      ['i', 'minor'],
      ['I', 'major'],
    ]);
  });

  it('the diatonic ladder climbs the seven degrees and returns, with a diminished vii', () => {
    const claim = claimOf('C major - diatonic ladder');
    expect(shortChords(claim).slice(0, 8)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii', 'I']);
    expect(claim.chords[6]?.quality).toBe('diminished');
  });

  it('plagal then V-I is IV64 I V6 I; the tonic inversions are I, I6, I64, I', () => {
    expect(shortChords(claimOf('C major - plagal then V-I')).slice(0, 4)).toEqual(['IV64', 'I', 'V6', 'I']);
    expect(shortChords(claimOf('C major - tonic inversions')).slice(0, 4)).toEqual(['I', 'I6', 'I64', 'I']);
  });

  it('the triads follow the content plan: primary triads, the three tonic shapes, then the close-position cadence', () => {
    const plan = ['I', 'IV', 'V', 'I', 'I', 'I6', 'I64', 'I', 'I', 'IV64', 'V6', 'I', 'IV64', 'V6', 'I'];
    expect(shortChords(claimOf('C major triads'))).toEqual(plan);
    expect(shortChords(claimOf('G♯ minor triads'))).toEqual([
      ...['i', 'iv', 'V', 'i', 'i', 'i6', 'i64', 'i', 'i', 'iv64', 'V6', 'i', 'iv64', 'V6', 'i'],
    ]);
    // The minor V is the harmonic-minor major V (data-model.md §5, "Minor-key degrees").
    const minor = claimOf('E♭ minor triads');
    expect(minor.chords.filter((c) => c.roman === 'V').every((c) => c.quality === 'major')).toBe(true);
    expect(minor.chords.filter((c) => c.roman === 'iv').every((c) => c.quality === 'minor')).toBe(true);
    expect(minor.chords).toHaveLength(15);
  });

  it('every chord is played by both hands as a triad, except in the hand-written scale item', () => {
    for (const item of shelf.filter((s) => !s.itemId.endsWith('c-major-scale-and-chords'))) {
      const claim = claimForItem(item);
      for (const c of claim.chords) {
        expect(c.hands, item.itemId).toEqual(['left', 'right']);
        expect(c.rootOnly, item.itemId).toBeUndefined();
      }
      expect(claim.scales, item.itemId).toBeUndefined();
    }
  });

  it('the scale item: a scale in one hand while the other plays I, V, IV chords, then the hands swap', () => {
    const claim = claimOf('C major - scale and chords for both hands');
    const chords = claim.chords.map(
      (c: ChordClaim) => `${c.roman}:${[...c.hands, ...(c.rootOnly ?? []).map((h) => `${h}-root`)].join('+')}`,
    );
    expect(chords).toEqual([
      ...['I', 'V', 'I', 'I', 'V', 'IV', 'V', 'I'].map((r) => `${r}:left`),
      ...['I', 'V', 'I', 'I', 'V', 'IV', 'V'].map((r) => `${r}:right`),
      'I:right+left-root',
    ]);
    const up = [1, 2, 3, 4, 5, 6, 7, 8];
    const run = [...up, ...[...up].reverse()];
    expect(claim.scales).toEqual([
      { hand: 'right', tonicOctave: 4, degrees: run },
      { hand: 'left', tonicOctave: 3, degrees: run },
    ]);
  });
});

describe('the claim table is consistent', () => {
  it('a Roman numeral in upper case is a major or augmented chord, in lower case a minor or diminished one', () => {
    for (const item of shelf) {
      for (const c of claimForItem(item).chords) {
        const upper = c.roman === c.roman.toUpperCase();
        expect(upper ? ['major', 'augmented'] : ['minor', 'diminished'], `${item.itemId} ${c.roman}`).toContain(
          c.quality,
        );
      }
    }
  });

  it('a title that spells its Roman numerals is the first chords of its claim (a short cycle holds its last chord)', () => {
    for (const item of shelf) {
      const name = parseExerciseTitle(item.title).name;
      if (!/^[iv]+(-[iv]+)+$/i.test(name)) continue;
      const named = name.split('-');
      const claim = shortChords(claimForItem(item)).map((c) => c.replace(/6.*/, ''));
      expect(claim.slice(0, named.length), item.title).toEqual(named);
      // Any chord after the named ones is the last named chord held (the cycle is padded to four measures).
      for (const held of claim.slice(named.length, 4)) expect(held, item.title).toBe(named[named.length - 1]);
    }
  });

  it('a name that does not spell its sequence takes it from the description, and fails when the description does not state it', () => {
    const ambiguous = [
      'C major - plagal then V-I',
      'C major - diatonic ladder',
      'C major - tonic inversions',
      'C major - major and minor',
      'A minor - minor and major',
      'C major - I-V-I',
      'C major - I-IV-I',
      'C major triads',
      'A minor triads',
      'C major - scale and chords for both hands',
    ];
    for (const title of ambiguous) {
      const item = shelf.find((s) => s.title === title);
      if (!item) throw new Error(`no exercise on the shelf is titled "${title}"`);
      expect(() => claimForItem({ ...item, trains: '' }), title).toThrow(ClaimError);
      expect(() => claimForItem({ ...item, trains: 'Something unrelated.' }), title).toThrow(/does not state/);
      expect(() => claimForItem(item), title).not.toThrow();
    }
  });

  it('a title that spells its Roman numerals needs no description, and an unknown name has no claim', () => {
    expect(
      claimForItem({ itemId: 'x/changes-ii-v-i-c-major', title: 'C major - ii-V-I', trains: '' }).chords,
    ).toHaveLength(9);
    expect(() => claimForItem({ itemId: 'x', title: 'C major - blues', trains: 'Twelve bars.' })).toThrow(/no claim/);
  });

  it('no title or description calls a cadence with an inverted dominant "perfect" (owner decision 2026-09-24)', () => {
    for (const item of shelf) {
      expect(`${item.title} ${item.trains}`, item.itemId).not.toMatch(/perfect/i);
    }
    // The guard is in the claim itself: the same item with the old wording has no claim.
    const cadence = shelf.find((s) => s.title === 'C major - I-IV-V-I');
    if (!cadence) throw new Error('the cadence drill is on the shelf');
    expect(() => claimForItem({ ...cadence, trains: 'The full perfect cadence.' })).toThrow(/inverted V/);
    const plagal = shelf.find((s) => s.title === 'C major - plagal then V-I');
    if (!plagal) throw new Error('the plagal drill is on the shelf');
    expect(() =>
      claimForItem({ ...plagal, title: 'C major - plagal then V-I', trains: `${plagal.trains} A perfect cadence.` }),
    ).toThrow(/inverted V/);
  });

  it('a name is claimed only in the mode it is written for', () => {
    expect(() => claimForItem({ itemId: 'x', title: 'C major - i-iv-V-i', trains: '' })).toThrow(/minor/);
    expect(() => claimForItem({ itemId: 'x', title: 'A minor - I-IV-V-I', trains: '' })).toThrow(/major/);
  });

  it('the table is written by hand: exercise-claims.ts does not read the generator or its definitions (FR-013)', () => {
    const source = readFileSync('tools/library/fidelity/exercise-claims.ts', 'utf8');
    expect(source).not.toMatch(/src\/core\/library\/exercise/);
    expect(source).not.toMatch(/content\/library\/exercises/);
    expect(source).not.toMatch(/readFileSync|readdirSync/);
  });
});

// ---- exercise-theory-v2: the four steps of a key (feature 011, research R6/R8) ----
describe('the step claims: "<key> - introduction|beginner|intermediate|advanced" in all 24 keys', () => {
  const KEY_NAMES = [
    'C',
    'A',
    'G',
    'E',
    'D',
    'B',
    'A',
    'F♯',
    'E',
    'C♯',
    'B',
    'G♯',
    'F♯',
    'E♭',
    'D♭',
    'B♭',
    'A♭',
    'F',
    'E♭',
    'C',
    'B♭',
    'G',
    'F',
    'D',
  ];
  const MODES = ['major', 'minor'];
  const keyTitles = KEY_NAMES.map((name, i) => `${name} ${MODES[i % 2]}`);
  const SCALE_RUN_17 = [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const STEPS = ['introduction', 'beginner', 'intermediate', 'advanced'] as const;
  const stepClaim = (keyTitle: string, step: string): ExerciseClaim =>
    claimForItem({ itemId: `learning/keys/x/${step}`, title: `${keyTitle} - ${step}`, trains: '' });

  it('every title of every key has a claim with its key, and the claim needs no description', () => {
    for (const title of keyTitles) {
      for (const step of STEPS) {
        const claim = stepClaim(title, step);
        const parsed = parseExerciseTitle(`${title} - ${step}`);
        expect(claim.key, `${title} - ${step}`).toEqual(parsed.key);
        expect(claim.sections?.length, `${title} - ${step}`).toBe(
          { introduction: 2, beginner: 2, intermediate: 3, advanced: 5 }[step],
        );
      }
    }
  });

  it('Introduction: bars 1-5 the right hand plays the scale over I V I V I, bars 6-10 the hands swap', () => {
    const claim = stepClaim('C major', 'introduction');
    const [a, b] = claim.sections ?? [];
    expect([a?.firstBar, a?.lastBar, b?.firstBar, b?.lastBar]).toEqual([1, 5, 6, 10]);
    expect(a?.right).toEqual({ kind: 'scale', form: 'harmonic', tonicOctave: 4, degrees: SCALE_RUN_17 });
    expect(a?.left.kind).toBe('chords');
    const leftChords = a?.left.kind === 'chords' ? a.left.chords.map((c) => c.roman) : [];
    expect(leftChords).toEqual(['I', 'V', 'I', 'V', 'I']);
    expect(b?.left).toEqual({ kind: 'scale', form: 'harmonic', tonicOctave: 3, degrees: SCALE_RUN_17 });
    expect(b?.right.kind).toBe('chords');
    // the flattened chord list is what the chord check compares, in written order: the left hand's five, then the right's
    expect(claim.chords.map((c) => `${c.roman}:${c.hands.join()}`)).toEqual([
      ...['I', 'V', 'I', 'V', 'I'].map((r) => `${r}:left`),
      ...['I', 'V', 'I', 'V', 'I'].map((r) => `${r}:right`),
    ]);
  });

  it('the tonic octave of the scale follows the key: octave 4 for tonics C to F, octave 3 from F sharp up', () => {
    const octave = (title: string) => {
      const scale = stepClaim(title, 'introduction').sections?.[0]?.right;
      return scale?.kind === 'scale' ? scale.tonicOctave : -1;
    };
    for (const title of [
      'C major',
      'D♭ major',
      'D major',
      'E♭ major',
      'E major',
      'F major',
      'C minor',
      'D minor',
      'E♭ minor',
      'E minor',
      'F minor',
      'C♯ minor',
    ]) {
      expect(octave(title), title).toBe(4);
    }
    for (const title of [
      'F♯ major',
      'G major',
      'A♭ major',
      'A major',
      'B♭ major',
      'B major',
      'F♯ minor',
      'G minor',
      'G♯ minor',
      'A minor',
      'B♭ minor',
      'B minor',
    ]) {
      expect(octave(title), title).toBe(3);
    }
  });

  it('Beginner: the same scale against I V-I I-IV IV-V I in half notes, then the hands swap', () => {
    const [a] = stepClaim('A minor', 'beginner').sections ?? [];
    expect(a?.right.kind === 'scale' && a.right.form).toBe('harmonic');
    const chords = a?.left.kind === 'chords' ? a.left.chords.map((c) => `${c.roman}${c.inversion}`) : [];
    // a minor key writes i and iv in lower case, and the V is major (the raised leading tone)
    expect(chords).toEqual(['i0', 'V0', 'i0', 'i0', 'iv0', 'iv0', 'V0', 'i0']);
    const major = stepClaim('C major', 'beginner').sections?.[0];
    expect(major?.left.kind === 'chords' && major.left.chords.map((c) => c.roman)).toEqual([
      'I',
      'V',
      'I',
      'I',
      'IV',
      'IV',
      'V',
      'I',
    ]);
  });

  it('Intermediate: inversions, the melodic minor scale, and a section of chords in both hands', () => {
    const claim = stepClaim('A minor', 'intermediate');
    const [a, , c] = claim.sections ?? [];
    expect(a?.right.kind === 'scale' && a.right.form).toBe('melodic');
    const inversions = a?.left.kind === 'chords' ? a.left.chords.map((x) => x.inversion) : [];
    expect(inversions).toEqual([0, 1, 0, 0, 2, 2, 1, 0]);
    expect(c?.firstBar).toBe(11);
    expect(c?.lastBar).toBe(15);
    const broken = c?.left.kind === 'chords' ? c.left.chords.map((x) => x.voicing) : [];
    expect(broken).toEqual(['broken', 'broken', 'broken', 'broken', 'triad']);
    expect(c?.right.kind).toBe('chords');
  });

  it('Advanced: eighth-note scale, a four-chord bar with vi or ii (VI or iv in minor), root-fifth accompaniment', () => {
    const major = stepClaim('C major', 'advanced').sections ?? [];
    const bar3 = major[1]?.right;
    expect(bar3?.kind === 'chords' && bar3.chords.map((x) => `${x.roman}${x.inversion}`)).toEqual([
      'I0',
      'vi1',
      'IV2',
      'V1',
      'I0',
      'ii2',
      'V1',
      'I0',
    ]);
    const accompaniment = major[1]?.left;
    expect(accompaniment?.kind === 'chords' && accompaniment.chords.every((x) => x.voicing === 'root-fifth')).toBe(
      true,
    );
    const minor = stepClaim('C minor', 'advanced').sections ?? [];
    const minorBars = minor[1]?.right;
    expect(minorBars?.kind === 'chords' && minorBars.chords.map((x) => `${x.roman}${x.inversion}`)).toEqual([
      'i0',
      'VI1',
      'iv2',
      'V1',
      'i0',
      'iv2',
      'V1',
      'i0',
    ]);
  });

  it('an unknown step, or a step title in the wrong shape, has no claim', () => {
    expect(() => claimForItem({ itemId: 'x', title: 'C major - expert', trains: '' })).toThrow(/no claim/);
  });
});

describe('the generated steps agree with their claims, in every key (the independent check)', () => {
  const STEP_FILES = ['introduction', 'beginner', 'intermediate', 'advanced'] as const;
  for (const step of STEP_FILES) {
    it(`${step}: 24 items, 0 differences each`, () => {
      const definition = JSON.parse(
        readFileSync(`content/library/exercises/step-${step}.json`, 'utf8'),
      ) as ExerciseDefinition;
      const items = generatePatternFamily(definition, '2026-09-26');
      expect(items).toHaveLength(24);
      for (const item of items) {
        const claim = claimForItem({
          itemId: `${item.section}/${item.fileStem}`,
          title: item.meta.title,
          trains: item.meta.trains ?? '',
        });
        expect(checkExercise(item.xml, claim), item.meta.title).toEqual([]);
      }
    });
  }
});

// ---- exercise-theory-v2: key changes (feature 011 T043, research R7/R8, data-model §3) ----
// "<from> to <to> - introduction|beginner|intermediate": a claim with one key segment per key, written by hand from the
// key-pair table of data-model §3 and the step shapes of research R7 - never read from the generator or the definitions.
describe('the key-change claims: "<from> to <to> - introduction|beginner|intermediate" for the 18 pairs', () => {
  const PAIRS: [string, string, 'relative' | 'parallel'][] = [
    ['C major', 'A minor', 'relative'],
    ['A minor', 'C major', 'relative'],
    ['C major', 'C minor', 'parallel'],
    ['C minor', 'C major', 'parallel'],
    ['G major', 'E minor', 'relative'],
    ['E minor', 'G major', 'relative'],
    ['G major', 'G minor', 'parallel'],
    ['G minor', 'G major', 'parallel'],
    ['F major', 'D minor', 'relative'],
    ['D minor', 'F major', 'relative'],
    ['F major', 'F minor', 'parallel'],
    ['F minor', 'F major', 'parallel'],
    ['D major', 'B minor', 'relative'],
    ['B minor', 'D major', 'relative'],
    ['D major', 'D minor', 'parallel'],
    ['D minor', 'D major', 'parallel'],
    ['A minor', 'A major', 'parallel'],
    ['A major', 'A minor', 'parallel'],
  ];
  const STEPS = ['introduction', 'beginner', 'intermediate'] as const;
  const keyChangeClaim = (from: string, to: string, step: string): ExerciseClaim =>
    claimForItem({ itemId: `learning/key-changes/x/${step}`, title: `${from} to ${to} - ${step}`, trains: '' });
  /** The bars of each segment, by relation and step (research R7: 12, 11 and 9 bars in all). */
  const BARS: Record<'relative' | 'parallel', Record<(typeof STEPS)[number], [number, number]>> = {
    relative: { introduction: [4, 8], beginner: [6, 5], intermediate: [1, 8] },
    parallel: { introduction: [4, 8], beginner: [6, 5], intermediate: [4, 5] },
  };

  it('every pair and step has a claim with two segments that cover the whole piece, the first in the first key', () => {
    for (const [from, to, relation] of PAIRS) {
      for (const step of STEPS) {
        const claim = keyChangeClaim(from, to, step);
        const [first, second] = BARS[relation][step];
        expect(claim.key, `${from} to ${to} - ${step}`).toEqual(parseExerciseTitle(`${from} - x`).key);
        expect(claim.segments, `${from} to ${to} - ${step}`).toEqual([
          { firstBar: 1, lastBar: first, key: parseExerciseTitle(`${from} - x`).key },
          { firstBar: first + 1, lastBar: first + second, key: parseExerciseTitle(`${to} - x`).key },
        ]);
        expect(claim.chords, `${from} to ${to} - ${step}`).toHaveLength(first + second);
      }
    }
  });

  it('the key-change claims give the right hand as a melody at the item level for every section, and the left hand plays the chords', () => {
    for (const [from, to] of PAIRS) {
      for (const step of STEPS) {
        const claim = keyChangeClaim(from, to, step);
        expect(claim.sections, `${from} to ${to} - ${step}`).toBeDefined();
        expect(claim.sections, `${from} to ${to} - ${step}`).toHaveLength(2);
        for (const section of claim.sections ?? []) {
          expect(section.right).toEqual({ kind: 'melody', level: step });
          expect(section.left.kind).toBe('chords');
        }
        expect(claim.chords.every((c) => c.hands.join() === 'left')).toBe(true);
      }
    }
  });

  it('a relative change: the tonic, then the pivot (IV of the first key, VI in a minor first key), then the new tonic', () => {
    expect(shortChords(keyChangeClaim('C major', 'A minor', 'introduction'))).toEqual(
      'I I I IV i i i i i i i i'.split(' '),
    );
    expect(shortChords(keyChangeClaim('A minor', 'C major', 'introduction'))).toEqual(
      'i i i VI I I I I I I I I'.split(' '),
    );
    expect(shortChords(keyChangeClaim('D major', 'B minor', 'beginner'))).toEqual('I I I I I IV i i i i i'.split(' '));
  });

  it('a parallel change: the shared dominant is the pivot, the new tonic follows', () => {
    expect(shortChords(keyChangeClaim('C major', 'C minor', 'introduction'))).toEqual(
      'I V I V i iv i V i V i i'.split(' '),
    );
  });

  it('the intermediate steps use inversions and end on the tonic of the second key', () => {
    const relative = shortChords(keyChangeClaim('C major', 'A minor', 'intermediate'));
    expect(relative).toEqual('I i iv6 V VI iv64 V6 i i'.split(' '));
    const parallel = shortChords(keyChangeClaim('C minor', 'C major', 'intermediate'));
    expect(parallel).toEqual('i iv V6 V I vi IV64 V6 I'.split(' '));
  });

  it('a title that is no relative or parallel pair, or names no step, has no claim', () => {
    expect(() => keyChangeClaim('C major', 'D major', 'introduction')).toThrow(ClaimError);
    expect(() => keyChangeClaim('C major', 'C major', 'introduction')).toThrow(ClaimError);
    expect(() => keyChangeClaim('C major', 'A minor', 'advanced')).toThrow(/no claim/);
  });

  it('the chord-change drills that moved into the key-change folders keep their v1 claims', () => {
    expect(
      claimForItem({ itemId: 'x', title: 'C major - major and minor', trains: 'major to minor and back' }).segments,
    ).toBe(undefined);
  });
});

describe('the generated key changes agree with their claims, for all 18 pairs (the independent check)', () => {
  for (const relation of ['relative', 'parallel'] as const) {
    for (const step of ['introduction', 'beginner', 'intermediate'] as const) {
      it(`${relation} ${step}: 0 differences in every pair`, () => {
        const definition = JSON.parse(
          readFileSync(`content/library/exercises/key-change-${relation}-${step}.json`, 'utf8'),
        ) as ExerciseDefinition;
        const items = generateKeyChangeFamily(definition, '2026-09-26');
        expect(items.length).toBeGreaterThanOrEqual(8);
        for (const item of items) {
          const claim = claimForItem({
            itemId: `${item.section}/${item.fileStem}`,
            title: item.meta.title,
            trains: item.meta.trains ?? '',
          });
          expect(checkExercise(item.xml, claim), item.meta.title).toEqual([]);
        }
      });
    }
  }
});
