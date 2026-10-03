// Feature 022 T040 (contract audit-record 1.5.0, chord-lessons-v1): the independent check of a chord lesson reads only the
// finished MusicXML and the claims in its audit record. Fixtures: the small scores below are authored for this test (CC0,
// claude-opus-5.5, 2026-10-03) and written with the app's MusicXML writer; each plants one difference.
import { describe, expect, it } from 'vitest';
import { type WriteEvent, type WriteMeasure, writeScoreXml } from '../../../src/core/musicxml/write.js';
import { type ChordLessonClaims, checkChordLesson } from '../../../tools/library/fidelity/chord-lessons';

/** A pitch like "E4", "F#3", "Bb2". */
function pitch(name: string) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(name);
  return { step: m[1] as string, ...(m[2] ? { alter: m[2] === '#' ? 1 : -1 } : {}), octave: Number(m[3]) };
}

/** One staff's whole-bar chord (or single note): notes with a 4-quarter duration. */
function chord(staff: number, names: string[], duration = 16): WriteEvent[] {
  return names.map((name, i) => ({
    kind: 'note' as const,
    note: {
      pitch: pitch(name),
      duration,
      voice: staff === 1 ? '1' : '5',
      type: duration === 16 ? ('whole' as const) : duration === 8 ? ('half' as const) : ('quarter' as const),
      staff,
      ...(i > 0 ? { chord: true } : {}),
      fingering: 1,
    },
  }));
}
const symbol = (words: string): WriteEvent => ({ kind: 'direction', words, staff: 1, placement: 'above' });

interface Bar {
  name: string;
  rh: string[];
  lh: string[];
  /** Right-hand events after the chord (passing notes), replacing a whole-bar chord with half + these. */
  extra?: WriteEvent[];
}

function lessonXml(bars: Bar[]): string {
  const measures: WriteMeasure[] = bars.map((bar, i) => ({
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
      symbol(bar.name),
      ...(bar.extra ? [...chord(1, bar.rh, 8), ...bar.extra] : chord(1, bar.rh)),
      { kind: 'backup', duration: 16 },
      ...(bar.lh.length > 0
        ? chord(2, bar.lh)
        : [
            {
              kind: 'note',
              note: { rest: true, measureRest: true, duration: 16, voice: '5', type: 'whole', staff: 2 },
            } as WriteEvent,
          ]),
    ],
  }));
  return writeScoreXml({ parts: [{ id: 'P1', name: 'Piano', measures }] });
}

const NONE: ChordLessonClaims = {};

describe('chord-lessons-v1: every name form of research R4, spelled right, gives 0 differences', () => {
  it.each<[string, string[], string[]]>([
    ['C', ['E4', 'G4', 'C5'], ['C3']],
    ['Cm', ['Eb4', 'G4', 'C5'], ['C3']],
    ['B°', ['D4', 'F4', 'B4'], ['B2']],
    ['C+', ['E4', 'G#4', 'C5'], ['C3']],
    ['Csus2', ['D4', 'G4', 'C5'], ['C3']],
    ['Csus4', ['F4', 'G4', 'C5'], ['C3']],
    ['Cmaj7', ['E4', 'G4', 'B4'], ['C3']],
    ['C7', ['E4', 'G4', 'Bb4'], ['C3']],
    ['Cm7', ['Eb4', 'G4', 'Bb4'], ['C3']],
    ['Bø7', ['D4', 'F4', 'A4'], ['B2']],
    ['G/B', ['D4', 'G4'], ['B2']],
    ['C/E', ['G4', 'C5'], ['E3']],
    ['F♯m', ['A4', 'C#5', 'F#5'], ['F#3']],
    ['F#m', ['A4', 'C#5', 'F#5'], ['F#3']],
    ['B♭', ['D4', 'F4', 'Bb4'], ['Bb2']],
    ['Bb', ['D4', 'F4', 'Bb4'], ['Bb2']],
    ['E/G♯', ['B3', 'E4'], ['G#2']],
  ])('%s', (name, rh, lh) => {
    expect(checkChordLesson(lessonXml([{ name, rh, lh }]), NONE)).toEqual([]);
  });

  it('a lesson of several chords, a seventh split between the hands among them', () => {
    const xml = lessonXml([
      { name: 'C', rh: ['E4', 'G4', 'C5'], lh: ['C3'] },
      { name: 'Cmaj7', rh: ['E4', 'G4', 'B4'], lh: ['C3'] },
      { name: 'F/C', rh: ['F4', 'A4', 'C5'], lh: ['C3'] },
    ]);
    expect(checkChordLesson(xml, NONE)).toEqual([]);
  });
});

describe('chord-lessons-v1: one planted difference each', () => {
  it('chord-tones: a minor name over a major chord', () => {
    expect(checkChordLesson(lessonXml([{ name: 'Cm', rh: ['E4', 'G4', 'C5'], lh: ['C3'] }]), NONE)).toEqual([
      { kind: 'chordLesson', code: 'chord-tones', bar: '1', detail: 'Cm needs C Eb G, sounds C E G' },
    ]);
  });

  it('chord-tones: a split seventh read across both staves - the left hand missing its root (so the bass is wrong too)', () => {
    expect(checkChordLesson(lessonXml([{ name: 'Cmaj7', rh: ['E4', 'G4', 'B4'], lh: [] }]), NONE)).toEqual([
      { kind: 'chordLesson', code: 'chord-tones', bar: '1', detail: 'Cmaj7 needs C E G B, sounds E G B' },
      { kind: 'chordLesson', code: 'bass', bar: '1', detail: 'Cmaj7 needs C in the bass, the lowest note is E4' },
    ]);
  });

  it('chord-tones: a fifth left out is fine only when the claim declares it', () => {
    const xml = lessonXml([{ name: 'Cmaj7', rh: ['E4', 'B4'], lh: ['C3'] }]);
    expect(checkChordLesson(xml, { omit: [{ bar: 1, beat: 1, tones: ['5'] }] })).toEqual([]);
    expect(checkChordLesson(xml, NONE)).toEqual([
      { kind: 'chordLesson', code: 'chord-tones', bar: '1', detail: 'Cmaj7 needs C E G B, sounds C E B' },
    ]);
  });

  it('bass: a slash chord whose lowest note is not the named bass', () => {
    expect(checkChordLesson(lessonXml([{ name: 'C/E', rh: ['E4', 'G4'], lh: ['C3'] }]), NONE)).toEqual([
      { kind: 'chordLesson', code: 'bass', bar: '1', detail: 'C/E needs E in the bass, the lowest note is C3' },
    ]);
  });

  it('bass: a chord without a slash stands on its root', () => {
    expect(checkChordLesson(lessonXml([{ name: 'C', rh: ['C4', 'G4'], lh: ['E3'] }]), NONE)).toEqual([
      { kind: 'chordLesson', code: 'bass', bar: '1', detail: 'C needs C in the bass, the lowest note is E3' },
    ]);
  });

  it('common-tone: a claimed common tone must stay on the same key', () => {
    const kept = lessonXml([
      { name: 'C', rh: ['E4', 'G4', 'C5'], lh: ['C3'] },
      { name: 'F/C', rh: ['F4', 'A4', 'C5'], lh: ['C3'] },
    ]);
    const claim: ChordLessonClaims = { commonTones: [{ bar: 2, beat: 1, pitch: 'C5' }] };
    expect(checkChordLesson(kept, claim)).toEqual([]);
    const moved = lessonXml([
      { name: 'C', rh: ['E4', 'G4', 'C5'], lh: ['C3'] },
      { name: 'F/C', rh: ['C4', 'F4', 'A4'], lh: ['C3'] },
    ]);
    expect(checkChordLesson(moved, claim)).toEqual([
      {
        kind: 'chordLesson',
        code: 'common-tone',
        bar: '2',
        detail: 'C5 is claimed to stay from the chord before, but is not held or struck again',
      },
    ]);
  });

  it('stray-note: a note under the symbol that is not a chord tone', () => {
    const passing: WriteEvent = {
      kind: 'note',
      note: { pitch: pitch('D5'), duration: 8, voice: '1', type: 'half', staff: 1, fingering: 2 },
    };
    expect(
      checkChordLesson(lessonXml([{ name: 'C', rh: ['E4', 'G4', 'C5'], lh: ['C3'], extra: [passing] }]), NONE),
    ).toEqual([{ kind: 'chordLesson', code: 'stray-note', bar: '1', detail: 'D5 is not a tone of C' }]);
  });
});
