// Feature 014 T006 (contracts/exercise-definition.md 1.3 §1c-§1d, data-model.md (014) §1-§2, research R5-R6):
// step -> pitch in all 24 keys, variant rotation, fingering, the chord's words direction on the melody, and the
// generator's validation throws.
import { describe, expect, it } from 'vitest';
import { generateKeyChangeFamily, generatePatternFamily } from '../../../../src/core/library/exercise/generate.js';
import { exerciseKeyOf, KEYS, keyBySlug } from '../../../../src/core/library/exercise/keys.js';
import {
  buildMelodySegments,
  computedFinger,
  positionFinger,
  resolvePhrase,
  scaleTableFinger,
  stepToPitch,
  variantFor,
} from '../../../../src/core/library/exercise/melody.js';
import type {
  ExerciseDefinition,
  ExerciseKey,
  MelodyNote,
  MelodyPart,
  MelodyPhrase,
} from '../../../../src/core/library/exercise/types.js';
import { notesOf } from './support.js';

function key(slug: string): ExerciseKey {
  const info = keyBySlug(slug);
  if (!info) throw new Error(`no key ${slug}`);
  return exerciseKeyOf(info);
}

const spell = (p: { step: string; alter: number }) =>
  `${p.step}${p.alter > 0 ? '#'.repeat(p.alter) : p.alter < 0 ? 'b'.repeat(-p.alter) : ''}`;

// ---- (a) step -> pitch, tonic in octave 4, all 24 keys ------------------------------------------------------------

describe('stepToPitch: the tonic sits in octave 4 in every key (R5)', () => {
  it.each(KEYS.map((k) => k.slug))('%s: step 1 is the tonic, octave 4', (slug) => {
    const info = keyBySlug(slug);
    if (!info) throw new Error(slug);
    const p = stepToPitch(exerciseKeyOf(info), 1, 0);
    expect(spell(p)).toBe(info.tonic);
    expect(p.octave).toBe(4);
  });

  it('C major: steps -3..10 spell the diatonic scale across two octaves', () => {
    const c = key('c-major');
    const spelled = (step: number) => `${spell(stepToPitch(c, step, 0))}${stepToPitch(c, step, 0).octave}`;
    // -3, -2, -1, 0 = the 4th, 5th, 6th, 7th below the tonic (octave 3): degree classes 4, 5, 6, 7 of C major
    expect([-3, -2, -1, 0].map(spelled)).toEqual(['F3', 'G3', 'A3', 'B3']);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(spelled)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect([9, 10].map(spelled)).toEqual(['D5', 'E5']);
  });

  it('minor 6th/7th raised with an explicit alter: G# in A minor, E# in F# minor, F## in G# minor', () => {
    const aMinor = key('a-minor');
    expect(spell(stepToPitch(aMinor, 7, 1))).toBe('G#'); // raised 7th above the tonic
    expect(spell(stepToPitch(aMinor, 0, 1))).toBe('G#'); // the same degree class, written as "the 7th below"
    expect(spell(stepToPitch(aMinor, 7, 0))).toBe('G'); // natural 7th

    const fSharpMinor = key('f-sharp-minor');
    expect(spell(stepToPitch(fSharpMinor, 7, 1))).toBe('E#');

    const gSharpMinor = key('g-sharp-minor');
    expect(spell(stepToPitch(gSharpMinor, 7, 1))).toBe('F##');
  });

  it('raised 6th (5-#6-#7-1 figure) also uses an explicit alter', () => {
    const aMinor = key('a-minor');
    expect(spell(stepToPitch(aMinor, 6, 1))).toBe('F#');
    expect(spell(stepToPitch(aMinor, 6, 0))).toBe('F');
  });
});

// ---- (c) note-level validation throws ------------------------------------------------------------------------

const wholeNote = (over: Partial<MelodyNote> = {}): MelodyNote => ({ value: 'whole', step: 1, ...over });

function phrase(notes: MelodyNote[], position = 1): MelodyPhrase {
  return { position, notes };
}

describe('resolvePhrase: validation (contract 1.3 §1c)', () => {
  it('throws naming the context and note index when a note has both step and rest', () => {
    const bad = { value: 'whole', step: 1, rest: true } as unknown as MelodyNote;
    expect(() =>
      resolvePhrase(key('c-major'), phrase([bad]), 'introduction', false, 'family X, section 1, variant 0'),
    ).toThrow(/family X, section 1, variant 0, note 1.*step.*rest/);
  });

  it('throws naming the step when a minor phrase omits alter on a 6th/7th degree', () => {
    const noAlter = { value: 'whole', step: 7 } as MelodyNote;
    expect(() => resolvePhrase(key('a-minor'), phrase([noAlter]), 'introduction', false, 'ctx')).toThrow(
      /ctx, note 1.*step 7.*alter/,
    );
  });

  it('does not require alter on a 6th/7th degree in a major key', () => {
    expect(() =>
      resolvePhrase(key('c-major'), phrase([{ value: 'whole', step: 7 }]), 'introduction', false, 'ctx'),
    ).not.toThrow();
  });

  it('throws on alter -1 for a minor 6th/7th (only 0 or 1 allowed) outside the drills form', () => {
    const bad = { value: 'whole', step: 7, alter: -1 } as MelodyNote;
    expect(() => resolvePhrase(key('a-minor'), phrase([bad]), 'introduction', false, 'ctx')).toThrow(
      /ctx, note 1.*0.*1/,
    );
  });

  it('throws on any non-zero alter on a degree that is not a minor 6th/7th, outside the drills form', () => {
    const bad = { value: 'whole', step: 3, alter: 1 } as MelodyNote;
    expect(() => resolvePhrase(key('c-major'), phrase([bad]), 'introduction', false, 'ctx')).toThrow(
      /ctx, note 1.*step 3/,
    );
  });

  it('the drills form (allowExtraAlters) allows other alters', () => {
    const altered = { value: 'whole', step: 3, alter: -1 } as MelodyNote;
    expect(() => resolvePhrase(key('c-major'), phrase([altered]), 'introduction', true, 'ctx')).not.toThrow();
  });
});

// ---- (b) variant rotation --------------------------------------------------------------------------------------

describe('variantFor: item i of the family uses variants[i mod n] (data-model §1)', () => {
  const part: MelodyPart = {
    major: [phrase([wholeNote()], 1), phrase([wholeNote()], 2), phrase([wholeNote()], 3)],
  };

  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 1],
    [4, 2],
  ])('item %i picks variant with position %i', (i, position) => {
    expect(variantFor(part, 'major', i).position).toBe(position);
  });

  it('throws when the section has no variants for the mode', () => {
    expect(() => variantFor({ major: [phrase([wholeNote()])] }, 'minor', 0)).toThrow(/minor/);
  });
});

// ---- (d) fingering ---------------------------------------------------------------------------------------------

describe('fingering: five-finger position (introduction/beginner) and the scale table (intermediate/advanced)', () => {
  it('position-based finger = step - position + 1', () => {
    expect(positionFinger(1, 1)).toBe(1);
    expect(positionFinger(5, 1)).toBe(5);
    expect(positionFinger(3, -1)).toBe(5);
  });

  it('computedFinger uses the position at introduction/beginner, the scale table from intermediate up', () => {
    const c = key('c-major');
    expect(computedFinger(c, 'introduction', 1, 3)).toBe(3);
    expect(computedFinger(c, 'beginner', 1, 3)).toBe(3);
    expect(computedFinger(c, 'intermediate', 1, 3)).toBe(scaleTableFinger(c, 'right', 3));
    expect(computedFinger(c, 'advanced', 1, 3)).toBe(scaleTableFinger(c, 'right', 3));
  });

  it('scaleTableFinger reads the one-octave table, C major RH: 1 2 3 1 2 3 4 5', () => {
    const c = key('c-major');
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((s) => scaleTableFinger(c, 'right', s))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('scaleTableFinger cycles by octave for steps beyond 1-8', () => {
    const c = key('c-major');
    expect(scaleTableFinger(c, 'right', 9)).toBe(scaleTableFinger(c, 'right', 2));
    expect(scaleTableFinger(c, 'right', 10)).toBe(scaleTableFinger(c, 'right', 3));
    expect(scaleTableFinger(c, 'right', 0)).toBe(scaleTableFinger(c, 'right', 7));
    expect(scaleTableFinger(c, 'right', -3)).toBe(scaleTableFinger(c, 'right', 4));
  });

  // T062 (contract 1.3.1): every melody note prints its finger (feature 005 FR-006), which covers the first note, a
  // shift note and a thumb-under/finger-over (014 FR-009). Before 1.3.1 only those places printed one.
  it('resolvePhrase prints fingering on every note, including the first note and a thumb-under/finger-over', () => {
    // C major RH intermediate table: 1 2 3 1 2 3 4 5 - the step 3->4 transition (finger 3 -> 1) is a thumb-under
    const notes: MelodyNote[] = [
      { value: 'quarter', step: 1 },
      { value: 'quarter', step: 2 },
      { value: 'quarter', step: 3 },
      { value: 'quarter', step: 4 },
      { value: 'quarter', step: 5 },
    ];
    const resolved = resolvePhrase(key('c-major'), phrase(notes, 1), 'intermediate', false, 'ctx');
    expect(resolved.map((n) => n.finger)).toEqual([1, 2, 3, 1, 2]);
    expect(resolved.map((n) => n.printFingering)).toEqual([true, true, true, true, true]);
  });

  it('a shift note always prints its finger even without a thumb transition', () => {
    const notes: MelodyNote[] = [
      { value: 'quarter', step: 1 },
      { value: 'quarter', step: 2, shift: true },
    ];
    const resolved = resolvePhrase(key('c-major'), phrase(notes, 1), 'introduction', false, 'ctx');
    expect(resolved[1]?.printFingering).toBe(true);
  });

  it('an explicit finger overrides the computed one and is used for the thumb-transition check', () => {
    const notes: MelodyNote[] = [
      { value: 'quarter', step: 1, finger: 2 },
      { value: 'quarter', step: 2, finger: 3 },
    ];
    const resolved = resolvePhrase(key('c-major'), phrase(notes, 1), 'introduction', false, 'ctx');
    expect(resolved.map((n) => n.finger)).toEqual([2, 3]);
  });

  it('a repeated note (0 steps) keeps its finger and prints it', () => {
    const notes: MelodyNote[] = [
      { value: 'quarter', step: 3 },
      { value: 'quarter', step: 3 },
    ];
    const resolved = resolvePhrase(key('c-major'), phrase(notes, 1), 'introduction', false, 'ctx');
    expect(resolved.map((n) => [n.finger, n.printFingering])).toEqual([
      [3, true],
      [3, true],
    ]);
  });

  it('a rest prints no finger', () => {
    const notes: MelodyNote[] = [
      { value: 'half', step: 1 },
      { value: 'half', rest: true },
    ];
    const resolved = resolvePhrase(key('c-major'), phrase(notes, 1), 'introduction', false, 'ctx');
    expect(resolved.map((n) => n.printFingering)).toEqual([true, false]);
  });
});

// ---- (e), (f) words direction at the chord start, no <chord/> ---------------------------------------------------

describe('buildMelodySegments: the chord words direction on the melody note at the chord start; no <chord/>', () => {
  it('attaches the words direction above staff 1 to the note sounding at each chord onset', () => {
    const part: MelodyPart = {
      major: [
        phrase(
          [
            { value: 'quarter', step: 1 },
            { value: 'quarter', step: 2 },
            { value: 'quarter', step: 3 },
            { value: 'quarter', step: 4 },
          ],
          1,
        ),
      ],
    };
    const segments = buildMelodySegments(
      key('c-major'),
      part,
      'major',
      0,
      'introduction',
      false,
      [
        { onset: 0, words: 'I' },
        { onset: 8, words: 'IV' },
      ],
      'ctx',
    );
    expect(segments).toHaveLength(4);
    expect(segments[0]?.events[0]).toMatchObject({ kind: 'direction', words: 'I', staff: 1, placement: 'above' });
    expect(segments[1]?.events.some((e) => e.kind === 'direction')).toBe(false);
    expect(segments[2]?.events[0]).toMatchObject({ kind: 'direction', words: 'IV', staff: 1, placement: 'above' });
  });

  it('never writes <chord/> (every note event has chord: false)', () => {
    const part: MelodyPart = {
      major: [
        phrase(
          [
            { value: 'half', step: 1 },
            { value: 'half', step: 2 },
          ],
          1,
        ),
      ],
    };
    const segments = buildMelodySegments(key('c-major'), part, 'major', 0, 'introduction', false, [], 'ctx');
    for (const segment of segments) {
      for (const event of segment.events) {
        if (event.kind === 'note' && !event.note.rest) expect(event.note.chord).toBe(false);
      }
    }
  });
});

// ---- generator integration: melody wired into the pattern/key-change forms --------------------------------------

const C_MAJOR: ExerciseKey = { tonic: 'C', mode: 'major', fifths: 0 };
const A_MINOR: ExerciseKey = { tonic: 'A', mode: 'minor', fifths: 0 };

function meta(): ExerciseDefinition['meta'] {
  return {
    kind: 'exercise',
    level: 'introduction',
    tags: ['key-changes'],
    trains: 'test',
    hands: 'both',
    provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test' },
  };
}

function melodyKeyChangeDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    version: 1,
    family: 'test-melody-key-change',
    form: 'key-change',
    titleTemplate: '{from} to {to} - test',
    section: 'learning/key-changes/{pair}',
    fileStem: 'test',
    step: 'introduction',
    stepOrder: 0,
    metre: '4/4',
    tempoBpm: 60,
    keyPairs: [{ from: C_MAJOR, to: A_MINOR, relation: 'relative' }],
    sections: [
      {
        bars: 1,
        inKey: 'from',
        right: {
          melody: {
            major: [phrase([{ value: 'whole', step: 1 }], 1)],
            minor: [phrase([{ value: 'whole', step: 1 }], 1)],
          },
        },
        left: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' } }] },
      },
    ],
    meta: meta(),
    ...overrides,
  };
}

describe('the melody hand part wired into the key-change form', () => {
  it('generates the right hand as single melody notes and copies the chord label onto the melody note', () => {
    const [item] = generateKeyChangeFamily(melodyKeyChangeDefinition(), '2026-09-28');
    if (!item) throw new Error('no item generated');
    const notes = notesOf(item.xml);
    const right = notes.filter((n) => n.staff === 1);
    // the right hand (melody) never stacks notes; the left hand's triad legitimately does
    expect(right).toHaveLength(1);
    expect(right[0]?.midi).toBe(60); // C4
    expect(item.xml).toContain('<words>I</words>');
  });

  it('throws when the melody does not fill the section', () => {
    const definition = melodyKeyChangeDefinition();
    const section = definition.sections?.[0];
    if (!section || !('melody' in section.right)) throw new Error('fixture');
    section.right.melody = {
      major: [phrase([{ value: 'quarter', step: 1 }], 1)],
      minor: [phrase([{ value: 'quarter', step: 1 }], 1)],
    };
    expect(() => generateKeyChangeFamily(definition, '2026-09-28')).toThrow(/right hand fills/);
  });

  it('throws when melody is written in the left hand', () => {
    const definition = melodyKeyChangeDefinition();
    const section = definition.sections?.[0];
    if (!section) throw new Error('fixture');
    section.left = {
      melody: { major: [phrase([{ value: 'whole', step: 1 }], 1)], minor: [phrase([{ value: 'whole', step: 1 }], 1)] },
    } as never;
    expect(() => generateKeyChangeFamily(definition, '2026-09-28')).toThrow(
      /melody.*right hand only|right hand only.*melody/i,
    );
  });
});

describe('the melody hand part is not allowed in a mirrored section', () => {
  it('throws when a section tries to mirror a melody section (hands swapped would put it in the left hand)', () => {
    const definition: ExerciseDefinition = {
      version: 1,
      family: 'test-melody-pattern',
      form: 'pattern',
      titleTemplate: '{key} - test',
      section: 'learning/keys/{key}',
      fileStem: 'test',
      step: 'introduction',
      stepOrder: 0,
      metre: '4/4',
      tempoBpm: 60,
      keys: [C_MAJOR],
      sections: [
        {
          bars: 1,
          right: { melody: { major: [phrase([{ value: 'whole', step: 1 }], 1)] } },
          left: { chords: [{ degree: 'I', duration: 'whole' }] },
        },
        { bars: 1, mirror: 0, right: { mirror: true }, left: { mirror: true } },
      ],
      meta: meta(),
    };
    expect(() => generatePatternFamily(definition, '2026-09-28')).toThrow(
      /melody.*right hand only|right hand only.*melody/i,
    );
  });
});
