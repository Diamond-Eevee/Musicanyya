// Feature 022 T026 (contract audit-record 1.5.0, lesson-claims-v1): the independent check of a Basics lesson reads only the
// finished MusicXML and the claims in its audit record. Fixtures: the small scores below are authored for this test
// (CC0, claude-opus-5.5, 2026-10-03) and written with the app's MusicXML writer; each plants one difference.
import { describe, expect, it } from 'vitest';
import { type WriteEvent, type WriteMeasure, type WriteNote, writeScoreXml } from '../../../src/core/musicxml/write.js';
import {
  checkLessonClaims,
  detectNotationFeatures,
  type LessonClaimRecord,
} from '../../../tools/library/fidelity/lesson-claims';

type Value = 'whole' | 'half' | 'quarter' | 'eighth';
const LENGTH: Record<Value, number> = { whole: 16, half: 8, quarter: 4, eighth: 2 };

function n(step: string, value: Value, extra: Partial<WriteNote> = {}): WriteEvent {
  return {
    kind: 'note',
    note: {
      pitch: { step, octave: 4 },
      duration: LENGTH[value],
      voice: '1',
      type: value,
      staff: 1,
      fingering: 1,
      ...extra,
    },
  };
}
const barRest = (staff: number): WriteEvent => ({
  kind: 'note',
  note: { rest: true, measureRest: true, duration: 16, voice: staff === 1 ? '1' : '5', type: 'whole', staff },
});
const explanation: WriteEvent = {
  kind: 'direction',
  words: 'Count four in every bar.',
  italic: true,
  staff: 1,
  placement: 'above',
};

/** A 4/4 grand-staff lesson: `bars[i]` are the right-hand events of bar i+1; the left hand rests a whole bar unless
 *  `lh` gives its events. */
function lesson(bars: WriteEvent[][], options: { words?: boolean; lh?: WriteEvent[][] } = {}): string {
  const measures: WriteMeasure[] = bars.map((events, i) => ({
    number: String(i + 1),
    ...(i === 0
      ? {
          attributes: {
            divisions: 4,
            key: { fifths: 0, mode: 'major' },
            time: { beats: '4', beatType: 4 },
            staves: 2,
            clefs: [
              { number: 1, sign: 'G', line: 2 },
              { number: 2, sign: 'F', line: 4 },
            ],
          },
        }
      : {}),
    events: [
      ...(i === 0
        ? [
            {
              kind: 'direction',
              metronome: { beatUnit: 'quarter', perMinute: 60 },
              tempo: 60,
              staff: 1,
              placement: 'above',
            } as WriteEvent,
          ]
        : []),
      ...(i === 0 && options.words !== false ? [explanation] : []),
      ...events,
      { kind: 'backup', duration: 16 },
      ...(options.lh?.[i] ?? [barRest(2)]),
    ],
  }));
  return writeScoreXml({ parts: [{ id: 'P1', name: 'Piano', measures }] });
}

const quarters = (step = 'C') => [n(step, 'quarter'), n(step, 'quarter'), n(step, 'quarter'), n(step, 'quarter')];
const FIRST: LessonClaimRecord = {
  itemId: 'basics/one',
  teachingOrder: 10,
  claims: { introduces: ['staff', 'treble-clef', 'middle-c', 'quarter', 'metre-4-4'], singlePitch: true },
};

describe('lesson-claims-v1: a clean lesson', () => {
  it('a single-pitch lesson that uses only what it introduces has 0 differences', () => {
    expect(checkLessonClaims(lesson([quarters(), quarters()]), FIRST, [])).toEqual([]);
  });

  it('a staff of whole-bar rests under a bass clef is not counted before the bass clef is introduced', () => {
    const features = detectNotationFeatures(lesson([quarters()]));
    expect(features.has('bass-clef')).toBe(false);
    expect(features.has('whole-rest')).toBe(false);
    expect(checkLessonClaims(lesson([quarters()]), FIRST, [])).toEqual([]);
  });

  it('a practice lesson that introduces nothing new has 0 differences when earlier lessons introduced it all', () => {
    const halves = lesson([[n('C', 'half'), n('C', 'quarter'), n('C', 'quarter')]]);
    const second: LessonClaimRecord = { itemId: 'basics/two', teachingOrder: 20, claims: { introduces: ['half'] } };
    const practice: LessonClaimRecord = {
      itemId: 'basics/practice',
      teachingOrder: 30,
      claims: { introduces: [], practice: true, singlePitch: true },
    };
    expect(checkLessonClaims(halves, practice, [FIRST, second])).toEqual([]);
  });
});

describe('lesson-claims-v1: one planted difference each', () => {
  it('explanation-missing: no words above staff 1 in the first bar', () => {
    expect(checkLessonClaims(lesson([quarters()], { words: false }), FIRST, [])).toEqual([
      { kind: 'lessonClaim', code: 'explanation-missing', bar: '1', detail: 'no explanation printed above staff 1' },
    ]);
  });

  it('not-single-pitch: a second pitch in a lesson that claims one', () => {
    const differences = checkLessonClaims(
      lesson([[n('C', 'quarter'), n('C', 'quarter'), n('D', 'quarter'), n('C', 'quarter')]]),
      { ...FIRST, claims: { ...FIRST.claims, introduces: [...(FIRST.claims.introduces ?? []), 'steps'] } },
      [],
    );
    expect(differences).toEqual([
      { kind: 'lessonClaim', code: 'not-single-pitch', bar: '1', detail: 'claims one pitch, sounds C4, D4' },
    ]);
  });

  it('not-introduced: eighth notes that neither this lesson nor an earlier one introduces', () => {
    const second: LessonClaimRecord = { itemId: 'basics/two', teachingOrder: 20, claims: { introduces: ['half'] } };
    const xml = lesson([
      [n('C', 'half'), n('C', 'quarter'), n('C', 'quarter')],
      [n('C', 'eighth'), n('C', 'eighth'), n('C', 'quarter'), n('C', 'half')],
    ]);
    expect(checkLessonClaims(xml, second, [FIRST])).toEqual([
      {
        kind: 'lessonClaim',
        code: 'not-introduced',
        bar: '2',
        detail: 'eighth is not introduced by this or an earlier lesson',
      },
    ]);
  });

  it('not-introduced: a later lesson does not count as an earlier one', () => {
    const later: LessonClaimRecord = { itemId: 'basics/later', teachingOrder: 90, claims: { introduces: ['half'] } };
    const xml = lesson([[n('C', 'half'), n('C', 'half')]]);
    expect(checkLessonClaims(xml, FIRST, [later]).map((d) => d.detail)).toEqual([
      'half is not introduced by this or an earlier lesson',
    ]);
  });

  it('tie-pitch: a tie between two different pitches', () => {
    const xml = lesson([[n('C', 'half', { tie: { start: true } }), n('D', 'half', { tie: { stop: true } })]]);
    const own = { ...FIRST, claims: { introduces: [...(FIRST.claims.introduces ?? []), 'half', 'tie', 'steps'] } };
    expect(checkLessonClaims(xml, own, [])).toEqual([
      { kind: 'lessonClaim', code: 'tie-pitch', bar: '1', detail: 'a tie from C4 does not continue on C4' },
    ]);
  });

  it('slur-same-pitch: a slur over two equal notes only (a tie in disguise)', () => {
    const xml = lesson([
      [
        n('C', 'half', { slurs: [{ type: 'start', number: 1 }] }),
        n('C', 'half', { slurs: [{ type: 'stop', number: 1 }] }),
      ],
    ]);
    const own = { ...FIRST, claims: { introduces: [...(FIRST.claims.introduces ?? []), 'half', 'slur'] } };
    expect(checkLessonClaims(xml, own, [])).toEqual([
      {
        kind: 'lessonClaim',
        code: 'slur-same-pitch',
        bar: '1',
        detail: 'a slur joins two C4s only; a tie joins equal pitches',
      },
    ]);
  });
});

describe('lesson-claims-v1: notation features read from the file (contract lesson-definition §3)', () => {
  it('reads values, rests, articulations, ties across the bar line, the bass clef and hands together', () => {
    const xml = lesson(
      [
        [
          n('C', 'quarter', { articulations: ['staccato'] }),
          { kind: 'note', note: { rest: true, duration: 4, voice: '1', type: 'quarter', staff: 1 } },
          n('E', 'half', { tie: { start: true } }),
        ],
        [n('E', 'half', { tie: { stop: true } }), n('E', 'half')],
      ],
      {
        lh: [
          [
            {
              kind: 'note',
              note: {
                pitch: { step: 'C', octave: 3 },
                duration: 16,
                voice: '5',
                type: 'whole',
                staff: 2,
                fingering: 5,
              },
            },
          ],
          [barRest(2)],
        ],
      },
    );
    const features = detectNotationFeatures(xml);
    for (const f of [
      'quarter',
      'quarter-rest',
      'half',
      'staccato',
      'tie',
      'tie-across-barline',
      'bass-clef',
      'left-hand',
      'hands-together',
      'whole',
      'five-finger-position',
    ])
      expect(features.has(f), f).toBe(true);
  });
});
