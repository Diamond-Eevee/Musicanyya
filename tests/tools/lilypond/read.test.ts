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

  it('\\partcombine: two parts on one staff are two voices, read like << \\\\ >> (T098)', () => {
    const combined = fromLilyPond(
      readLilyPond(
        "\\new Staff { \\partcombine { #(set-accidental-style 'modern-cautionary) e''4 d''4 } { c''4 b'4 } }",
      ),
    );
    const split = fromLilyPond(readLilyPond("\\new Staff << { e''4 d''4 } \\\\ { c''4 b'4 } >>"));
    expect(noVoice(combined.notes)).toEqual([
      n(0, [0], [1], 'C5'),
      n(0, [0], [1], 'E5'),
      n(0, [1], [1], 'B4'),
      n(0, [1], [1], 'D5'),
    ]);
    expect(combined.notes).toEqual(split.notes);
    const voice = (midi: number) => combined.notes.find((x) => x.midi === midi)?.voice;
    expect(voice(76)).not.toBe(voice(72));
    expect(voice(76)).toBe(voice(74));
  });

  it('reads Mutopia 1283 (New Britain, \\partcombine on both staves): the Soprano is a voice of its own', () => {
    const r = fromLilyPond(
      readLilyPond(readFileSync('content/library/sources/mutopia-1283-new-britain/new_britain.ly', 'utf8')),
    );
    const upper = r.notes.filter((x) => x.staff === 1);
    const soprano = upper.filter((x) => x.voice === upper.find((y) => y.midi === 62)?.voice);
    // "Amazing grace, how sweet the sound": D4 | G4 B4 G4 | B4 A4 | G4 E4 | D4
    expect(soprano.slice(0, 9).map((x) => x.spelling && `${x.spelling.step}${x.spelling.octave}`)).toEqual([
      'D4',
      'G4',
      'B4',
      'G4',
      'B4',
      'A4',
      'G4',
      'E4',
      'D4',
    ]);
    expect(new Set(r.notes.map((x) => `${x.staff}/${x.voice}`)).size).toBe(4);
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
    it('a Scheme expression in music other than set-accidental-style', () =>
      fails('{ #(ly:message "hi") c\'1 }', 1, 3, /Scheme expression in music/));
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
    it('non-ASCII letters in the music (they are never note names)', () => fails("{ c'4 dé }", 1, 7, /dé/));
  });

  // T095: constructs the audited Mutopia sources use (found by reading them), each on own-work input.
  describe('constructs of the audited sources (T095)', () => {
    const notes = (text: string) => fromLilyPond(readLilyPond(text)).notes.map((x) => [x.midi, x.onset, x.duration]);

    it('non-ASCII text in \\header markup and tagline (Satie 37: "Gymnopédie"; Mutopia taglines: "•")', () => {
      const r = readLilyPond(
        "\\header { title = \\markup { {\\small 1.} Gymnopédie } tagline = \\markup { Sheet music • free } }\n{ c'4 d' e' f' | }",
      );
      expect(fromLilyPond(r).notes.map((x) => x.midi)).toEqual([60, 62, 64, 65]);
    });

    it('a markup variable after a direction mark (Burgmüller 203: crescendo = \\markup {...}, then ^\\crescendo)', () => {
      const r = readLilyPond("crescendo = \\markup { \\italic \"cresc.\" }\n{ <c' e'>4^\\crescendo d'2. | }");
      const reading = fromLilyPond(r);
      expect(reading.notes.map((x) => [x.midi, x.onset])).toEqual([
        [60, q(0)],
        [64, q(0)],
        [62, q(1)],
      ]);
    });

    it('\\tweak on a post-event, stored in a variable and used after a direction mark (Chopin 468: hidePP)', () => {
      const text = "hidePP = \\tweak #'stencil ##f \\pp\n{ e'2^\\(-\\hidePP d'2\\) | }";
      const r = readLilyPond(text);
      expect(fromLilyPond(r).notes.map((x) => [x.midi, x.duration])).toEqual([
        [64, q(2)],
        [62, q(2)],
      ]);
      const first = (r.music as { items: { marks: unknown[] }[] }).items[0];
      expect(first?.marks).toEqual([
        { type: 'slur', start: true, phrasing: true, placement: 'above' },
        { type: 'dynamic', name: 'pp' },
      ]);
    });

    it('hairpin style commands take no argument and change no notes (Chopin 472: \\crescTextCresc)', () => {
      expect(notes("{ \\crescTextCresc c'2\\< d'\\! \\crescHairpin \\dimTextDim e'1 | }")).toEqual([
        [60, q(0), q(2)],
        [62, q(2), q(2)],
        [64, q(4), q(4)],
      ]);
    });

    it("\\transpose outside \\relative moves every pitch by the interval, keeping the spelling (Bach 5: c to c')", () => {
      expect(notes("{ \\transpose c c' { g16 c' e' g c' e' r8 | } }").map(([m]) => m)).toEqual([
        67, 72, 76, 67, 72, 76,
      ]);
      const r = fromLilyPond(readLilyPond("{ \\transpose c d { fis'4 bes' c'' e''8 e'' | } }"));
      expect(r.notes.map((x) => x.spelling)).toEqual([sp('G#4'), sp('C5'), sp('D5'), sp('F#5'), sp('F#5')]);
    });

    it('a printed start-repeat bar where a \\repeat volta starts, even at the beginning (Satie 37: \\bar ".|:")', () => {
      const r = fromLilyPond(readLilyPond("{ \\time 2/4 \\bar \".|:\" \\repeat volta 2 { c'2 | d'2 | } e'2 | }"));
      expect(r.bars).toEqual([
        bar(0, '1', 0, 2, { repeatStart: true }),
        bar(1, '2', 2, 2, { repeatEnd: true }),
        bar(2, '3', 4, 2),
      ]);
      expect(r.playedOrder).toEqual([0, 1, 0, 1, 2]);
    });

    it('\\book with one \\score per movement: the manifest chooses which one (Clementi 804)', () => {
      const text =
        "\\book {\n  \\score { { c'1 | } \\midi { } \\layout { } }\n  \\score { { \\time 3/4 d'2. | e'2. | } \\midi { } \\layout { } }\n}";
      expect(fromLilyPond(readLilyPond(text, { score: 2 })).notes.map((x) => x.midi)).toEqual([62, 64]);
      expect(fromLilyPond(readLilyPond(text, { score: 1 })).notes.map((x) => x.midi)).toEqual([60]);
      expect(() => readLilyPond(text)).toThrow(/2 notation scores.*score/);
    });
  });

  describe('checks and layout-only music functions (T095)', () => {
    it("\\barNumberCheck is checked against LilyPond's own measure number (Satie 37)", () => {
      const text = (n: number) => `{ \\time 2/4 c'2 | d'2 | \\barNumberCheck #${n} e'2 | }`;
      expect(fromLilyPond(readLilyPond(text(3))).notes.map((x) => x.midi)).toEqual([60, 62, 64]);
      expect(() => fromLilyPond(readLilyPond(text(2)))).toThrow(/bar number check #2.*measure 3/);
      // after a pickup the first full measure is 1
      expect(() => fromLilyPond(readLilyPond("{ \\partial 4 c'4 | \\barNumberCheck #1 d'1 | }"))).not.toThrow();
    });

    it('\\shape in a variable, used before a note, changes nothing (Chopin 468: shpSlurA)', () => {
      const text =
        "shp = \\shape #'( ((0 . -0.3) (8 . 0.5)) ((0 . 0) (0 . 0)) ) PhrasingSlur\n{ \\shp c'4\\( d'2.\\) | }";
      expect(fromLilyPond(readLilyPond(text)).notes.map((x) => [x.midi, x.duration])).toEqual([
        [60, q(1)],
        [62, q(3)],
      ]);
    });

    it('a rest placed at a pitch (e4\\rest) is a rest, and its pitch still counts for \\relative (Satie 37)', () => {
      const r = fromLilyPond(readLilyPond("\\relative c'' { \\time 3/4 e4\\rest d2 | c,4\\rest e2 | }"));
      expect(noVoice(r.notes)).toEqual([n(0, [1], [2], 'D5'), n(1, [4], [2], 'E4')]);
    });

    it('\\crossStaff only joins stems across the staves (Chopin 468)', () => {
      const r = fromLilyPond(readLilyPond("{ \\crossStaff { <c' e'>2 d'2 } | }"));
      expect(r.notes.map((x) => [x.midi, x.onset, x.duration])).toEqual([
        [60, q(0), q(2)],
        [64, q(0), q(2)],
        [62, q(2), q(2)],
      ]);
    });

    it('Score.skipTypesetting hides printed music: it fails where used, not where only defined (Chopin 468)', () => {
      const defined = "paperOFF = { \\set Score.skipTypesetting = ##t }\n{ c'1 | }";
      expect(fromLilyPond(readLilyPond(defined)).notes).toHaveLength(1);
      expect(() => fromLilyPond(readLilyPond("{ \\set Score.skipTypesetting = ##t c'1 | }"))).toThrow(
        /skipTypesetting/,
      );
    });
  });

  describe('found by converting the sources (T096)', () => {
    it('a named Voice belongs to the staff it is created in (Burgmüller 203: VoiceI in both staves)', () => {
      const r = fromLilyPond(
        readLilyPond(
          '\\new PianoStaff <<\n  \\new Staff = "up" \\context Voice = "V" { c\'\'2 d\'\' | }\n  \\new Staff = "down" \\context Voice = "V" { \\clef bass c2 d | }\n>>',
        ),
      );
      const voiceOf = (midi: number) => r.notes.find((x) => x.midi === midi)?.voice;
      expect(voiceOf(72)).toBe(voiceOf(74));
      expect(voiceOf(48)).toBe(voiceOf(50));
      expect(voiceOf(72)).not.toBe(voiceOf(48));
    });

    it('reads markup text: strings and words, the \\italic or \\bold style, and a \\dynamic inside', () => {
      const r = readLilyPond(
        'cr = \\markup { \\italic "cresc." }\n{ R1^\\markup { \\hspace #10 "Lent et douloureux" } | c\'4^\\markup { Spiritoso } d\'_\\markup { \\dynamic p \\italic "leggieremente" } e\'^\\cr f\'^\\markup { \\bold \\large Largo } | }',
      );
      // `cr` is also LilyPond's own \cr (a hairpin); the file's variable shadows it.
      const items = (r.music as { items: { marks?: unknown[] }[] }).items.filter((m) => m.marks !== undefined);
      // Five events (R1, c', d', e', f'): the markups consume no music tokens.
      expect(items.map((m) => m.marks)).toEqual([
        [{ type: 'text', text: 'Lent et douloureux', placement: 'above' }],
        [{ type: 'text', text: 'Spiritoso', placement: 'above' }],
        [
          { type: 'dynamic', name: 'p', placement: 'below' },
          { type: 'text', text: 'leggieremente', style: 'italic', placement: 'below' },
        ],
        [{ type: 'text', text: 'cresc.', style: 'italic', placement: 'above' }],
        [{ type: 'text', text: 'Largo', style: 'bold', placement: 'above' }],
      ]);
    });

    it('a markup that prints nothing gives no mark (Bach 5: \\markup { \\teeny " " })', () => {
      const r = readLilyPond('{ c\'1_\\markup { \\teeny " " } | }');
      expect((r.music as { items: { marks: unknown[] }[] }).items[0]?.marks).toEqual([]);
    });
  });

  describe('still fails loudly (T095)', () => {
    const fails = (text: string, construct: RegExp) => {
      expect(() => fromLilyPond(readLilyPond(text))).toThrow(LyUnsupportedError);
      expect(() => fromLilyPond(readLilyPond(text))).toThrow(construct);
    };
    it('\\transpose inside \\relative', () => fails("\\relative c' { \\transpose c d { c4 d } }", /\\transpose/));
    it('a transposition that needs a triple accidental', () =>
      fails("{ \\transpose c cis { bisis'4 } }", /accidental/));
    it('a start-repeat bar line where no \\repeat volta starts', () =>
      fails('{ c\'2 \\bar ".|:" d\'2 | }', /repeat bar line/));
    it('an end-repeat bar line written by hand', () => fails('{ c\'2 \\bar ":|." d\'2 | }', /:\|\./));
    it('a \\score number the file does not have', () =>
      expect(() => readLilyPond("\\score { { c'1 } \\layout { } }", { score: 2 })).toThrow(/score 2/));
  });
});
