// The melody rule check (feature 014, task T005; data-model.md §4-§5, research R3-R8). Hand-written two-staff fixtures
// (melody-fixtures.ts, no generator import): one clean item per level gives no finding, and one planted fault per
// rule gives exactly that rule, at the right bar and beat. Fingers follow what a learner reads: a written finger sets
// the hand's position, an unwritten one continues it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Level } from '../../../src/core/library/types';
import {
  checkMelodyRules,
  checkMelodyVariation,
  type MelodyFinding,
  melodyDegrees,
} from '../../../tools/library/fidelity/melody-rules';
import type { KeyClaim } from '../../../tools/library/fidelity/theory';
import {
  buildMelodyFixture,
  type FixtureBar,
  type FixtureChordEvent,
  type FixtureMelodyEvent,
  type FixturePitch,
  type FixtureValue,
  type Letter,
} from './melody-fixtures';

// ---- fixture shorthand ---------------------------------------------------------------------------------------------

const PITCH = /^([A-G])(#{1,2}|b{1,2})?(\d)$/;
function pitch(name: string): FixturePitch {
  const m = PITCH.exec(name);
  if (!m) throw new Error(`bad pitch ${name}`);
  const acc = m[2] ?? '';
  const alter = acc.startsWith('#') ? acc.length : -acc.length;
  return { step: m[1] as Letter, octave: Number(m[3]), ...(alter !== 0 ? { alter } : {}) };
}
/** A melody note: `n('G#4', 'half', 3)` (the finger is written only when given). */
const n = (name: string, value: FixtureValue, fingering?: number): FixtureMelodyEvent => ({
  ...pitch(name),
  value,
  ...(fingering ? { fingering } : {}),
});
const rest = (value: FixtureValue): FixtureMelodyEvent => ({ value, rest: true });
/** A right-hand block chord: the top note plus `others` struck with it. */
const rhChord = (top: string, others: string[], value: FixtureValue): FixtureMelodyEvent => ({
  ...n(top, value),
  with: others.map(pitch),
});
const lh = (names: string, value: FixtureValue = 'whole'): FixtureChordEvent => ({
  notes: names.split(' ').map(pitch),
  value,
});
const bar = (left: string, right: FixtureMelodyEvent[], extra: Partial<FixtureBar> = {}): FixtureBar => ({
  left: [lh(left)],
  right,
  ...extra,
});

// Left-hand triads where generate.ts puts them (tonic in octave 3, E minor an octave lower).
const C_I = 'C3 E3 G3';
const C_II = 'D3 F3 A3';
const C_IV = 'C3 F3 A3';
const C_V = 'B2 D3 G3';
const C_VI = 'A2 C3 E3';
const A_I = 'A2 C3 E3';
const A_IV = 'A2 D3 F3';
const A_V = 'G#2 B2 E3';
const A_VI = 'A2 C3 F3';
const CM_I = 'C3 Eb3 G3';
const D_I = 'D3 F#3 A3';

const key = (tonicLetter: Letter, tonicAlter: KeyClaim['tonicAlter'], mode: KeyClaim['mode']): KeyClaim => ({
  tonicLetter,
  tonicAlter,
  mode,
});
const C_MAJOR = key('C', 0, 'major');
const C_MINOR = key('C', 0, 'minor');
const A_MINOR = key('A', 0, 'minor');
const D_MAJOR = key('D', 0, 'major');
const SIG_C = { fifths: 0, mode: 'major' as const };
const SIG_A_MINOR = { fifths: 0, mode: 'minor' as const };
const SIG_C_MINOR = { fifths: -3, mode: 'minor' as const };
const SIG_D = { fifths: 2, mode: 'major' as const };

function check(
  bars: FixtureBar[],
  level: Level,
  keys: { firstBar: number; key: KeyClaim }[],
): { rule: string; bar: number; beat: number }[] {
  const findings: MelodyFinding[] = checkMelodyRules({
    itemId: 'fixture/melody',
    xml: buildMelodyFixture(bars),
    level,
    keys,
  });
  for (const f of findings) {
    expect(f.itemId).toBe('fixture/melody');
    expect(f.message.length).toBeGreaterThan(0);
  }
  return findings.map((f) => ({ rule: f.rule, bar: f.bar, beat: f.beat }));
}

// ---- the clean fixtures, one per level -----------------------------------------------------------------------------

/** Introduction, C major to A minor: half and whole notes, steps only, one five-finger position (thumb on F4) for the
 *  whole item, G♯ as a lower neighbour after the change. */
const introduction = (): FixtureBar[] => [
  bar(C_I, [n('G4', 'half', 2), n('A4', 'half')], { key: SIG_C }),
  bar(C_I, [n('G4', 'whole')]),
  bar(C_IV, [n('A4', 'whole')], { barline: 'light-light' }),
  bar(A_I, [n('A4', 'half'), n('G#4', 'half')], { key: SIG_A_MINOR, wordsAbove: 'A minor' }),
  bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }),
];
const INTRO_KEYS = [
  { firstBar: 1, key: C_MAJOR },
  { firstBar: 4, key: A_MINOR },
];

/** Beginner, C major to C minor: quarters, leaps of a third to chord notes, the C position throughout. */
const beginner = (): FixtureBar[] => [
  bar(C_I, [n('C4', 'quarter', 1), n('D4', 'quarter'), n('E4', 'half')], { key: SIG_C }),
  bar(C_V, [n('G4', 'half'), n('F4', 'half')]),
  bar(C_I, [n('E4', 'half'), n('D4', 'quarter'), n('C4', 'quarter')], { barline: 'light-light' }),
  bar(CM_I, [n('Eb4', 'half'), n('F4', 'quarter'), n('G4', 'quarter')], {
    key: SIG_C_MINOR,
    wordsAbove: 'C minor',
  }),
  bar(C_V, [n('G4', 'half'), n('F4', 'half')]),
  bar(CM_I, [n('Eb4', 'quarter'), n('D4', 'quarter'), n('C4', 'half')], { barline: 'light-heavy' }),
];
const BEGINNER_KEYS = [
  { firstBar: 1, key: C_MAJOR },
  { firstBar: 4, key: C_MINOR },
];

/** Intermediate, C major to A minor: eighth pairs on the beat, a thumb-under and a finger-over, leaps up to a fourth
 *  to chord notes, a new position at the key change. */
const intermediate = (): FixtureBar[] => [
  bar(C_I, [n('C4', 'half', 1), n('D4', 'eighth'), n('E4', 'eighth'), n('F4', 'eighth', 1), n('G4', 'eighth')], {
    key: SIG_C,
  }),
  bar(C_IV, [n('A4', 'quarter'), n('B4', 'eighth'), n('C5', 'eighth'), n('A4', 'half')]),
  bar(C_V, [n('G4', 'quarter'), n('F4', 'eighth'), n('E4', 'eighth', 3), n('D4', 'half')]),
  bar(C_I, [n('C4', 'half'), n('E4', 'half')], { barline: 'light-light' }),
  bar(A_I, [n('E4', 'quarter', 1), n('A4', 'quarter'), n('G#4', 'quarter'), n('A4', 'quarter')], {
    key: SIG_A_MINOR,
    wordsAbove: 'A minor',
  }),
  bar(A_IV, [n('A4', 'half'), n('F4', 'half')]),
  bar(A_V, [n('E4', 'half'), n('G#4', 'half')]),
  bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }),
];
const INTERMEDIATE_KEYS = [
  { firstBar: 1, key: C_MAJOR },
  { firstBar: 5, key: A_MINOR },
];

/** Advanced, C major: a dotted rhythm, an off-beat passing eighth, leaps up to a sixth to chord notes, shifts. */
const advanced = (): FixtureBar[] => [
  bar(C_I, [n('C5', 'dotted-quarter', 1), n('D5', 'eighth'), n('E5', 'half')], { key: SIG_C }),
  bar(C_VI, [n('E5', 'half'), n('C5', 'half')]),
  bar(C_IV, [n('C5', 'half'), n('A5', 'half', 5)]),
  bar(C_V, [n('G5', 'half'), n('D5', 'half', 1)]),
  bar(C_I, [n('C5', 'whole', 2)], { barline: 'light-heavy' }),
];
const C_KEYS = [{ firstBar: 1, key: C_MAJOR }];

/** Beginner, A minor only (no key change): the base of the minor-degree faults. Position thumb on E4. */
const minorBeginner = (): FixtureBar[] => [
  bar(A_I, [n('A4', 'half', 4), n('G#4', 'quarter'), n('A4', 'quarter')], { key: SIG_A_MINOR }),
  bar(A_IV, [n('F4', 'half'), n('G4', 'quarter'), n('F4', 'quarter')]),
  bar(A_V, [n('E4', 'half'), n('G#4', 'half')]),
  bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }),
];
const A_KEYS = [{ firstBar: 1, key: A_MINOR }];

/** Replaces bar `number` (1-based) of a fixture. */
const withBar = (bars: FixtureBar[], number: number, replacement: FixtureBar): FixtureBar[] =>
  bars.map((b, i) => (i === number - 1 ? replacement : b));

describe('checkMelodyRules: one clean fixture per level', () => {
  it('introduction (C major to A minor) has no finding', () => {
    expect(check(introduction(), 'introduction', INTRO_KEYS)).toEqual([]);
  });
  it('beginner (C major to C minor) has no finding', () => {
    expect(check(beginner(), 'beginner', BEGINNER_KEYS)).toEqual([]);
  });
  it('intermediate (C major to A minor) has no finding', () => {
    expect(check(intermediate(), 'intermediate', INTERMEDIATE_KEYS)).toEqual([]);
  });
  it('advanced (C major) has no finding', () => {
    expect(check(advanced(), 'advanced', C_KEYS)).toEqual([]);
  });
  it('the minor base of the minor-degree faults (beginner, A minor) has no finding', () => {
    expect(check(minorBeginner(), 'beginner', A_KEYS)).toEqual([]);
  });
});

describe('checkMelodyRules: one planted fault per rule', () => {
  it('key: a B-flat passing tone in C major', () => {
    const bars = withBar(
      intermediate(),
      2,
      bar(C_IV, [n('A4', 'quarter'), n('Bb4', 'eighth'), n('C5', 'eighth'), n('A4', 'half')]),
    );
    expect(check(bars, 'intermediate', INTERMEDIATE_KEYS)).toEqual([{ rule: 'key', bar: 2, beat: 2 }]);
  });

  it('chord-tone: D over the vi chord (A C E) when it starts', () => {
    const bars = withBar(advanced(), 2, bar(C_VI, [n('D5', 'half'), n('C5', 'half')]));
    expect(check(bars, 'advanced', C_KEYS)).toEqual([{ rule: 'chord-tone', bar: 2, beat: 1 }]);
  });

  it('non-chord-tone: a leap to G over the IV chord (F A C)', () => {
    const bars = withBar(
      intermediate(),
      2,
      bar(C_IV, [n('A4', 'quarter'), n('B4', 'eighth'), n('C5', 'eighth'), n('G4', 'half')]),
    );
    expect(check(bars, 'intermediate', INTERMEDIATE_KEYS)).toEqual([{ rule: 'non-chord-tone', bar: 2, beat: 3 }]);
  });

  it('minor-degree: a natural 7th leading up to the tonic (A G A over i)', () => {
    const bars = withBar(
      minorBeginner(),
      1,
      bar(A_I, [n('A4', 'half', 4), n('G4', 'quarter'), n('A4', 'quarter')], { key: SIG_A_MINOR }),
    );
    expect(check(bars, 'beginner', A_KEYS)).toEqual([{ rule: 'minor-degree', bar: 1, beat: 3 }]);
  });

  it('minor-degree: a raised 6th that is not in 5-♯6-♯7-1 (E F♯ E)', () => {
    const bars = withBar(
      minorBeginner(),
      1,
      bar(A_I, [n('E4', 'half', 1), n('F#4', 'quarter'), n('E4', 'quarter')], { key: SIG_A_MINOR }),
    );
    expect(check(bars, 'beginner', A_KEYS)).toEqual([{ rule: 'minor-degree', bar: 1, beat: 3 }]);
  });

  it('minor-degree: a raised 7th over VI (G♯ against F A C)', () => {
    let bars = withBar(minorBeginner(), 2, bar(A_VI, [n('A4', 'half'), n('G#4', 'quarter'), n('A4', 'quarter')]));
    bars = withBar(bars, 3, bar(A_V, [n('B4', 'half'), n('G#4', 'half')]));
    expect(check(bars, 'beginner', A_KEYS)).toEqual([{ rule: 'minor-degree', bar: 2, beat: 3 }]);
  });

  it('augmented-second: F to G♯ in the melody', () => {
    const bars = withBar(minorBeginner(), 3, bar(A_V, [n('E4', 'quarter'), n('F4', 'quarter'), n('G#4', 'half')]));
    expect(check(bars, 'beginner', A_KEYS)).toEqual([{ rule: 'augmented-second', bar: 3, beat: 3 }]);
  });

  it('cross-relation: G natural in the melody while the left hand holds G♯', () => {
    const bars: FixtureBar[] = [
      bar(A_I, [n('A4', 'half', 4), n('E4', 'half')], { key: SIG_A_MINOR }),
      bar(A_V, [n('B4', 'half'), n('B4', 'quarter'), n('A4', 'eighth'), n('G4', 'eighth')]),
      bar(A_IV, [n('F4', 'half'), n('A4', 'half')]),
      bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }),
    ];
    expect(check(bars, 'intermediate', A_KEYS)).toEqual([{ rule: 'cross-relation', bar: 2, beat: 4.5 }]);
  });

  it('clash: F against the chord’s E on the strong third beat', () => {
    const bars = withBar(introduction(), 1, bar(C_I, [n('G4', 'half', 2), n('F4', 'half')], { key: SIG_C }));
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([{ rule: 'clash', bar: 1, beat: 3 }]);
  });

  describe('parallel-octaves: C over C then D over D, both moving up', () => {
    const bars: FixtureBar[] = [
      bar(C_I, [n('C4', 'half', 1), n('E4', 'half')], { key: SIG_C }),
      bar(C_II, [n('D4', 'half'), n('F4', 'half')]),
      bar(C_V, [n('D4', 'whole')]),
      bar(C_I, [n('C4', 'whole')], { barline: 'light-heavy' }),
    ];
    it('is a finding at intermediate', () => {
      expect(check(bars, 'intermediate', C_KEYS)).toEqual([{ rule: 'parallel-octaves', bar: 2, beat: 1 }]);
    });
    it('is allowed at beginner', () => {
      expect(check(bars, 'beginner', C_KEYS)).toEqual([]);
    });
  });

  it('register: B5 above the intermediate ceiling A5', () => {
    const bars: FixtureBar[] = [
      bar(C_I, [n('E5', 'half', 1), n('G5', 'half')], { key: SIG_C }),
      bar(C_V, [n('G5', 'half'), n('B5', 'half')]),
      bar(C_I, [n('G5', 'whole')]),
      bar(C_I, [n('C5', 'whole', 1)], { barline: 'light-heavy' }),
    ];
    expect(check(bars, 'intermediate', C_KEYS)).toEqual([{ rule: 'register', bar: 2, beat: 3 }]);
  });

  it('hand-gap: D4 a whole tone above the left hand’s C4', () => {
    const bars = withBar(
      beginner(),
      3,
      bar('E3 G3 C4', [n('E4', 'half'), n('D4', 'half')], { barline: 'light-light' }),
    );
    expect(check(bars, 'beginner', BEGINNER_KEYS)).toEqual([{ rule: 'hand-gap', bar: 3, beat: 3 }]);
  });

  it('leap: a fourth (C to G) at beginner', () => {
    let bars = withBar(
      beginner(),
      1,
      bar(C_I, [n('C4', 'quarter', 1), n('D4', 'quarter'), n('C4', 'half')], { key: SIG_C }),
    );
    bars = withBar(bars, 2, bar(C_V, [n('G4', 'half'), n('F4', 'half')]));
    expect(check(bars, 'beginner', BEGINNER_KEYS)).toEqual([{ rule: 'leap', bar: 2, beat: 1 }]);
  });

  it('range: C4 to A4 in one beginner section (wider than five notes)', () => {
    const bars: FixtureBar[] = [
      bar(C_I, [n('C4', 'quarter', 1), n('D4', 'quarter'), n('E4', 'half')], { key: SIG_C }),
      bar(C_V, [n('G4', 'half'), rest('half')]),
      bar(C_V, [n('G4', 'half', 1), n('A4', 'quarter'), n('B4', 'quarter')]),
      bar(C_I, [n('C5', 'whole')], { barline: 'light-heavy' }),
    ];
    expect(check(bars, 'beginner', C_KEYS)).toEqual([{ rule: 'range', bar: 3, beat: 3 }]);
  });

  it('value: a dotted value at intermediate', () => {
    const bars = withBar(
      intermediate(),
      4,
      bar(C_I, [n('C4', 'dotted-half'), n('E4', 'quarter')], { barline: 'light-light' }),
    );
    expect(check(bars, 'intermediate', INTERMEDIATE_KEYS)).toEqual([{ rule: 'value', bar: 4, beat: 1 }]);
  });

  it('value: eighths at beginner', () => {
    const bars = withBar(
      beginner(),
      1,
      bar(C_I, [n('C4', 'quarter', 1), n('D4', 'eighth'), n('E4', 'eighth'), n('E4', 'half')], { key: SIG_C }),
    );
    expect(check(bars, 'beginner', BEGINNER_KEYS)).toEqual([
      { rule: 'value', bar: 1, beat: 2 },
      { rule: 'value', bar: 1, beat: 2.5 },
    ]);
  });

  it('shift: a new five-finger position at the key change of an introduction item', () => {
    const bars = withBar(
      introduction(),
      4,
      bar(A_I, [n('A4', 'half', 4), n('G#4', 'half')], { key: SIG_A_MINOR, wordsAbove: 'A minor' }),
    );
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([{ rule: 'shift', bar: 4, beat: 1 }]);
  });

  it('fingering: a thumb-under onto a black key (E to F♯ in D major)', () => {
    const bars: FixtureBar[] = [
      bar(D_I, [n('D4', 'quarter', 1), n('E4', 'quarter'), n('F#4', 'quarter', 1), n('G4', 'quarter')], { key: SIG_D }),
      bar(D_I, [n('A4', 'half'), n('F#4', 'half')]),
      bar(D_I, [n('D4', 'whole', 1)], { barline: 'light-heavy' }),
    ];
    expect(check(bars, 'intermediate', [{ firstBar: 1, key: D_MAJOR }])).toEqual([
      { rule: 'fingering', bar: 1, beat: 3 },
    ]);
  });

  it('fingering: an ascending step from finger 3 to finger 2', () => {
    const bars = withBar(intermediate(), 8, bar(A_I, [n('A4', 'whole', 2)], { barline: 'light-heavy' }));
    expect(check(bars, 'intermediate', INTERMEDIATE_KEYS)).toEqual([{ rule: 'fingering', bar: 8, beat: 1 }]);
  });

  it('ending: the melody ends on the third, not the tonic', () => {
    const bars = withBar(
      beginner(),
      6,
      bar(CM_I, [n('Eb4', 'quarter'), n('D4', 'quarter'), n('Eb4', 'half')], { barline: 'light-heavy' }),
    );
    expect(check(bars, 'beginner', BEGINNER_KEYS)).toEqual([{ rule: 'ending', bar: 6, beat: 3 }]);
  });

  it('key-change: no pitch class of the new key only within two bars of the change', () => {
    let bars = withBar(introduction(), 4, bar(A_I, [n('A4', 'whole')], { key: SIG_A_MINOR, wordsAbove: 'A minor' }));
    bars = withBar(bars, 5, bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }));
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([{ rule: 'key-change', bar: 4, beat: 1 }]);
  });

  it('key-change: a note of the old key only after the change (E♭ in C major after C minor)', () => {
    const bars: FixtureBar[] = [
      bar(CM_I, [n('C4', 'quarter', 1), n('D4', 'quarter'), n('Eb4', 'half')], { key: SIG_C_MINOR }),
      bar(C_V, [n('D4', 'whole')], { barline: 'light-light' }),
      bar(C_I, [n('E4', 'half'), n('D4', 'quarter'), n('C4', 'quarter')], { key: SIG_C, wordsAbove: 'C major' }),
      bar(C_V, [n('D4', 'quarter'), n('Eb4', 'quarter'), n('D4', 'half')]),
      bar(C_I, [n('C4', 'whole')], { barline: 'light-heavy' }),
    ];
    const keys = [
      { firstBar: 1, key: C_MINOR },
      { firstBar: 3, key: C_MAJOR },
    ];
    expect(check(bars, 'beginner', keys)).toEqual([{ rule: 'key-change', bar: 4, beat: 2 }]);
  });

  it('static: G held for three bars over a repeated chord', () => {
    const bars: FixtureBar[] = [
      bar(C_I, [n('G4', 'whole', 2)], { key: SIG_C }),
      bar(C_I, [n('G4', 'whole')]),
      bar(C_I, [n('G4', 'whole')]),
      bar(C_IV, [n('A4', 'whole')], { barline: 'light-light' }),
      bar(A_I, [n('A4', 'half'), n('G#4', 'half')], { key: SIG_A_MINOR, wordsAbove: 'A minor' }),
      bar(A_I, [n('A4', 'whole')], { barline: 'light-heavy' }),
    ];
    const keys = [
      { firstBar: 1, key: C_MAJOR },
      { firstBar: 5, key: A_MINOR },
    ];
    expect(check(bars, 'introduction', keys)).toEqual([{ rule: 'static', bar: 1, beat: 1 }]);
  });

  it('doubled: the right hand strikes the left hand’s chord in the middle of the item', () => {
    const bars = withBar(introduction(), 2, bar(C_I, [rhChord('G4', ['C4', 'E4'], 'whole')]));
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([{ rule: 'doubled', bar: 2, beat: 1 }]);
  });

  it('doubled: a single closing tonic chord in both hands is not flagged', () => {
    const bars = withBar(
      introduction(),
      5,
      bar(A_I, [rhChord('A4', ['C4', 'E4'], 'whole')], { barline: 'light-heavy' }),
    );
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([]);
  });
});

describe('checkMelodyVariation (FR-008)', () => {
  it('flags a family whose items all share one degree sequence', () => {
    const findings = checkMelodyVariation([
      { itemId: 'a', degrees: '5 6 5 | 1 ♯7 1' },
      { itemId: 'b', degrees: '5 6 5 | 1 ♯7 1' },
      { itemId: 'c', degrees: '5 6 5 | 1 ♯7 1' },
    ]);
    expect(findings.map((f) => f.rule)).toEqual(['variation']);
  });
  it('passes a family with two degree sequences', () => {
    expect(
      checkMelodyVariation([
        { itemId: 'a', degrees: '5 6 5 | 1 ♯7 1' },
        { itemId: 'b', degrees: '3 2 1 | 1 ♯7 1' },
        { itemId: 'c', degrees: '5 6 5 | 1 ♯7 1' },
      ]),
    ).toEqual([]);
  });
});

describe('melodyDegrees', () => {
  it('names each melody note by its degree in the key in force, key segments apart', () => {
    const xml = buildMelodyFixture(introduction());
    expect(melodyDegrees({ itemId: 'fixture/melody', xml, keys: INTRO_KEYS })).toBe('5 6 5 6 | 1 ♯7 1');
  });
});

describe('leaps', () => {
  it('a repeated note is not a leap, even at introduction', () => {
    const bars = withBar(introduction(), 1, bar(C_I, [n('G4', 'half', 2), n('G4', 'half')], { key: SIG_C }));
    expect(check(bars, 'introduction', INTRO_KEYS)).toEqual([]);
  });
});

describe('independence from the generator (research R8)', () => {
  it('melody-rules.ts imports nothing from src/core/library/exercise/', () => {
    const source = readFileSync('tools/library/fidelity/melody-rules.ts', 'utf8');
    const imports = [...source.matchAll(/^\s*import[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) expect(path).not.toMatch(/library\/exercise/);
    expect(source).not.toMatch(/content\/library\/exercises/);
  });
});
