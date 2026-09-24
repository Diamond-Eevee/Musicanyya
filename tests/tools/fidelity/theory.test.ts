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
  soundingMidi,
  type TheoryDifference,
} from '../../../tools/library/fidelity/theory';

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
