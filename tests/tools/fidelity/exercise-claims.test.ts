// The claim table of the exercise theory check (task T071, data-model.md §5, research R8): what each exercise family
// SAYS it teaches, written by hand from its title and description, never read from the exercise generator's input.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ClaimError, claimForItem, parseExerciseTitle } from '../../../tools/library/fidelity/exercise-claims';
import type { ChordClaim, ExerciseClaim } from '../../../tools/library/fidelity/theory';

interface ShelfExercise {
  itemId: string;
  title: string;
  trains: string;
}
const index = JSON.parse(readFileSync('public/library/index.json', 'utf8')) as {
  items: { id: string; meta: { kind: string; title: string; trains?: string } }[];
};
const shelf: ShelfExercise[] = index.items
  .filter((i) => i.meta.kind === 'exercise')
  .map((i) => ({ itemId: i.id, title: i.meta.title, trains: i.meta.trains ?? '' }));
const claimOf = (title: string): ExerciseClaim => {
  const item = shelf.find((s) => s.title === title);
  if (!item) throw new Error(`no exercise on the shelf is titled "${title}"`);
  return claimForItem(item);
};
/** "I", "IV6", "V64" -> the Roman numerals and inversions of a claim, as one short string per chord. */
const shortChords = (claim: ExerciseClaim): string[] =>
  claim.chords.map((c) => `${c.roman}${['', '6', '64'][c.inversion]}`);

describe('every exercise on the shelf has a claim', () => {
  it('the audited shelf holds 41 exercises: 24 triads, 16 chord-change drills and the hand-written scale item', () => {
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
