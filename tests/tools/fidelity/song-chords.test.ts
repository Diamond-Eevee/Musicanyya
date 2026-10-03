// Feature 011 T055 (research R9, contract song-definition §3): the independent check of a song's left-hand chords. Every chord
// on staff 2 must be the triad its printed name spells, and every name must be in the set its level promises. Each rule is
// tested twice: the correct file gives no difference, and one planted error gives exactly one.
import { describe, expect, it } from 'vitest';
import { checkSong, checkSongChords, songKeyOfItemId } from '../../../tools/library/fidelity/song-chords';
import type { KeyClaim, TheoryDifference } from '../../../tools/library/fidelity/theory';

type Tone = [step: string, octave: number, alter?: number];
interface Entry {
  /** Beat of the bar, from 1. */
  beat: number;
  /** Quarters the chord lasts. */
  quarters: number;
  /** The printed chord name (words above staff 1); left out on a tied continuation. */
  name?: string;
  tones: Tone[];
  /** A continuation of the chord of the bar before: tied, no new attack. */
  tieStop?: boolean;
}

const C_MAJOR: KeyClaim = { tonicLetter: 'C', tonicAlter: 0, mode: 'major' };
const A_MINOR: KeyClaim = { tonicLetter: 'A', tonicAlter: 0, mode: 'minor' };

const pitch = ([step, octave, alter]: Tone) =>
  `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;

/** One 4/4 bar: staff 1 gets a word direction and a melody note at each chord, staff 2 the chord's triad. */
function bar(number: number, entries: Entry[], fifths: number, mode: string): string {
  const upper = entries
    .map(
      (e) =>
        `${e.name ? `<direction><direction-type><words>${e.name}</words></direction-type><staff>1</staff></direction>` : ''}` +
        `<note>${pitch(['C', 5])}<duration>${e.quarters}</duration><voice>1</voice><staff>1</staff></note>`,
    )
    .join('');
  const lower = entries
    .map((e) =>
      e.tones
        .map(
          (t, i) =>
            `<note>${i > 0 ? '<chord/>' : ''}${pitch(t)}<duration>${e.quarters}</duration>${e.tieStop ? '<tie type="stop"/>' : ''}<voice>2</voice><staff>2</staff></note>`,
        )
        .join(''),
    )
    .join('');
  const attributes =
    number === 1
      ? `<attributes><divisions>1</divisions><key><fifths>${fifths}</fifths><mode>${mode}</mode></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves></attributes>`
      : '';
  return `<measure number="${number}">${attributes}${upper}<backup><duration>4</duration></backup>${lower}</measure>`;
}

const file = (fifths: number, mode: string, bars: Entry[][]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1">${bars.map((b, i) => bar(i + 1, b, fifths, mode)).join('')}</part></score-partwise>`;

const chord = (beat: number, quarters: number, name: string, tones: Tone[]): Entry => ({ beat, quarters, name, tones });
const C: Tone[] = [
  ['C', 3],
  ['E', 3],
  ['G', 3],
];
const F: Tone[] = [
  ['C', 3],
  ['F', 3],
  ['A', 3],
];
const G: Tone[] = [
  ['B', 2],
  ['D', 3],
  ['G', 3],
];
const AM: Tone[] = [
  ['C', 3],
  ['E', 3],
  ['A', 3],
];

const beginner = { level: 'beginner' as const, key: C_MAJOR };
const intermediate = { level: 'intermediate' as const, key: C_MAJOR };

/** C F G C, one chord per bar. */
const CORRECT = file(0, 'major', [
  [chord(1, 4, 'C', C)],
  [chord(1, 4, 'F', F)],
  [chord(1, 4, 'G', G)],
  [chord(1, 4, 'C', C)],
]);

describe('checkSongChords: the chords match their printed names', () => {
  it('a correct beginner song in C major has no difference', () => {
    expect(checkSongChords(CORRECT, beginner)).toEqual([]);
  });

  it('a planted wrong third (E-flat under the name "C"): one pitch difference at that bar', () => {
    const xml = file(0, 'major', [
      [
        chord(1, 4, 'C', [
          ['C', 3],
          ['E', 3, -1],
          ['G', 3],
        ]),
      ],
      [chord(1, 4, 'F', F)],
    ]);
    expect(checkSongChords(xml, beginner)).toEqual<TheoryDifference[]>([
      { kind: 'theory', chordIndex: 0, bar: '1', hand: 'left', rule: 'pitch', expected: 'E', found: 'Eb3' },
    ]);
  });

  it('a chord that is another chord than its name (F under the name "C"): differences name the chord', () => {
    const xml = file(0, 'major', [[chord(1, 4, 'C', F)]]);
    const found = checkSongChords(xml, beginner);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((d) => d.bar === '1' && d.hand === 'left' && d.chordIndex === 0)).toBe(true);
  });

  it('a chord of two notes: one completeness difference', () => {
    const xml = file(0, 'major', [
      [
        chord(1, 4, 'C', [
          ['C', 3],
          ['G', 3],
        ]),
      ],
    ]);
    expect(checkSongChords(xml, beginner)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'left',
        rule: 'completeness',
        expected: 'E',
        found: '(missing)',
      },
    ]);
  });

  it('a chord with no printed name: one label difference', () => {
    const xml = file(0, 'major', [[{ beat: 1, quarters: 4, tones: C }]]);
    expect(checkSongChords(xml, beginner)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 0,
        bar: '1',
        hand: 'left',
        rule: 'label',
        expected: 'a chord name above the chord',
        found: '(none)',
      },
    ]);
  });

  it('a name with a flat or sharp is read: Bb in F major', () => {
    const f = { level: 'beginner' as const, key: { tonicLetter: 'F', tonicAlter: 0, mode: 'major' } as KeyClaim };
    const xml = file(-1, 'major', [
      [
        chord(1, 4, 'Bb', [
          ['B', 2, -1],
          ['D', 3],
          ['F', 3],
        ]),
      ],
    ]);
    expect(checkSongChords(xml, f)).toEqual([]);
  });

  it('a chord tied over the barline is one attack, not a second chord', () => {
    const xml = file(0, 'major', [
      [chord(1, 4, 'C', C)],
      [{ beat: 1, quarters: 4, tones: C, tieStop: true }],
      [chord(1, 4, 'G', G)],
    ]);
    expect(checkSongChords(xml, beginner)).toEqual([]);
  });
});

describe('checkSongChords: the chords a level promises (research R9)', () => {
  it('a beginner song with a vi chord (Am in C major): one chordSet difference, the triad itself being right', () => {
    const xml = file(0, 'major', [[chord(1, 4, 'C', C)], [chord(1, 4, 'Am', AM)]]);
    expect(checkSongChords(xml, beginner)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 1,
        bar: '2',
        hand: 'left',
        rule: 'chordSet',
        expected: 'I, IV or V at beginner',
        found: 'Am (vi)',
      },
    ]);
  });

  it('the same vi chord passes at intermediate', () => {
    const xml = file(0, 'major', [[chord(1, 4, 'C', C)], [chord(1, 4, 'Am', AM)]]);
    expect(checkSongChords(xml, intermediate)).toEqual([]);
  });

  it('two chord changes in one bar fail at beginner and pass at intermediate', () => {
    const xml = file(0, 'major', [[chord(1, 2, 'C', C), chord(3, 2, 'G', G)], [chord(1, 4, 'C', C)]]);
    expect(checkSongChords(xml, beginner)).toEqual<TheoryDifference[]>([
      {
        kind: 'theory',
        chordIndex: 1,
        bar: '1',
        hand: 'left',
        rule: 'changeRate',
        expected: 'at most 1 chord change per bar at beginner',
        found: '2 chords in bar 1',
      },
    ]);
    expect(checkSongChords(xml, intermediate)).toEqual([]);
  });

  it('three chord changes in one bar fail at intermediate too', () => {
    const xml = file(0, 'major', [
      [chord(1, 1, 'C', C), chord(2, 1, 'F', F), chord(3, 1, 'G', G), chord(4, 1, 'C', C)],
    ]);
    expect(checkSongChords(xml, intermediate).map((d) => d.rule)).toEqual(['changeRate']);
  });

  it('a minor key: i, iv and V pass at beginner (A minor: Am, Dm, E)', () => {
    const xml = file(0, 'minor', [
      [chord(1, 4, 'Am', AM)],
      [
        chord(1, 4, 'Dm', [
          ['D', 3],
          ['F', 3],
          ['A', 3],
        ]),
      ],
      [
        chord(1, 4, 'E', [
          ['E', 3],
          ['G', 3, 1],
          ['B', 3],
        ]),
      ],
    ]);
    expect(checkSongChords(xml, { level: 'beginner', key: A_MINOR })).toEqual([]);
  });

  it('a minor key: VII (G in A minor) fails at beginner and passes at intermediate', () => {
    const xml = file(0, 'minor', [[chord(1, 4, 'Am', AM)], [chord(1, 4, 'G', G)]]);
    expect(checkSongChords(xml, { level: 'beginner', key: A_MINOR }).map((d) => [d.rule, d.found])).toEqual([
      ['chordSet', 'G (VII)'],
    ]);
    expect(checkSongChords(xml, { level: 'intermediate', key: A_MINOR })).toEqual([]);
  });

  it('a chord whose root is not a degree of the key (F-sharp major in C major): one chordSet difference', () => {
    const xml = file(0, 'major', [
      [
        chord(1, 4, 'F#', [
          ['F', 3, 1],
          ['A', 3, 1],
          ['C', 4, 1],
        ]),
      ],
    ]);
    expect(checkSongChords(xml, intermediate).map((d) => d.rule)).toEqual(['chordSet']);
  });
});

describe('checkSong: the key comes from the shelf folder', () => {
  it('reads the key of the folder in the id', () => {
    expect(songKeyOfItemId('learning/keys/c-major/song-au-clair')).toEqual(C_MAJOR);
    expect(songKeyOfItemId('learning/keys/f-sharp-minor/song-x')).toEqual({
      tonicLetter: 'F',
      tonicAlter: 1,
      mode: 'minor',
    });
    expect(songKeyOfItemId('learning/keys/b-flat-major/song-silent-night')).toEqual({
      tonicLetter: 'B',
      tonicAlter: -1,
      mode: 'major',
    });
    expect(() => songKeyOfItemId('repertoire/beginner/amazing-grace')).toThrow(/song id/);
  });

  it('a correct song in the folder key has no difference', () => {
    expect(checkSong(CORRECT, 'learning/keys/c-major/song-x', 'beginner')).toEqual([]);
  });

  it('a file whose signature is not the folder key: one key difference', () => {
    expect(
      checkSong(CORRECT, 'learning/keys/g-major/song-x', 'beginner').map((d) => [d.rule, d.expected, d.found])[0],
    ).toEqual(['key', '1', '0']);
  });
});

// Feature 022 T053 (contract audit-record 1.5.0, song-chords-v2): a moving left hand (waltz, repeated, broken) is read by
// the chord name above it, not attack by attack; the limit counts chord changes; Beginner minor allows v and VII.
describe('song-chords-v2: left-hand patterns grouped by their chord name', () => {
  const v2 = (level: 'beginner' | 'intermediate', key: KeyClaim) => ({
    level,
    key,
    ruleSet: 'song-chords-v2' as const,
  });
  const unnamed = (beat: number, quarters: number, tones: Tone[]): Entry => ({ beat, quarters, tones });

  it('a waltz-like pattern (bass, then the other two notes) under one name has no difference', () => {
    const xml = file(0, 'major', [
      [
        chord(1, 1, 'C', [['C', 3]]),
        unnamed(2, 1, [
          ['E', 3],
          ['G', 3],
        ]),
        unnamed(3, 2, [
          ['E', 3],
          ['G', 3],
        ]),
      ],
      [
        chord(1, 1, 'G', [['G', 2]]),
        unnamed(2, 1, [
          ['B', 2],
          ['D', 3],
        ]),
        unnamed(3, 2, [
          ['B', 2],
          ['D', 3],
        ]),
      ],
    ]);
    expect(checkSongChords(xml, v2('beginner', C_MAJOR))).toEqual([]);
    // v1 reads attack by attack: the unnamed strikes have no name, and the bass alone is no triad
    expect(checkSongChords(xml, beginner).length).toBeGreaterThan(0);
  });

  it('a stray note in the pattern is reported, naming it', () => {
    const xml = file(0, 'major', [
      [
        chord(1, 1, 'C', [['C', 3]]),
        unnamed(2, 1, [
          ['E', 3],
          ['A', 3],
        ]),
        unnamed(3, 2, [
          ['E', 3],
          ['G', 3],
        ]),
      ],
    ]);
    const differences = checkSongChords(xml, v2('beginner', C_MAJOR));
    expect(differences.map((d) => [d.rule, d.found])).toContainEqual(['completeness', 'A3']);
  });

  it('a broken chord (root, fifth, third, fifth) under one name has no difference', () => {
    const xml = file(0, 'major', [
      [chord(1, 1, 'C', [['C', 3]]), unnamed(2, 1, [['G', 3]]), unnamed(3, 1, [['E', 3]]), unnamed(4, 1, [['G', 3]])],
    ]);
    expect(checkSongChords(xml, v2('beginner', C_MAJOR))).toEqual([]);
  });

  it('a chord struck on every beat is one change, not four', () => {
    const xml = file(0, 'major', [
      [chord(1, 1, 'C', C), unnamed(2, 1, C), unnamed(3, 1, C), unnamed(4, 1, C)],
      [chord(1, 2, 'F', F), chord(3, 2, 'G', G)],
    ]);
    expect(checkSongChords(xml, v2('intermediate', C_MAJOR))).toEqual([]);
    // two changes in bar 2 are still too many at beginner
    expect(checkSongChords(xml, v2('beginner', C_MAJOR)).map((d) => d.rule)).toEqual(['changeRate']);
  });

  it('Beginner minor allows v and VII (A minor: Em and G); v1 still refuses them', () => {
    const EM: Tone[] = [
      ['E', 3],
      ['G', 3],
      ['B', 3],
    ];
    const xml = file(0, 'minor', [[chord(1, 4, 'Am', AM)], [chord(1, 4, 'Em', EM)], [chord(1, 4, 'G', G)]]);
    expect(checkSongChords(xml, v2('beginner', A_MINOR))).toEqual([]);
    expect(checkSongChords(xml, { level: 'beginner', key: A_MINOR }).map((d) => d.found)).toEqual([
      'Em (v)',
      'G (VII)',
    ]);
  });

  it('a left-hand note before the first chord name is reported', () => {
    const xml = file(0, 'major', [[unnamed(1, 2, C), chord(3, 2, 'C', C)]]);
    expect(checkSongChords(xml, v2('beginner', C_MAJOR)).map((d) => d.rule)).toEqual(['label']);
  });
});
