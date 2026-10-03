// Feature 022 T022 (contract lesson-definition 1.0.0 §2): the token notation of a lesson bar. Every error names the bar
// and the token, so an author can find it.
import { describe, expect, it } from 'vitest';
import { LessonDefinitionError } from '../../../tools/library/lessons/definition';
import { parseLessonBars, parseStaff } from '../../../tools/library/lessons/parse';

const at = { bar: 3, staff: 'rh' as const };

function one(text: string) {
  const tokens = parseStaff(text, at);
  expect(tokens).toHaveLength(1);
  const [token] = tokens;
  if (!token) throw new Error('no token');
  return token;
}

function errorOf(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(LessonDefinitionError);
    return (e as Error).message;
  }
  return 'accepted';
}

describe('parseStaff: heads', () => {
  it('reads a pitch with letter and octave, C4 = middle C', () => {
    expect(one('C4:q').pitches).toEqual([{ step: 'C', alter: 0, octave: 4 }]);
  });

  it('reads # and b', () => {
    expect(one('F#3:q').pitches).toEqual([{ step: 'F', alter: 1, octave: 3 }]);
    expect(one('Bb3:q').pitches).toEqual([{ step: 'B', alter: -1, octave: 3 }]);
  });

  it('reads a chord in angle brackets, bottom to top whatever the written order', () => {
    expect(one('<G4 C4 E4>:h').pitches).toEqual([
      { step: 'C', alter: 0, octave: 4 },
      { step: 'E', alter: 0, octave: 4 },
      { step: 'G', alter: 0, octave: 4 },
    ]);
  });

  it('reads a rest and a whole-bar rest', () => {
    expect(one('r:q')).toMatchObject({ rest: true, measureRest: false, pitches: [] });
    expect(one('R:w')).toMatchObject({ rest: true, measureRest: true, pitches: [] });
  });
});

describe('parseStaff: values and dots', () => {
  it.each([
    ['w', 'whole', 4],
    ['h', 'half', 2],
    ['q', 'quarter', 1],
    ['e', 'eighth', 0.5],
    ['s', '16th', 0.25],
  ])('%s is a %s of %d quarter(s), a dot adds half', (value, type, quarters) => {
    const plain = one(`C4:${value}`);
    expect(plain.type).toBe(type);
    expect(plain.dots).toBe(0);
    expect(plain.length.num / plain.length.den).toBe(quarters);
    const dotted = one(`C4:${value}.`);
    expect(dotted.dots).toBe(1);
    expect(dotted.length.num / dotted.length.den).toBe(quarters * 1.5);
  });
});

describe('parseStaff: ties, marks, fingering, symbols', () => {
  it('~ ties the note to the next one', () => {
    expect(one('C4:h~').tie).toBe(true);
    expect(one('C4:h').tie).toBe(false);
  });

  it('( and ) start and end a slur', () => {
    expect(one('C4:q(')).toMatchObject({ slurStart: true, slurEnd: false });
    expect(one('C4:q)')).toMatchObject({ slurStart: false, slurEnd: true });
  });

  it('! is staccato, > an accent, _ a tenuto', () => {
    expect(one('C4:q!')).toMatchObject({ staccato: true, accent: false, tenuto: false });
    expect(one('C4:q>')).toMatchObject({ staccato: false, accent: true, tenuto: false });
    expect(one('C4:q_')).toMatchObject({ staccato: false, accent: false, tenuto: true });
  });

  it('marks combine after a dot and a tie', () => {
    expect(one('C4:q.~(!>')).toMatchObject({ dots: 1, tie: true, slurStart: true, staccato: true, accent: true });
  });

  it('@3 fingers a note; @1-3-5 a chord, bottom to top', () => {
    expect(one('C4:q@3').fingers).toEqual([3]);
    expect(one('<C4 E4 G4>:h@1-3-5').fingers).toEqual([1, 3, 5]);
    expect(one('C4:q').fingers).toBeUndefined();
  });

  it('{Cm7} prints a chord symbol at this onset', () => {
    expect(one('{Cm7}<Eb4 G4 Bb4>:h@1-2-4').symbol).toBe('Cm7');
    expect(one('{C/E}<E4 G4 C5>:h').symbol).toBe('C/E');
    expect(one('{Bø7}<A4 D5>:h').symbol).toBe('Bø7');
    expect(one('C4:q').symbol).toBeUndefined();
  });

  it('splits a staff into tokens at spaces, keeping a chord together', () => {
    const tokens = parseStaff('{C}<C4 E4 G4>:h@1-3-5 r:q C4:q', at);
    expect(tokens.map((t) => t.text)).toEqual(['{C}<C4 E4 G4>:h@1-3-5', 'r:q', 'C4:q']);
  });
});

describe('parseStaff: errors name the bar and the token', () => {
  it('an unknown value', () => {
    const message = errorOf(() => parseStaff('C4:q C4:x', at));
    expect(message).toMatch(/bar 3/);
    expect(message).toContain('"C4:x"');
  });

  it('a fingering count that does not match the chord', () => {
    const message = errorOf(() => parseStaff('<C4 E4 G4>:h@1-3', at));
    expect(message).toMatch(/bar 3/);
    expect(message).toContain('"<C4 E4 G4>:h@1-3"');
    expect(message).toMatch(/3 notes/);
  });

  it('an unreadable pitch', () => {
    const message = errorOf(() => parseStaff('H4:q', at));
    expect(message).toMatch(/bar 3/);
    expect(message).toContain('"H4:q"');
  });
});

describe('parseLessonBars: bar sums and ties (contract §2 rules)', () => {
  const whole = { rh: 'C4:w@1', lh: 'R:w' };

  it('accepts bars that add up to the metre', () => {
    const bars = parseLessonBars([whole, { rh: 'C4:h C4:q C4:q', lh: 'R:w' }], { metre: '4/4', pickup: false });
    expect(bars).toHaveLength(2);
    expect(bars[1]?.rh.map((t) => t.text)).toEqual(['C4:h', 'C4:q', 'C4:q']);
  });

  it('a bar whose sum is wrong names the bar, the staff and both lengths', () => {
    const message = errorOf(() =>
      parseLessonBars([whole, { rh: 'C4:h C4:q', lh: 'R:w' }], { metre: '4/4', pickup: false }),
    );
    expect(message).toMatch(/bar 2/);
    expect(message).toMatch(/rh/);
    expect(message).toMatch(/3 quarters/);
    expect(message).toMatch(/4 quarters/);
  });

  it('a pickup bar may be short when the last bar completes it', () => {
    const bars = parseLessonBars([{ rh: 'C4:q@1', lh: 'R:w' }, whole, { rh: 'C4:h. ', lh: 'R:w' }], {
      metre: '4/4',
      pickup: true,
    });
    expect(bars).toHaveLength(3);
    const message = errorOf(() =>
      parseLessonBars([{ rh: 'C4:q@1', lh: 'R:w' }, whole, { rh: 'C4:h', lh: 'R:w' }], { metre: '4/4', pickup: true }),
    );
    expect(message).toMatch(/pickup/);
  });

  it('a tie between different pitches names the bar and the token', () => {
    const message = errorOf(() =>
      parseLessonBars([{ rh: 'C4:h~@1 D4:h@2', lh: 'R:w' }], { metre: '4/4', pickup: false }),
    );
    expect(message).toMatch(/bar 1/);
    expect(message).toContain('"C4:h~@1"');
    expect(message).toMatch(/tie/);
  });

  it('a tie across the bar line to the same pitch is accepted', () => {
    expect(() =>
      parseLessonBars(
        [
          { rh: 'C4:h@1 C4:h~', lh: 'R:w' },
          { rh: 'C4:h C4:h', lh: 'R:w' },
        ],
        {
          metre: '4/4',
          pickup: false,
        },
      ),
    ).not.toThrow();
  });

  it('a whole-bar rest must stand alone in its staff', () => {
    const message = errorOf(() => parseLessonBars([{ rh: 'C4:w@1', lh: 'R:w C3:q' }], { metre: '4/4', pickup: false }));
    expect(message).toMatch(/bar 1/);
    expect(message).toMatch(/R/);
  });
});
