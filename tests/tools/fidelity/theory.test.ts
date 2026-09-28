// The independent exercise theory check (task T070, data-model.md §5, research R8), on the hand-written fixtures of
// tests/fixtures/musicxml/theory. Each rule is tested twice: the correct fixture gives no difference, and one
// planted error gives exactly one difference that names the chord, the bar, the hand and the rule (FR-014).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type ChordClaim,
  checkExercise,
  describeTheoryTone,
  type ExerciseClaim,
  expectedChordTones,
  expectedFifths,
  type Hand,
  type KeyClaim,
  type KeySegment,
  type SectionChord,
  type SectionClaim,
  type SectionHand,
  soundingMidi,
  type TheoryDifference,
} from '../../../tools/library/fidelity/theory';
import { buildMelodyFixture, type FixtureBar } from './melody-fixtures';

const fixture = (name: string): string => readFileSync(`tests/fixtures/musicxml/theory/${name}.musicxml`, 'utf8');

const both: Hand[] = ['left', 'right'];
const chord = (
  roman: string,
  quality: ChordClaim['quality'],
  inversion: ChordClaim['inversion'] = 0,
  hands: Hand[] = both,
): ChordClaim => ({ roman, quality, inversion, hands });
const key = (tonicLetter: KeyClaim['tonicLetter'], tonicAlter: KeyClaim['tonicAlter'], mode: KeyClaim['mode']) => ({
  tonicLetter,
  tonicAlter,
  mode,
});
const tones = (k: KeyClaim, c: ChordClaim): string[] => expectedChordTones(k, c).map(describeTheoryTone);

const G_SHARP_MINOR = key('G', 1, 'minor');
const E_FLAT_MINOR = key('E', -1, 'minor');
const C_MAJOR = key('C', 0, 'major');

const G_SHARP: ExerciseClaim = {
  itemId: 'fixture/g-sharp-minor-i-iv-v',
  key: G_SHARP_MINOR,
  chords: [chord('i', 'minor'), chord('iv', 'minor'), chord('V', 'major'), chord('i', 'minor')],
};
const E_FLAT: ExerciseClaim = {
  itemId: 'fixture/e-flat-minor-iv',
  key: E_FLAT_MINOR,
  chords: [chord('iv', 'minor')],
};
const INVERSIONS: ExerciseClaim = {
  itemId: 'fixture/c-major-tonic-inversions',
  key: C_MAJOR,
  chords: [chord('I', 'major', 1), chord('I', 'major', 2)],
};
const II_V_I: ExerciseClaim = {
  itemId: 'fixture/c-major-ii-v-i',
  key: C_MAJOR,
  chords: [chord('ii', 'minor'), chord('V', 'major'), chord('I', 'major')],
};

/** Replaces `from` by `to` once, and fails when `from` is not there (a mutation that changes nothing proves nothing). */
function mutate(xml: string, from: string, to: string): string {
  if (!xml.includes(from)) throw new Error(`the fixture has no "${from}"`);
  return xml.replace(from, to);
}
const pitchXml = (step: string, octave: number, alter = 0): string =>
  `<pitch><step>${step}</step>${alter !== 0 ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;

describe('the rules the check computes itself (data-model.md §5)', () => {
  it('sounding pitch comes from the letter, the alteration and the written octave (C-flat 4 = 59, B-sharp 3 = 60)', () => {
    expect(soundingMidi('C', -1, 4)).toBe(59);
    expect(soundingMidi('B', 1, 3)).toBe(60);
    expect(soundingMidi('F', 2, 4)).toBe(67);
    expect(soundingMidi('B', -2, 3)).toBe(57);
    expect(soundingMidi('C', 0, 4)).toBe(60);
  });

  it('the key signature comes from the tonic by the circle of fifths', () => {
    expect(expectedFifths(C_MAJOR)).toBe(0);
    expect(expectedFifths(key('A', 0, 'minor'))).toBe(0);
    expect(expectedFifths(G_SHARP_MINOR)).toBe(5);
    expect(expectedFifths(E_FLAT_MINOR)).toBe(-6);
    expect(expectedFifths(key('F', 1, 'major'))).toBe(6);
    expect(expectedFifths(key('D', -1, 'major'))).toBe(-5);
    expect(expectedFifths(key('B', -1, 'minor'))).toBe(-5);
    expect(expectedFifths(key('C', 1, 'minor'))).toBe(4);
    expect(expectedFifths(key('F', 0, 'major'))).toBe(-1);
  });

  it('the keys that need care (research R8) are spelled by letter arithmetic', () => {
    expect(tones(G_SHARP_MINOR, chord('V', 'major'))).toEqual(['D#', 'F##', 'A#']);
    expect(tones(E_FLAT_MINOR, chord('iv', 'minor'))).toEqual(['Ab', 'Cb', 'Eb']);
    expect(tones(key('B', -1, 'minor'), chord('iv', 'minor'))).toEqual(['Eb', 'Gb', 'Bb']);
    expect(tones(key('F', 1, 'major'), chord('V', 'major'))).toEqual(['C#', 'E#', 'G#']);
    expect(tones(E_FLAT_MINOR, chord('V', 'major'))).toEqual(['Bb', 'D', 'F']);
  });

  it('a minor key has its natural third and sixth in i and iv, and the harmonic-minor major V', () => {
    expect(tones(G_SHARP_MINOR, chord('i', 'minor'))).toEqual(['G#', 'B', 'D#']);
    expect(tones(G_SHARP_MINOR, chord('iv', 'minor'))).toEqual(['C#', 'E', 'G#']);
    expect(tones(key('A', 0, 'minor'), chord('V', 'major'))).toEqual(['E', 'G#', 'B']);
    expect(tones(key('C', 0, 'minor'), chord('V', 'major'))).toEqual(['G', 'B', 'D']);
    // The same tonic in the other quality: only the third moves (the parallel major of A minor).
    expect(tones(key('A', 0, 'minor'), chord('I', 'major'))).toEqual(['A', 'C#', 'E']);
  });

  it('every triad quality is stacked from its semitones (major 4+3, minor 3+4, diminished 3+3, augmented 4+4)', () => {
    expect(tones(C_MAJOR, chord('ii', 'minor'))).toEqual(['D', 'F', 'A']);
    expect(tones(C_MAJOR, chord('vii', 'diminished'))).toEqual(['B', 'D', 'F']);
    expect(tones(C_MAJOR, chord('III', 'augmented'))).toEqual(['E', 'G#', 'B#']);
    expect(tones(key('A', 0, 'minor'), chord('vii', 'diminished'))).toEqual(['G#', 'B', 'D']);
  });
});

describe('checkExercise on the correct fixtures', () => {
  it('G-sharp minor i-iv-V-i, with its double-sharp leading tone, gives no difference', () => {
    expect(checkExercise(fixture('g-sharp-minor-i-iv-v'), G_SHARP)).toEqual([]);
  });

  it('E-flat minor iv gives no difference', () => {
    expect(checkExercise(fixture('e-flat-minor-iv'), E_FLAT)).toEqual([]);
  });

  it('a first- and a second-inversion tonic give no difference', () => {
    expect(checkExercise(fixture('c-major-tonic-inversions'), INVERSIONS)).toEqual([]);
  });

  it('a C major ii-V-I, with its chord-name and Roman-numeral labels, gives no difference', () => {
    expect(checkExercise(fixture('c-major-ii-v-i'), II_V_I)).toEqual([]);
  });
});

describe('spelling is by (step, alter), never by the MIDI number alone', () => {
  it('F-double-sharp written as G (same MIDI number 67) in the G-sharp minor V: one spelling difference', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), pitchXml('F', 4, 2), pitchXml('G', 4));
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'right', rule: 'spelling', expected: 'F##', found: 'G4' },
    ]);
  });

  it('C-flat 5 written as B4 (same MIDI number 71) in the E-flat minor iv: one spelling difference', () => {
    const xml = mutate(fixture('e-flat-minor-iv'), pitchXml('C', 5, -1), pitchXml('B', 4));
    expect(checkExercise(xml, E_FLAT)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'right', rule: 'spelling', expected: 'Cb', found: 'B4' },
    ]);
  });

  it('the left hand is checked on its own: the same respelling there names the left hand', () => {
    const xml = mutate(fixture('e-flat-minor-iv'), pitchXml('C', 4, -1), pitchXml('B', 3));
    expect(checkExercise(xml, E_FLAT)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'left', rule: 'spelling', expected: 'Cb', found: 'B3' },
    ]);
  });
});

describe('a wrong chord tone', () => {
  it('a third moved a semitone (B4 -> B-sharp 4 in the tonic, bar 1): one pitch difference', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), pitchXml('B', 4), pitchXml('B', 4, 1));
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'right', rule: 'pitch', expected: 'B', found: 'B#4' },
    ]);
  });

  it('a natural minor v where the claim says V: the raised leading tone is missing', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), pitchXml('F', 4, 2), pitchXml('F', 4, 1));
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'right', rule: 'pitch', expected: 'F##', found: 'F#4' },
    ]);
  });

  it('a claim of the natural minor v against the harmonic-minor V of the file: both hands differ', () => {
    const claim: ExerciseClaim = {
      ...G_SHARP,
      chords: [chord('i', 'minor'), chord('iv', 'minor'), chord('v', 'minor'), chord('i', 'minor')],
    };
    expect(checkExercise(fixture('g-sharp-minor-i-iv-v'), claim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'right', rule: 'pitch', expected: 'F#', found: 'F##4' },
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'left', rule: 'pitch', expected: 'F#', found: 'F##3' },
      // The label "D♯ · V" also names a major chord, so it now disagrees with the minor v of the claim.
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'both', rule: 'label', expected: 'D#m', found: 'D♯' },
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'both', rule: 'label', expected: 'v', found: 'V' },
    ]);
  });

  it('a chord tone left out is a completeness difference, naming the missing tone', () => {
    const xml = mutate(
      fixture('c-major-ii-v-i'),
      `<note><chord/>${pitchXml('A', 4)}<duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note>`,
      '',
    );
    expect(checkExercise(xml, II_V_I)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'right',
        rule: 'completeness',
        expected: 'A',
        found: '(missing)',
      },
    ]);
  });

  it('an extra note in a chord is a completeness difference too', () => {
    const xml = mutate(
      fixture('c-major-ii-v-i'),
      `<note><chord/>${pitchXml('A', 4)}<duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note>`,
      `<note><chord/>${pitchXml('A', 4)}<duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note>` +
        `<note><chord/>${pitchXml('C', 5)}<duration>16</duration><voice>1</voice><type>whole</type><staff>1</staff></note>`,
    );
    expect(checkExercise(xml, II_V_I)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'right', rule: 'completeness', expected: '(none)', found: 'C5' },
    ]);
  });
});

describe('the inversion is the lowest sounding note of each hand', () => {
  it('a claim of root position against a first-inversion chord names both hands', () => {
    const claim: ExerciseClaim = { ...INVERSIONS, chords: [chord('I', 'major', 0), chord('I', 'major', 2)] };
    expect(checkExercise(fixture('c-major-tonic-inversions'), claim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'right',
        rule: 'inversion',
        expected: 'C in the bass',
        found: 'E4',
      },
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'left',
        rule: 'inversion',
        expected: 'C in the bass',
        found: 'E3',
      },
      // The file's own label says I⁶, which now disagrees with the claim as well.
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'label', expected: 'I', found: 'I⁶' },
    ]);
  });

  it('the bass of the right hand raised an octave changes that hand alone (first -> second inversion)', () => {
    const xml = mutate(fixture('c-major-tonic-inversions'), pitchXml('E', 4), pitchXml('E', 5));
    expect(checkExercise(xml, INVERSIONS)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'right',
        rule: 'inversion',
        expected: 'E in the bass',
        found: 'G4',
      },
    ]);
  });

  it('the hands may be claimed to play different shapes', () => {
    // The left hand of bar 1 is put into second inversion (G2 C3 E3) while the right hand stays in first inversion.
    let xml = mutate(fixture('c-major-tonic-inversions'), pitchXml('E', 3), pitchXml('G', 2));
    xml = mutate(xml, pitchXml('G', 3), pitchXml('C', 3));
    xml = mutate(xml, pitchXml('C', 4), pitchXml('E', 3));
    const shapes = (left: 0 | 1 | 2): ExerciseClaim => ({
      ...INVERSIONS,
      chords: [
        { roman: 'I', quality: 'major', inversion: 1, hands: both, handInversions: { left } },
        chord('I', 'major', 2),
      ],
    });
    expect(checkExercise(xml, shapes(2))).toEqual([]);
    expect(checkExercise(xml, shapes(1))).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'left',
        rule: 'inversion',
        expected: 'E in the bass',
        found: 'G2',
      },
    ]);
  });
});

describe('the key signature and the mode against the claim', () => {
  it('a wrong <fifths> is one key difference', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), '<fifths>5</fifths>', '<fifths>4</fifths>');
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: -1, bar: '1', hand: 'both', rule: 'key', expected: '5', found: '4' },
    ]);
  });

  it('a wrong <mode> is one mode difference', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), '<mode>minor</mode>', '<mode>major</mode>');
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: -1, bar: '1', hand: 'both', rule: 'mode', expected: 'minor', found: 'major' },
    ]);
  });

  it('a file without a <mode> is judged on its key signature alone', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), '<mode>minor</mode>', '');
    expect(checkExercise(xml, G_SHARP)).toEqual([]);
  });
});

describe('the <words> labels', () => {
  it('a chord name with the wrong quality is a label difference', () => {
    const xml = mutate(fixture('g-sharp-minor-i-iv-v'), 'D♯ · V', 'D♯m · V');
    expect(checkExercise(xml, G_SHARP)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'both', rule: 'label', expected: 'D#', found: 'D♯m' },
    ]);
  });

  it('a chord name with the wrong root is a label difference', () => {
    const xml = mutate(fixture('c-major-ii-v-i'), 'Dm · ii', 'Em · ii');
    expect(checkExercise(xml, II_V_I)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'label', expected: 'Dm', found: 'Em' },
    ]);
  });

  it('a Roman numeral in the wrong case (which says the wrong quality) is a label difference', () => {
    const xml = mutate(fixture('c-major-ii-v-i'), 'Dm · ii', 'Dm · II');
    expect(checkExercise(xml, II_V_I)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'label', expected: 'ii', found: 'II' },
    ]);
  });

  it('a figure for the wrong inversion is a label difference', () => {
    const xml = mutate(fixture('c-major-tonic-inversions'), 'C · I⁶⁴', 'C · I⁶');
    expect(checkExercise(xml, INVERSIONS)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 1, bar: '2', hand: 'both', rule: 'label', expected: 'I⁶⁴', found: 'I⁶' },
    ]);
  });

  it('free text that is not a chord name or a Roman numeral is not judged', () => {
    const xml = mutate(fixture('c-major-ii-v-i'), 'Dm · ii', 'A - right hand: scale · ii');
    expect(checkExercise(xml, II_V_I)).toEqual([]);
  });
});

describe('the chords and hands the claim names', () => {
  it('a claim of more chords than the file plays is a chordCount difference', () => {
    const claim: ExerciseClaim = { ...II_V_I, chords: [...II_V_I.chords, chord('I', 'major')] };
    expect(checkExercise(fixture('c-major-ii-v-i'), claim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 3,
        bar: '3',
        hand: 'both',
        rule: 'chordCount',
        expected: '4 chords',
        found: '3 chords',
      },
    ]);
  });

  it('a claim of one hand only, against a file that plays both hands, is a hands difference', () => {
    const claim: ExerciseClaim = { ...II_V_I, chords: [chord('ii', 'minor', 0, ['right']), ...II_V_I.chords.slice(1)] };
    expect(checkExercise(fixture('c-major-ii-v-i'), claim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'hands', expected: 'right', found: 'left, right' },
    ]);
  });

  it('a hand claimed to play the root alone (an octave) is checked against the root', () => {
    const doubled = mutate(
      fixture('c-major-ii-v-i'),
      // The last measure: the left-hand triad C3 E3 G3 becomes the root in two octaves, C2 and C3.
      `${pitchXml('C', 3)}<duration>16</duration><voice>5</voice><type>whole</type><staff>2</staff></note><note><chord/>${pitchXml('E', 3)}<duration>16</duration><voice>5</voice><type>whole</type><staff>2</staff></note><note><chord/>${pitchXml('G', 3)}<duration>16</duration><voice>5</voice><type>whole</type><staff>2</staff></note>`,
      `${pitchXml('C', 2)}<duration>16</duration><voice>5</voice><type>whole</type><staff>2</staff></note><note><chord/>${pitchXml('C', 3)}<duration>16</duration><voice>5</voice><type>whole</type><staff>2</staff></note>`,
    );
    const claim: ExerciseClaim = {
      ...II_V_I,
      chords: [
        ...II_V_I.chords.slice(0, 2),
        { roman: 'I', quality: 'major', inversion: 0, hands: ['right'], rootOnly: ['left'] },
      ],
    };
    expect(checkExercise(doubled, claim)).toEqual([]);
    // Without the claim of a root-only hand, the same file is an incomplete triad in the left hand.
    expect([...new Set(checkExercise(doubled, II_V_I).map((d) => d.rule))]).toEqual(['completeness']);
    // And a wrong note in that hand is named.
    const wrong = mutate(doubled, pitchXml('C', 2), pitchXml('D', 2));
    expect(checkExercise(wrong, claim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 2, bar: '3', hand: 'left', rule: 'pitch', expected: 'C', found: 'D2' },
    ]);
  });
});

describe('scale runs', () => {
  const RUN_XML = (notes: string[]): string =>
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>-6</fifths></key><staves>2</staves></attributes>${notes
      .map((n) => `<note>${n}<duration>1</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>`)
      .join('')}</measure></part></score-partwise>`;
  const scaleClaim: ExerciseClaim = {
    itemId: 'fixture/e-flat-minor-scale',
    key: E_FLAT_MINOR,
    chords: [],
    scales: [{ hand: 'right', tonicOctave: 4, degrees: [1, 2, 3, 4] }],
  };

  it('the natural-minor scale of E-flat minor is Eb F Gb Ab (letter arithmetic, semitones 2-1-2)', () => {
    const notes = [pitchXml('E', 4, -1), pitchXml('F', 4), pitchXml('G', 4, -1), pitchXml('A', 4, -1)];
    expect(checkExercise(RUN_XML(notes), scaleClaim)).toEqual([]);
  });

  it('a wrongly spelled scale note is one scale difference naming its position', () => {
    const notes = [pitchXml('E', 4, -1), pitchXml('F', 4), pitchXml('F', 4, 1), pitchXml('A', 4, -1)];
    expect(checkExercise(RUN_XML(notes), scaleClaim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: -1,
        scaleNote: 2,
        bar: '1',
        hand: 'right',
        rule: 'scale',
        expected: 'Gb4',
        found: 'F#4',
      },
    ]);
  });

  it('a scale that is too short is one scale difference', () => {
    const notes = [pitchXml('E', 4, -1), pitchXml('F', 4), pitchXml('G', 4, -1)];
    expect(checkExercise(RUN_XML(notes), scaleClaim).map((d) => d.rule)).toEqual(['scale']);
  });
});

// A tiny score builder for the voicing rules: each measure holds groups of pitches ("C4", "F#4") per hand, and each
// group fills its share of the 4/4 measure.
function scoreOf(measures: { words?: string; right?: string[][]; left?: string[][] }[]): string {
  const pitch = (name: string): string => {
    const m = /^([A-G])(##|#|bb|b)?(\d)$/.exec(name);
    if (!m) throw new Error(`bad pitch ${name}`);
    const alter = { '##': 2, '#': 1, b: -1, bb: -2 }[m[2] ?? ''] ?? 0;
    return pitchXml(m[1] as string, Number(m[3]), alter);
  };
  const hand = (groups: string[][], staff: number): string =>
    groups
      .map((g) => {
        const duration = `<duration>${16 / groups.length}</duration><voice>${staff}</voice><staff>${staff}</staff>`;
        if (g.length === 0) return `<note><rest/>${duration}</note>`;
        return g.map((n, k) => `<note>${k > 0 ? '<chord/>' : ''}${pitch(n)}${duration}</note>`).join('');
      })
      .join('');
  const body = measures
    .map(
      (m, i) =>
        `<measure number="${i + 1}">${i === 0 ? '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><staves>2</staves></attributes>' : ''}${m.words ? `<direction><direction-type><words>${m.words}</words></direction-type></direction>` : ''}${hand(m.right ?? [], 1)}<backup><duration>16</duration></backup>${hand(m.left ?? [], 2)}</measure>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
}
const claimOf = (...chords: ChordClaim[]): ExerciseClaim => ({ itemId: 'x', key: C_MAJOR, chords });

describe('voicing, and the two hands together', () => {
  it('a diminished leading-tone chord is labelled with the degree sign: "B° · vii°"', () => {
    const claim = claimOf(chord('vii', 'diminished'));
    const notes = { right: [['B4', 'D5', 'F5']], left: [['B3', 'D4', 'F4']] };
    expect(checkExercise(scoreOf([{ ...notes, words: 'B° · vii°' }]), claim)).toEqual([]);
    expect(checkExercise(scoreOf([{ ...notes, words: 'B° · vii' }]), claim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'label', expected: 'vii°', found: 'vii' },
    ]);
  });

  it('a triad spread over more than an octave is not in close position, in each hand that spreads it', () => {
    const xml = scoreOf([{ right: [['C4', 'G4', 'E5']], left: [['C3', 'G3', 'E4']] }]);
    expect(checkExercise(xml, claimOf(chord('I', 'major')))).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'right',
        rule: 'voicing',
        expected: 'close position (within an octave)',
        found: 'C4 to E5',
      },
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'left',
        rule: 'voicing',
        expected: 'close position (within an octave)',
        found: 'C3 to E4',
      },
    ]);
  });

  it('hands claimed to play the same shape must be an octave apart', () => {
    const xml = scoreOf([{ right: [['C4', 'E4', 'G4']], left: [['C2', 'E2', 'G2']] }]);
    expect(checkExercise(xml, claimOf(chord('I', 'major')))).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'both',
        rule: 'octave',
        expected: 'the left hand an octave below the right',
        found: 'left 36 40 43, right 60 64 67 (MIDI)',
      },
    ]);
    // A hand claimed to play on its own owes nothing to the other.
    expect(checkExercise(xml, claimOf({ ...chord('I', 'major'), handInversions: { left: 0 } }))).toEqual([]);
  });

  it('a wrong tone is reported once, not again as a voicing or an octave', () => {
    const xml = scoreOf([{ right: [['C4', 'E4', 'A4']], left: [['C3', 'E3', 'G3']] }]);
    expect(checkExercise(xml, claimOf(chord('I', 'major'))).map((d) => d.rule)).toEqual(['pitch']);
  });

  it('a key held by one hand while the other strikes it is an overlap, and only while it is held', () => {
    const held = scoreOf([{ right: [['C4', 'E4', 'G4']], left: [['C4']] }]);
    const claim = claimOf(chord('I', 'major', 0, ['right']));
    expect(checkExercise(held, claim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: -1,
        bar: '1',
        hand: 'both',
        rule: 'overlap',
        expected: 'each key played by one hand at a time',
        found: 'C4',
      },
    ]);
    // The right hand's chord is over before the left hand strikes the same key: no overlap.
    const after = scoreOf([{ right: [['C4', 'E4', 'G4'], []], left: [[], ['C4']] }]);
    expect(checkExercise(after, claim).map((d) => d.rule)).not.toContain('overlap');
  });
});

// ---- exercise-theory-v2 (feature 011, research R8): sections, scale claims per hand, broken and root-fifth voicings ----
// Tiny hand-written fixtures, each correct once and then with one planted error that gives exactly one difference.
describe('exercise-theory-v2: sections', () => {
  interface N {
    staff: 1 | 2;
    step: string;
    octave: number;
    alter?: number;
    /** Duration in quarters; the fixture uses divisions = 1. */
    quarters: number;
    chord?: boolean;
  }
  const n = (staff: 1 | 2, step: string, octave: number, quarters: number, alter = 0, chord = false): N => ({
    staff,
    step,
    octave,
    alter,
    quarters,
    chord,
  });
  const typeOf = (quarters: number) => (quarters === 4 ? 'whole' : quarters === 2 ? 'half' : 'quarter');
  const noteXml = (x: N): string =>
    `<note>${x.chord ? '<chord/>' : ''}${pitchXml(x.step, x.octave, x.alter ?? 0)}<duration>${x.quarters}</duration><voice>${x.staff}</voice><type>${typeOf(x.quarters)}</type><staff>${x.staff}</staff></note>`;
  const restXml = (staff: 1 | 2, quarters: number): string =>
    `<note><rest/><duration>${quarters}</duration><voice>${staff}</voice><type>${typeOf(quarters)}</type><staff>${staff}</staff></note>`;
  /** One measure: staff 1's events, a backup over them, staff 2's events. */
  const bar = (number: number, upper: string, lower: string): string =>
    `<measure number="${number}">${number === 1 ? '<attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>' : ''}${upper}<backup><duration>4</duration></backup>${lower}</measure>`;
  const file = (fifths: number, mode: string, measures: string[]): string =>
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${measures
      .join('')
      .replace(
        '<fifths>0</fifths><mode>major</mode>',
        `<fifths>${fifths}</fifths><mode>${mode}</mode>`,
      )}</part></score-partwise>`;
  const triad = (staff: 1 | 2, tones: [string, number, number?][], quarters: number): string =>
    tones.map(([step, octave, alter], i) => noteXml(n(staff, step, octave, quarters, alter ?? 0, i > 0))).join('');

  const A_MINOR = key('A', 0, 'minor');
  const chordOf = (
    roman: string,
    quality: ChordClaim['quality'],
    inversion: ChordClaim['inversion'],
    voicing: 'triad' | 'broken' | 'root-fifth' = 'triad',
  ): SectionChord => ({ roman, quality, inversion, voicing });
  const sectionClaim = (k: KeyClaim, right: SectionHand, left: SectionHand, lastBar = 1): SectionClaim => ({
    firstBar: 1,
    lastBar,
    key: k,
    right,
    left,
  });
  const scaleOf = (form: 'harmonic' | 'melodic', tonicOctave: number, degrees: number[]): SectionHand => ({
    kind: 'scale',
    form,
    tonicOctave,
    degrees,
  });
  const claimOf = (k: KeyClaim, chords: ChordClaim[], sections: SectionClaim[]): ExerciseClaim => ({
    itemId: 'fixture/v2',
    key: k,
    chords,
    sections,
  });

  describe('a scale in one hand against a chord in the other', () => {
    const cScaleFile = (rightNotes: N[]): string =>
      file(0, 'major', [
        bar(
          1,
          rightNotes.map(noteXml).join(''),
          triad(
            2,
            [
              ['C', 3],
              ['E', 3],
              ['G', 3],
            ],
            4,
          ),
        ),
      ]);
    const rightC = [n(1, 'C', 4, 1), n(1, 'D', 4, 1), n(1, 'E', 4, 1), n(1, 'F', 4, 1)];
    const claim = claimOf(
      C_MAJOR,
      [{ ...chord('I', 'major', 0, ['left']) }],
      [
        sectionClaim(C_MAJOR, scaleOf('harmonic', 4, [1, 2, 3, 4]), {
          kind: 'chords',
          chords: [chordOf('I', 'major', 0)],
        }),
      ],
    );

    it('a correct section gives no difference', () => {
      expect(checkExercise(cScaleFile(rightC), claim)).toEqual([]);
    });

    it('a wrong scale letter (D4 written as G4): one scale difference naming the note', () => {
      const xml = cScaleFile([rightC[0] as N, n(1, 'G', 4, 1), rightC[2] as N, rightC[3] as N]);
      expect(checkExercise(xml, claim)).toEqual<TheoryDifference[]>([
        {
          kind: 'theory',
          chordIndex: -1,
          scaleNote: 1,
          bar: '1',
          hand: 'right',
          rule: 'scale',
          expected: 'D4',
          found: 'G4',
        },
      ]);
    });

    it('a scale note missing at the end: one scale difference naming the count', () => {
      const xml = cScaleFile(rightC.slice(0, 3));
      expect(checkExercise(xml, claim).map((d) => d.rule)).toEqual(['scale']);
    });
  });

  describe('the minor scale forms', () => {
    const scaleFile = (notes: N[]): string => file(0, 'minor', [bar(1, notes.map(noteXml).join(''), restXml(2, 4))]);
    const claimFor = (form: 'harmonic' | 'melodic', degrees: number[]) =>
      claimOf(A_MINOR, [], [sectionClaim(A_MINOR, scaleOf(form, 3, degrees), { kind: 'rest' })]);
    const up = [n(1, 'E', 4, 1), n(1, 'F', 4, 1), n(1, 'G', 4, 1, 1), n(1, 'A', 4, 1)];

    it('harmonic minor A: the raised seventh G# is the scale', () => {
      expect(checkExercise(scaleFile(up), claimFor('harmonic', [5, 6, 7, 8]))).toEqual([]);
    });

    it('a missing raised 7th (G written natural): one scale difference, expected G#4, found G4', () => {
      const xml = scaleFile([up[0] as N, up[1] as N, n(1, 'G', 4, 1), up[3] as N]);
      expect(checkExercise(xml, claimFor('harmonic', [5, 6, 7, 8]))).toEqual<TheoryDifference[]>([
        {
          kind: 'theory',
          chordIndex: -1,
          scaleNote: 2,
          bar: '1',
          hand: 'right',
          rule: 'scale',
          expected: 'G#4',
          found: 'G4',
        },
      ]);
    });

    it('melodic minor going up raises the 6th and 7th: F# G# up', () => {
      const xml = scaleFile([n(1, 'E', 4, 1), n(1, 'F', 4, 1, 1), n(1, 'G', 4, 1, 1), n(1, 'A', 4, 1)]);
      expect(checkExercise(xml, claimFor('melodic', [5, 6, 7, 8]))).toEqual([]);
    });

    it('melodic minor going down restores them: A G F E, not A G# F# E', () => {
      const down = scaleFile([n(1, 'A', 4, 1), n(1, 'G', 4, 1), n(1, 'F', 4, 1), n(1, 'E', 4, 1)]);
      expect(checkExercise(down, claimFor('melodic', [8, 7, 6, 5]))).toEqual([]);
      const raised = scaleFile([n(1, 'A', 4, 1), n(1, 'G', 4, 1, 1), n(1, 'F', 4, 1), n(1, 'E', 4, 1)]);
      expect(checkExercise(raised, claimFor('melodic', [8, 7, 6, 5]))).toEqual<TheoryDifference[]>([
        {
          kind: 'theory',
          chordIndex: -1,
          scaleNote: 1,
          bar: '1',
          hand: 'right',
          rule: 'scale',
          expected: 'G4',
          found: 'G#4',
        },
      ]);
      // harmonic minor keeps the raised 7th going down
      expect(checkExercise(raised, claimFor('harmonic', [8, 7, 6, 5]))).toEqual([]);
    });

    it('a major key ignores the minor form: C major melodic is the major scale', () => {
      const xml = file(0, 'major', [
        bar(
          1,
          [n(1, 'C', 4, 1), n(1, 'D', 4, 1), n(1, 'E', 4, 1), n(1, 'F', 4, 1)].map(noteXml).join(''),
          restXml(2, 4),
        ),
      ]);
      expect(
        checkExercise(
          xml,
          claimOf(C_MAJOR, [], [sectionClaim(C_MAJOR, scaleOf('melodic', 4, [1, 2, 3, 4]), { kind: 'rest' })]),
        ),
      ).toEqual([]);
    });
  });

  describe('the hand a chord is written in', () => {
    const fileWith = (chordStaff: 1 | 2): string =>
      file(0, 'major', [
        bar(
          1,
          chordStaff === 1
            ? triad(
                1,
                [
                  ['C', 3],
                  ['E', 3],
                  ['G', 3],
                ],
                4,
              )
            : restXml(1, 4),
          chordStaff === 2
            ? triad(
                2,
                [
                  ['C', 3],
                  ['E', 3],
                  ['G', 3],
                ],
                4,
              )
            : restXml(2, 4),
        ),
      ]);
    const claim = claimOf(
      C_MAJOR,
      [chord('I', 'major', 0, ['left'])],
      [sectionClaim(C_MAJOR, { kind: 'rest' }, { kind: 'chords', chords: [chordOf('I', 'major', 0)] })],
    );

    it('the chord in the claimed hand gives no difference', () => {
      expect(checkExercise(fileWith(2), claim)).toEqual([]);
    });

    it('a chord in the wrong hand: one hands difference', () => {
      expect(checkExercise(fileWith(1), claim)).toEqual<TheoryDifference[]>([
        { kind: 'theory', chordIndex: 0, bar: '1', hand: 'both', rule: 'hands', expected: 'left', found: 'right' },
      ]);
    });
  });

  describe('inversions in a section', () => {
    const chordFile = (tones: [string, number, number?][]): string =>
      file(0, 'major', [bar(1, restXml(1, 4), triad(2, tones, 4))]);
    const claim = claimOf(
      C_MAJOR,
      [chord('V', 'major', 1, ['left'])],
      [sectionClaim(C_MAJOR, { kind: 'rest' }, { kind: 'chords', chords: [chordOf('V', 'major', 1)] })],
    );
    const V6: [string, number][] = [
      ['B', 2],
      ['D', 3],
      ['G', 3],
    ];

    it('V6 (B2 D3 G3) gives no difference', () => {
      expect(checkExercise(chordFile(V6), claim)).toEqual([]);
    });

    it('a wrong inversion (G3 written as G2, so the bass is G): one inversion difference', () => {
      expect(
        checkExercise(
          chordFile([
            ['B', 2],
            ['D', 3],
            ['G', 2],
          ]),
          claim,
        ),
      ).toEqual<TheoryDifference[]>([
        {
          kind: 'theory',
          chordIndex: 0,
          bar: '1',
          hand: 'left',
          rule: 'inversion',
          expected: 'B in the bass',
          found: 'G2',
        },
      ]);
    });
  });

  describe('broken chords and root-fifth voicings', () => {
    const brokenFile = (notes: N[]): string => file(0, 'major', [bar(1, restXml(1, 4), notes.map(noteXml).join(''))]);
    const brokenClaim = claimOf(
      C_MAJOR,
      [],
      [sectionClaim(C_MAJOR, { kind: 'rest' }, { kind: 'chords', chords: [chordOf('I', 'major', 0, 'broken')] })],
    );
    const broken = [n(2, 'C', 3, 1), n(2, 'E', 3, 1), n(2, 'G', 3, 1), n(2, 'E', 3, 1)];

    it('a broken triad is root, third, fifth, third', () => {
      expect(checkExercise(brokenFile(broken), brokenClaim)).toEqual([]);
    });

    it('a wrong note in a broken triad (the last third written as F): one pitch difference', () => {
      const xml = brokenFile([...broken.slice(0, 3), n(2, 'F', 3, 1)]);
      expect(checkExercise(xml, brokenClaim)).toEqual<TheoryDifference[]>([
        { kind: 'theory', chordIndex: 0, bar: '1', hand: 'left', rule: 'pitch', expected: 'E', found: 'F3' },
      ]);
    });

    const rootFifthFile = (notes: N[]): string =>
      file(0, 'major', [bar(1, restXml(1, 4), notes.map(noteXml).join(''))]);
    const rootFifthClaim = claimOf(
      C_MAJOR,
      [],
      [sectionClaim(C_MAJOR, { kind: 'rest' }, { kind: 'chords', chords: [chordOf('IV', 'major', 0, 'root-fifth')] })],
    );

    it('root-fifth is the root then the fifth (F2 C3 for IV)', () => {
      expect(checkExercise(rootFifthFile([n(2, 'F', 2, 2), n(2, 'C', 3, 2)]), rootFifthClaim)).toEqual([]);
    });

    it('a wrong fifth (C3 written as D3): one pitch difference', () => {
      expect(checkExercise(rootFifthFile([n(2, 'F', 2, 2), n(2, 'D', 3, 2)]), rootFifthClaim)).toEqual<
        TheoryDifference[]
      >([{ kind: 'theory', chordIndex: 0, bar: '1', hand: 'left', rule: 'pitch', expected: 'C', found: 'D3' }]);
    });
  });

  describe('a rest hand', () => {
    it('a hand claimed to rest that plays a note: one hands difference', () => {
      const xml = file(0, 'major', [bar(1, noteXml(n(1, 'C', 4, 4)), restXml(2, 4))]);
      const claim = claimOf(C_MAJOR, [], [sectionClaim(C_MAJOR, { kind: 'rest' }, { kind: 'rest' })]);
      expect(checkExercise(xml, claim).map((d) => d.rule)).toEqual(['hands']);
    });
  });
});

// Feature 011 T043 (research R8): a key claim per bar range. A key change is shown by a new signature (only when the fifths
// differ), the key name in a words direction at the arrival bar, and every chord after it is spelled in the new key.
describe('exercise-theory-v2: key segments', () => {
  const A_MINOR = key('A', 0, 'minor');
  const C_MINOR = key('C', 0, 'minor');
  const RIGHT: Hand[] = ['right'];
  const pitches = (tones: [string, number, number?][]): string =>
    tones
      .map(
        ([step, octave, alter], i) =>
          `<note>${i > 0 ? '<chord/>' : ''}${pitchXml(step, octave, alter ?? 0)}<duration>4</duration><voice>1</voice><type>whole</type><staff>1</staff></note>`,
      )
      .join('');
  const REST = '<note><rest/><duration>4</duration><voice>2</voice><type>whole</type><staff>2</staff></note>';
  const bar = (number: number, prefix: string, tones: [string, number, number?][]): string =>
    `<measure number="${number}">${prefix}${pitches(tones)}<backup><duration>4</duration></backup>${REST}</measure>`;
  const words = (text: string): string =>
    text === '' ? '' : `<direction><direction-type><words>${text}</words></direction-type></direction>`;
  const attributes = (fifths: number, mode: string): string =>
    `<attributes><key><fifths>${fifths}</fifths><mode>${mode}</mode></key></attributes>`;
  const first =
    '<attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key><staves>2</staves></attributes>';
  const file = (...measures: string[]): string =>
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
  const C_MAJOR_TRIAD: [string, number, number?][] = [
    ['C', 5],
    ['E', 5],
    ['G', 5],
  ];
  const A_MINOR_TRIAD: [string, number, number?][] = [
    ['A', 4],
    ['C', 5],
    ['E', 5],
  ];
  const C_MINOR_TRIAD: [string, number, number?][] = [
    ['C', 5],
    ['E', 5, -1],
    ['G', 5],
  ];
  const segments = (a: KeyClaim, b: KeyClaim): KeySegment[] => [
    { firstBar: 1, lastBar: 1, key: a },
    { firstBar: 2, lastBar: 2, key: b },
  ];
  const claim = (a: KeyClaim, b: KeyClaim, second: ChordClaim): ExerciseClaim => ({
    itemId: 'fixture/key-change',
    key: a,
    chords: [chord('I', 'major', 0, RIGHT), second],
    segments: segments(a, b),
  });
  /** C major then A minor: same signature, so only the words direction shows the change. */
  const relative = (arrival = words('A minor'), notes = A_MINOR_TRIAD): string =>
    file(bar(1, first, C_MAJOR_TRIAD), bar(2, arrival, notes));
  const relativeClaim = claim(C_MAJOR, A_MINOR, chord('i', 'minor', 0, RIGHT));
  const parallelClaim = claim(C_MAJOR, C_MINOR, chord('i', 'minor', 0, RIGHT));

  it('a relative change (one signature, the new key named in words) has no difference', () => {
    expect(checkExercise(relative(), relativeClaim)).toEqual([]);
  });

  it('a parallel change (new signature with the mode, the key named) has no difference', () => {
    const xml = file(
      bar(1, first, C_MAJOR_TRIAD),
      bar(2, `${words('C minor')}${attributes(-3, 'minor')}`, C_MINOR_TRIAD),
    );
    expect(checkExercise(xml, parallelClaim)).toEqual([]);
  });

  it('a parallel change that keeps the old signature: one key difference at the arrival bar', () => {
    const xml = file(bar(1, first, C_MAJOR_TRIAD), bar(2, words('C minor'), C_MINOR_TRIAD));
    expect(checkExercise(xml, parallelClaim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: -1, bar: '2', hand: 'both', rule: 'key', expected: '-3', found: '0' },
    ]);
  });

  it('a new signature written with the wrong mode: one mode difference at the arrival bar', () => {
    const xml = file(
      bar(1, first, C_MAJOR_TRIAD),
      bar(2, `${words('C minor')}${attributes(-3, 'major')}`, C_MINOR_TRIAD),
    );
    expect(checkExercise(xml, parallelClaim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: -1, bar: '2', hand: 'both', rule: 'mode', expected: 'minor', found: 'major' },
    ]);
  });

  it('a relative change that never names the new key: one key difference', () => {
    expect(checkExercise(relative(words('')), relativeClaim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: -1,
        bar: '2',
        hand: 'both',
        rule: 'key',
        expected: 'A minor named in a direction',
        found: '(none)',
      },
    ]);
  });

  it('a change that names the wrong key: one key difference', () => {
    expect(checkExercise(relative(words('A major')), relativeClaim)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: -1,
        bar: '2',
        hand: 'both',
        rule: 'key',
        expected: 'A minor named in a direction',
        found: 'A major',
      },
    ]);
  });

  it('the key name may be written with sharp and flat signs or with # and b', () => {
    const fSharpMinor = key('F', 1, 'minor');
    const xml = file(
      bar(1, first, C_MAJOR_TRIAD),
      bar(2, `${words('F♯ minor')}${attributes(3, 'minor')}`, [
        ['F', 4, 1],
        ['A', 4],
        ['C', 5, 1],
      ]),
    );
    const claimed = claim(C_MAJOR, fSharpMinor, chord('i', 'minor', 0, RIGHT));
    expect(checkExercise(xml, claimed)).toEqual([]);
    expect(checkExercise(xml.replace('F♯ minor', 'F# minor'), claimed)).toEqual([]);
  });

  it('the leading tone of the old key after the change (G natural in the dominant of A minor): one pitch difference', () => {
    const dominant = (g: number): [string, number, number?][] => [
      ['E', 5],
      ['G', 5, g],
      ['B', 5],
    ];
    const claimed = claim(C_MAJOR, A_MINOR, chord('V', 'major', 0, RIGHT));
    expect(checkExercise(relative(words('A minor'), dominant(1)), claimed)).toEqual([]);
    expect(checkExercise(relative(words('A minor'), dominant(0)), claimed)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 1, bar: '2', hand: 'right', rule: 'pitch', expected: 'G#', found: 'G5' },
    ]);
  });

  it('a wrong final tonic (a chord that is the tonic of the parallel major, not of the second key): one pitch difference', () => {
    const wrong: [string, number, number?][] = [
      ['A', 4],
      ['C', 5, 1],
      ['E', 5],
    ];
    expect(checkExercise(relative(words('A minor'), wrong), relativeClaim)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 1, bar: '2', hand: 'right', rule: 'pitch', expected: 'C', found: 'C#5' },
    ]);
  });

  it('the chords of the first segment are spelled in the first key', () => {
    const xml = file(bar(1, first, C_MINOR_TRIAD), bar(2, words('A minor'), A_MINOR_TRIAD));
    expect(checkExercise(xml, relativeClaim).map((d) => [d.bar, d.rule])).toEqual([['1', 'pitch']]);
  });

  it('a claim with no segments still checks the whole file in the claim key', () => {
    const plain: ExerciseClaim = { itemId: 'fixture/plain', key: C_MAJOR, chords: [chord('I', 'major', 0, RIGHT)] };
    expect(checkExercise(file(bar(1, first, C_MAJOR_TRIAD)), plain)).toEqual([]);
  });
});

// ---- exercise-theory-v3: a melody hand (feature 014, contract audit-record 1.3 §2) ----------------------------------
describe('exercise-theory-v3: a right-hand melody over left-hand chords', () => {
  const C = key('C', 0, 'major');
  const lhChord = (notes: [string, number][]) => ({
    notes: notes.map(([step, octave]) => ({ step: step as 'C', octave })),
    value: 'whole' as const,
  });
  const I = lhChord([
    ['C', 3],
    ['E', 3],
    ['G', 3],
  ]);
  const V6 = lhChord([
    ['B', 2],
    ['D', 3],
    ['G', 3],
  ]);
  const bars = (second: FixtureBar['left'][number] = I): FixtureBar[] => [
    {
      key: { fifths: 0, mode: 'major' },
      left: [I],
      right: [
        { step: 'C', octave: 4, value: 'half', fingering: 1 },
        { step: 'D', octave: 4, value: 'half' },
      ],
    },
    { left: [second], right: [{ step: 'E', octave: 4, value: 'whole' }] },
    { left: [V6], right: [{ step: 'D', octave: 4, value: 'whole' }] },
    { left: [I], right: [{ step: 'C', octave: 4, value: 'whole' }], barline: 'light-heavy' },
  ];
  const left = (roman: string, quality: ChordClaim['quality'], inversion: ChordClaim['inversion']): ChordClaim =>
    chord(roman, quality, inversion, ['left']);
  const claim: ExerciseClaim = {
    itemId: 'fixture/v3',
    key: C,
    chords: [left('I', 'major', 0), left('I', 'major', 0), left('V', 'major', 1), left('I', 'major', 0)],
    sections: [
      {
        firstBar: 1,
        lastBar: 4,
        key: C,
        right: { kind: 'melody', level: 'introduction' },
        left: {
          kind: 'chords',
          chords: [
            { roman: 'I', quality: 'major', inversion: 0, voicing: 'triad' },
            { roman: 'V', quality: 'major', inversion: 1, voicing: 'triad' },
          ],
        },
      },
    ],
  };

  it('does not compare the melody note by note (checkMelodyRules checks it, from the record)', () => {
    expect(checkExercise(buildMelodyFixture(bars()), claim)).toEqual([]);
  });

  it('still checks the left hand chord by chord', () => {
    const wrong = lhChord([
      ['C', 3],
      ['F', 3],
      ['A', 3],
    ]);
    const differences = checkExercise(buildMelodyFixture(bars(wrong)), claim);
    expect(differences.length).toBeGreaterThan(0);
    expect(differences.every((d) => d.bar === '2' && d.hand === 'left')).toBe(true);
  });
});
