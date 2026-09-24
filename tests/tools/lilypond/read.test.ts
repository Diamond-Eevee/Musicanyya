import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ReferenceBar, ReferenceNote, Spelling, Step } from '../../../tools/library/fidelity/reference';
import { q } from '../../../tools/library/fidelity/time';
import { LyUnsupportedError } from '../../../tools/library/lilypond/errors';
import { fromLilyPond, readLilyPond } from '../../../tools/library/lilypond/read';

const source = (name: string) => readFileSync(resolve('tests/fixtures/lilypond', name), 'utf8');
const reading = (name: string) => fromLilyPond(readLilyPond(source(name)));

/** "F#4" -> spelling; the tests name every pitch as a musician would. */
function sp(name: string): Spelling {
  const m = /^([A-G])(##|#|bb|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(name);
  const alter = { '##': 2, '#': 1, bb: -2, b: -1 }[m[2] ?? ''] ?? 0;
  return { step: m[1] as Step, alter: alter as Spelling['alter'], octave: Number(m[3]) };
}
const MIDI: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (s: Spelling) => (s.octave + 1) * 12 + MIDI[s.step] + s.alter;

/** A note without its voice (voices are asserted separately where they matter). */
function n(
  bar: number,
  onset: [number, number?],
  dur: [number, number?],
  name: string,
  staff = 1,
): Omit<ReferenceNote, 'voice'> {
  const spelling = sp(name);
  return { bar, onset: q(...onset), duration: q(...dur), midi: midiOf(spelling), spelling, staff };
}
const noVoice = (notes: ReferenceNote[]) => notes.map(({ voice: _voice, ...rest }) => rest);
function bar(
  index: number,
  number: string,
  start: number,
  length: number,
  extra: Partial<ReferenceBar> = {},
): ReferenceBar {
  return {
    index,
    number,
    start: q(start),
    length: q(length),
    repeatStart: false,
    repeatEnd: false,
    endings: [],
    ...extra,
  };
}

describe('readLilyPond / fromLilyPond (contract fidelity-tools.md §3.1)', () => {
  it('relative octave entry: each note within a fourth of the previous one', () => {
    const r = reading('relative.ly');
    expect(r.origin).toBe('lilypond');
    expect(noVoice(r.notes)).toEqual(
      ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((p, i) => n(i < 4 ? 0 : 1, [i], [1], p)),
    );
    expect(r.bars).toEqual([bar(0, '1', 0, 4), bar(1, '2', 4, 4)]);
    expect(r.graceNotes).toEqual([]);
  });

  it("absolute octave entry: c is C3, c' is C4", () => {
    expect(noVoice(reading('absolute.ly').notes)).toEqual(
      ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'].map((p, i) => n(i < 4 ? 0 : 1, [i], [1], p)),
    );
  });

  it("chords: every chord note sounds; the next chord is relative to the chord's first note", () => {
    expect(noVoice(reading('chords.ly').notes)).toEqual([
      n(0, [0], [1], 'C4'),
      n(0, [0], [1], 'E4'),
      n(0, [0], [1], 'G4'),
      n(0, [1], [3], 'D4'),
      n(0, [1], [3], 'F4'),
      n(0, [1], [3], 'A4'),
    ]);
  });

  it('ties: tied notes are one sounding note with the summed duration', () => {
    expect(noVoice(reading('ties.ly').notes)).toEqual([
      n(0, [0], [3, 2], 'C4'),
      n(0, [3, 2], [1, 2], 'D4'),
      n(0, [2], [2], 'E4'),
    ]);
  });

  it('\\tuplet 3/2 and \\times 2/3 give exact thirds of a quarter', () => {
    const r = reading('tuplets.ly');
    expect(noVoice(r.notes)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4'].map((p, i) => n(0, [i, 3], [1, 3], p)));
    expect(r.bars).toEqual([bar(0, '1', 0, 2)]);
  });

  it('the four grace commands give grace notes that take no written time', () => {
    const r = reading('grace.ly');
    expect(noVoice(r.notes)).toEqual([0, 1, 2, 3].map((i) => n(0, [i], [1], 'D5')));
    expect(r.graceNotes).toEqual([0, 1, 2, 3].map((i) => ({ bar: 0, before: q(i), midi: 72, spelling: sp('C5') })));
  });

  it('\\repeat volta + \\alternative: repeat barlines, ending numbers and the played order', () => {
    const r = reading('volta.ly');
    expect(noVoice(r.notes)).toEqual([
      n(0, [0], [1], 'C4'),
      n(0, [1], [1], 'D4'),
      n(0, [2], [1], 'E4'),
      n(0, [3], [1], 'F4'),
      n(1, [4], [2], 'G4'),
      n(1, [6], [2], 'G4'),
      // c, after G4: the nearest C is C5, lowered an octave by the comma
      n(2, [8], [4], 'C4'),
    ]);
    expect(r.bars).toEqual([
      // LilyPond prints no start-repeat bar line at the beginning of a piece (Notation Reference, "Long
      // repeats"), so the written score has none.
      bar(0, '1', 0, 4),
      bar(1, '2', 4, 4, { repeatEnd: true, endings: [1] }),
      bar(2, '3', 8, 4, { endings: [2] }),
    ]);
    expect(r.playedOrder).toEqual([0, 1, 0, 2]);
  });

  it('\\repeat unfold is written out; the body keeps its octaves on every pass', () => {
    const r = reading('unfold.ly');
    expect(noVoice(r.notes)).toEqual(
      ['C4', 'D4', 'E4', 'F4', 'C4', 'D4', 'E4', 'F4'].map((p, i) => n(i < 4 ? 0 : 1, [i], [1], p)),
    );
    expect(r.bars).toEqual([bar(0, '1', 0, 4), bar(1, '2', 4, 4)]);
    expect(r.playedOrder).toEqual([0, 1]);
  });

  it('\\partial: a pickup bar numbered 0, then bar 1', () => {
    const r = reading('partial.ly');
    expect(r.bars).toEqual([bar(0, '0', 0, 1), bar(1, '1', 1, 4)]);
    expect(noVoice(r.notes)).toEqual([
      n(0, [0], [1], 'C4'),
      n(1, [1], [1], 'D4'),
      n(1, [2], [1], 'E4'),
      n(1, [3], [1], 'F4'),
      n(1, [4], [1], 'G4'),
    ]);
  });

  it('\\time changes bar lengths; \\key and \\clef do not change pitches', () => {
    const r = reading('time-key-clef.ly');
    expect(r.bars).toEqual([bar(0, '1', 0, 3), bar(1, '2', 3, 2)]);
    expect(noVoice(r.notes)).toEqual([
      n(0, [0], [1], 'D4'),
      n(0, [1], [1], 'E4'),
      n(0, [2], [1], 'F#4'),
      n(1, [3], [1], 'G4'),
      n(1, [4], [1], 'A4'),
    ]);
  });

  it('\\ottava changes the staff position only: the entered pitch is the sounding pitch', () => {
    expect(reading('ottava.ly').notes.map((x) => x.midi)).toEqual([72, 74, 76, 77, 60, 62, 64, 65]);
  });

  it('\\new PianoStaff numbers its staves in order', () => {
    expect(noVoice(reading('pianostaff.ly').notes)).toEqual([n(0, [0], [1], 'C3', 2), n(0, [0], [1], 'C4', 1)]);
  });

  it('voices and staves: << \\\\ >>, \\new Voice and \\change Staff', () => {
    const r = reading('voices.ly');
    expect(noVoice(r.notes)).toEqual([
      n(0, [0], [4], 'C3', 2),
      n(0, [0], [2], 'C5', 1),
      n(0, [0], [1], 'E5', 1),
      n(0, [1], [1], 'F5', 1),
      n(0, [2], [2], 'E5', 1),
      n(0, [2], [2], 'G5', 1),
      n(1, [4], [1], 'C5', 1),
      n(1, [5], [1], 'G3', 2),
      n(1, [6], [2], 'E5', 1),
    ]);
    const voice = (onset: number, midi: number) => r.notes.find((x) => x.onset.num === onset && x.midi === midi)?.voice;
    expect(voice(0, 72)).not.toBe(voice(0, 76)); // the two sides of \\ are different voices
    expect(voice(0, 72)).toBe(voice(2, 76)); // ... and each keeps its own voice
    expect(voice(4, 72)).toBe(voice(5, 55)); // \change Staff keeps the voice
    expect(voice(4, 72)).toBe(voice(6, 76));
  });

  it('variables are expanded where they are used', () => {
    expect(noVoice(reading('variables.ly').notes)).toEqual(
      ['C4', 'D4', 'E4', 'F4', 'C4', 'D4', 'E4', 'F4'].map((p, i) => n(i < 4 ? 0 : 1, [i], [1], p)),
    );
  });

  it('rests r, R and s take time; dots and carried-over durations', () => {
    const r = reading('rests.ly');
    expect(r.bars).toEqual([bar(0, '1', 0, 3), bar(1, '2', 3, 3), bar(2, '3', 6, 3)]);
    expect(noVoice(r.notes)).toEqual([n(0, [0], [3, 2], 'C4'), n(0, [3, 2], [1, 2], 'D4'), n(2, [8], [1], 'E4')]);
  });

  it('reads \\header fields, skips \\paper, and takes the layout \\score; the MIDI \\score unfolds repeats', () => {
    const score = readLilyPond(source('score-blocks.ly'));
    expect(score.header).toEqual({ title: 'Blocks', composer: 'Own work', mutopiacomposer: 'Anonymous' });
    expect(score.midi).toEqual({ unfoldRepeats: true, articulate: false });
    const r = fromLilyPond(score);
    expect(noVoice(r.notes)).toEqual(['C5', 'D5', 'E5', 'F5'].map((p, i) => n(0, [i], [1], p)));
    expect(r.bars).toEqual([bar(0, '1', 0, 4, { repeatEnd: true })]);
    expect(r.playedOrder).toEqual([0, 0]);
  });

  it('articulations, dynamics, slurs, beams, fingering, text, markup, tempo and pedal do not change the notes', () => {
    const r = reading('marks.ly');
    expect(noVoice(r.notes).map(({ articulated: _a, ...rest }) => rest)).toEqual([
      n(0, [0], [1], 'C5'),
      n(0, [1], [1], 'D5'),
      n(0, [2], [1, 2], 'E5'),
      n(0, [5, 2], [1, 2], 'F5'),
      n(0, [3], [1], 'A5'),
      n(1, [4], [3], 'B5'),
      n(1, [7], [1], 'C6'),
    ]);
    // Research R5 rule 5: an articulated note may sound shorter in LilyPond's MIDI, so the reading marks it.
    expect(r.notes.map((x) => x.articulated === true)).toEqual([true, true, true, false, false, false, false]);
  });

  it('reads Dutch note names, including es/as and double accidentals', () => {
    const r = fromLilyPond(readLilyPond("{ es'4 as' ceses' bis | }"));
    expect(r.notes.map((x) => [x.midi, x.spelling])).toEqual([
      [63, sp('Eb4')],
      [68, sp('Ab4')],
      [58, sp('Cbb4')],
      [60, sp('B#3')],
    ]);
  });

  it('endings that end or start inside a bar: written bars follow the printed page', () => {
    const r = reading('endings-mid-bar.ly');
    const b = (
      index: number,
      number: string,
      start: [number, number?],
      length: [number, number?],
      extra: Partial<ReferenceBar> = {},
    ) => ({
      index,
      number,
      start: q(...start),
      length: q(...length),
      repeatStart: false,
      repeatEnd: false,
      endings: [],
      ...extra,
    });
    expect(r.bars).toEqual([
      b(0, '0', [0], [1, 2]),
      b(1, '1', [1, 2], [3, 2]),
      b(2, '2', [2], [1], { repeatEnd: true, endings: [1] }), // first ending: completes the pickup bar
      b(3, '3', [3], [3, 2], { endings: [2] }), // second ending: \bar "" hides the timing bar line after a8
      b(4, '4', [9, 2], [3, 2]), // measurePosition -1/8 put this bar line after c16 d
      b(5, '5', [6], [1]),
    ]);
    expect(r.playedOrder).toEqual([0, 1, 2, 0, 1, 3, 4, 5]);
    expect(noVoice(r.notes)).toEqual([
      n(0, [0], [1, 4], 'E5'),
      n(0, [1, 4], [1, 4], 'D5'),
      n(1, [1, 2], [1, 2], 'E5'),
      n(1, [1], [1, 2], 'C5'),
      n(1, [3, 2], [1, 2], 'A4'),
      n(2, [2], [1], 'A4'),
      n(3, [3], [1, 2], 'A4'),
      n(3, [15, 4], [1, 4], 'B4'),
      n(3, [4], [1, 4], 'C5'),
      n(3, [17, 4], [1, 4], 'D5'),
      n(4, [9, 2], [1, 2], 'E5'),
      n(4, [5], [1, 2], 'C5'),
      n(4, [11, 2], [1, 2], 'B4'),
      n(5, [6], [1, 2], 'A4'),
    ]);
  });

  it("reads octave marks before a forced or cautionary accidental, and an octave check (c''! b,? c='')", () => {
    const r = fromLilyPond(readLilyPond("{ cis''!4 b,? \\tupletSpan 8 c=''2 | }"));
    expect(r.notes.map((x) => [x.midi, x.spelling])).toEqual([
      [73, sp('C#5')],
      [47, sp('B2')],
      [72, sp('C5')],
    ]);
  });

  it('reads English note names after \\language "english"', () => {
    const r = fromLilyPond(readLilyPond("\\language \"english\"\n{ cs'4 ef' fss' bff' | }"));
    expect(r.notes.map((x) => [x.midi, x.spelling])).toEqual([
      [61, sp('C#4')],
      [63, sp('Eb4')],
      [67, sp('F##4')],
      [69, sp('Bbb4')],
    ]);
  });

  describe('fails loudly, naming line, column and construct', () => {
    const fails = (text: string, line: number, column: number, construct: RegExp) => {
      let error: unknown;
      try {
        fromLilyPond(readLilyPond(text));
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(LyUnsupportedError);
      const e = error as LyUnsupportedError;
      expect([e.line, e.column]).toEqual([line, column]);
      expect(e.construct).toMatch(construct);
    };

    it('a bar check that is not on a bar line', () => fails(source('bar-check-wrong.ly'), 2, 10, /bar check/));
    it('\\transpose', () => fails(source('unsupported-transpose.ly'), 2, 3, /\\transpose/));
    it('an unknown command', () => fails('{ c4 \\foo d }', 1, 6, /\\foo/));
    it('a Scheme expression in the music', () => fails('{ c4 #(ly:make-moment 1 4) d }', 1, 6, /Scheme/));
    it('a word that is not a note, rest or variable', () => fails('{ c4 hello }', 1, 6, /hello/));
    it('a \\set that changes the timing', () =>
      fails('{ \\set Timing.measureLength = #(ly:make-moment 5/8) c4 }', 1, 3, /Timing\.measureLength/));
    it('a bar check on a repeat bar line inside a measure (not a measure boundary in LilyPond)', () =>
      fails(
        "\\relative c'' { \\time 3/8 \\repeat volta 2 { \\partial 8 e16 d | e8 c a | } \\alternative { { a4 | } { a4 } } }",
        1,
        95,
        /bar check/,
      ));
    it('a repeat type other than volta and unfold', () => fails('{ \\repeat tremolo 4 { c16 d } }', 1, 11, /tremolo/));
  });
});
