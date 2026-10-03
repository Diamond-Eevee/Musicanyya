// The independent check of a chord lesson (rule set chord-lessons-v1, feature 022, contract audit-record 1.5.0).
//
// A chord lesson promises that every chord it names above the staff is the chord the hands play: the notes sounding at
// the name spell exactly that chord (a seventh may be split between the hands), the lowest of them is its bass, no
// other note sounds under the name, and a switch keeps the tones it says it keeps. Like theory.ts it reads only the
// finished MusicXML and the claims written in the item's audit record, and derives every chord tone by letter
// arithmetic; it never sees the lesson definition or the builder.
import type { XmlElement as XmlElementType } from '@rgrove/parse-xml';
import { XmlElement } from '@rgrove/parse-xml';
import { readXml } from '../../../src/core/musicxml/read';
import { add, cmp, type QuarterTime, q } from './time';

export type ChordLessonCode = 'chord-tones' | 'bass' | 'common-tone' | 'stray-note';

export interface ChordLessonDifference {
  kind: 'chordLesson';
  code: ChordLessonCode;
  /** The printed measure number. */
  bar: string;
  detail: string;
}

export interface ChordLessonClaims {
  /** A switch keeps this key down, or strikes it again, from the previous chord (beat in quarter notes from 1). */
  commonTones?: { bar: number; beat: number; pitch: string }[];
  /** The chord named at this bar and beat leaves these tones out (degrees "1", "3", "5", "7"). */
  omit?: { bar: number; beat: number; tones: string[] }[];
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A chord type's tones above its root: [degree, letters up, semitones up] (research R4). */
const TYPES: Record<string, [string, number, number][]> = {
  '': [
    ['1', 0, 0],
    ['3', 2, 4],
    ['5', 4, 7],
  ],
  m: [
    ['1', 0, 0],
    ['3', 2, 3],
    ['5', 4, 7],
  ],
  '°': [
    ['1', 0, 0],
    ['3', 2, 3],
    ['5', 4, 6],
  ],
  '+': [
    ['1', 0, 0],
    ['3', 2, 4],
    ['5', 4, 8],
  ],
  sus2: [
    ['1', 0, 0],
    ['2', 1, 2],
    ['5', 4, 7],
  ],
  sus4: [
    ['1', 0, 0],
    ['4', 3, 5],
    ['5', 4, 7],
  ],
  maj7: [
    ['1', 0, 0],
    ['3', 2, 4],
    ['5', 4, 7],
    ['7', 6, 11],
  ],
  '7': [
    ['1', 0, 0],
    ['3', 2, 4],
    ['5', 4, 7],
    ['7', 6, 10],
  ],
  m7: [
    ['1', 0, 0],
    ['3', 2, 3],
    ['5', 4, 7],
    ['7', 6, 10],
  ],
  ø7: [
    ['1', 0, 0],
    ['3', 2, 3],
    ['5', 4, 6],
    ['7', 6, 10],
  ],
};
const NAME = /^([A-G])(♯|♭|#|b)?(m7|maj7|m|°|\+|sus2|sus4|7|ø7)?(?:\/([A-G])(♯|♭|#|b)?)?$/;

interface Tone {
  step: string;
  alter: number;
}
const toneName = (t: Tone) =>
  `${t.step}${t.alter === 1 ? '#' : t.alter === -1 ? 'b' : t.alter === 2 ? '##' : t.alter === -2 ? 'bb' : ''}`;
const alterOf = (accidental: string | undefined) =>
  accidental === '#' || accidental === '♯' ? 1 : accidental === 'b' || accidental === '♭' ? -1 : 0;

interface Chord {
  name: string;
  root: Tone;
  tones: { degree: string; tone: Tone }[];
  bass: Tone;
}

/** The tones of a chord name by letter arithmetic; null when the name is not in research R4's grammar. */
export function chordOf(name: string): Chord | null {
  const m = NAME.exec(name);
  if (!m) return null;
  const root: Tone = { step: m[1] as string, alter: alterOf(m[2]) };
  const type = TYPES[m[3] ?? ''];
  if (!type) return null;
  const rootLetter = LETTERS.indexOf(root.step as (typeof LETTERS)[number]);
  const rootPc = (NATURAL[root.step] ?? 0) + root.alter;
  const tones = type.map(([degree, letters, semitones]) => {
    const step = LETTERS[(rootLetter + letters) % 7] as string;
    let alter = (rootPc + semitones - (NATURAL[step] ?? 0)) % 12;
    if (alter > 6) alter -= 12;
    if (alter < -6) alter += 12;
    return { degree, tone: { step, alter } };
  });
  const bass = m[4] ? { step: m[4], alter: alterOf(m[5]) } : root;
  return { name, root, tones, bass };
}

interface ReadNote {
  bar: string;
  barIndex: number;
  start: QuarterTime;
  end: QuarterTime;
  tone: Tone;
  octave: number;
  midi: number;
}

interface ReadSymbol {
  bar: string;
  barIndex: number;
  at: QuarterTime;
  name: string;
}

const kids = (el: XmlElementType, name?: string): XmlElementType[] =>
  el.children.filter((c): c is XmlElementType => c instanceof XmlElement && (name === undefined || c.name === name));
const kid = (el: XmlElementType, name: string): XmlElementType | undefined => kids(el, name)[0];
const textOf = (el: XmlElementType | undefined): string => (el ? el.text.trim() : '');

function read(xml: string): { notes: ReadNote[]; symbols: ReadSymbol[]; barStarts: QuarterTime[]; end: QuarterTime } {
  const { doc } = readXml(xml);
  const root = doc.children.find((c): c is XmlElementType => c instanceof XmlElement);
  const notes: ReadNote[] = [];
  const symbols: ReadSymbol[] = [];
  const barStarts: QuarterTime[] = [];
  const part = root ? kid(root, 'part') : undefined;
  let divisions = 1;
  let start = q(0);
  for (const [barIndex, measure] of (part ? kids(part, 'measure') : []).entries()) {
    const bar = measure.attributes.number ?? String(barIndex + 1);
    barStarts.push(start);
    let cursor = start;
    let lastOnset = start;
    let furthest = start;
    for (const el of kids(measure)) {
      if (el.name === 'attributes') {
        const d = Number(textOf(kid(el, 'divisions')));
        if (d > 0) divisions = d;
      } else if (el.name === 'direction') {
        for (const type of kids(el, 'direction-type'))
          for (const words of kids(type, 'words')) {
            const text = words.text.trim();
            if (text !== '' && words.attributes['font-style'] !== 'italic')
              symbols.push({ bar, barIndex, at: cursor, name: text });
          }
      } else if (el.name === 'backup' || el.name === 'forward') {
        const d = q(Number(textOf(kid(el, 'duration'))), divisions);
        cursor = el.name === 'backup' ? add(cursor, q(-d.num, d.den)) : add(cursor, d);
      } else if (el.name === 'note') {
        if (kid(el, 'grace')) continue;
        const chord = kid(el, 'chord') !== undefined;
        const onset = chord ? lastOnset : cursor;
        const length = q(Number(textOf(kid(el, 'duration'))), divisions);
        const pitch = kid(el, 'pitch');
        if (pitch) {
          const step = textOf(kid(pitch, 'step'));
          const alter = Number(textOf(kid(pitch, 'alter')) || '0');
          const octave = Number(textOf(kid(pitch, 'octave')));
          notes.push({
            bar,
            barIndex,
            start: onset,
            end: add(onset, length),
            tone: { step, alter },
            octave,
            midi: 12 * (octave + 1) + (NATURAL[step] ?? 0) + alter,
          });
        }
        if (!chord) {
          lastOnset = cursor;
          cursor = add(cursor, length);
        }
        if (cmp(cursor, furthest) > 0) furthest = cursor;
      }
    }
    start = furthest;
  }
  return { notes, symbols, barStarts, end: start };
}

/** The time of a printed bar and a beat counted in quarter notes from 1. */
function timeAt(
  barStarts: readonly QuarterTime[],
  bars: readonly ReadSymbol[] | readonly ReadNote[],
  bar: number,
  beat: number,
) {
  const index = bars.find((b) => b.bar === String(bar))?.barIndex;
  const barStart = index !== undefined ? barStarts[index] : undefined;
  if (!barStart) return undefined;
  const offset = Math.round((beat - 1) * 1000);
  return add(barStart, q(offset, 1000));
}

const sounding = (notes: readonly ReadNote[], t: QuarterTime) =>
  notes.filter((n) => cmp(n.start, t) <= 0 && cmp(n.end, t) > 0);
const sameTone = (a: Tone, b: Tone) => a.step === b.step && a.alter === b.alter;
const pitchName = (n: ReadNote) => `${toneName(n.tone)}${n.octave}`;

/** The differences of contract audit-record 1.5.0 `chord-lessons-v1` in `xml` under `claims`. */
export function checkChordLesson(xml: string, claims: ChordLessonClaims): ChordLessonDifference[] {
  const { notes, symbols, barStarts, end } = read(xml);
  const differences: ChordLessonDifference[] = [];
  const ordered = [...symbols].sort((a, b) => cmp(a.at, b.at));

  ordered.forEach((symbol, i) => {
    const chord = chordOf(symbol.name);
    if (!chord) {
      differences.push({
        kind: 'chordLesson',
        code: 'chord-tones',
        bar: symbol.bar,
        detail: `"${symbol.name}" is not a chord name of research R4`,
      });
      return;
    }
    const omitted = new Set(
      (claims.omit ?? [])
        .filter((o) => {
          const t = timeAt(barStarts, ordered, o.bar, o.beat) ?? timeAt(barStarts, notes, o.bar, o.beat);
          return t !== undefined && cmp(t, symbol.at) === 0;
        })
        .flatMap((o) => o.tones),
    );
    const wanted = chord.tones.filter((t) => !omitted.has(t.degree)).map((t) => t.tone);
    const heard = sounding(notes, symbol.at).sort((a, b) => a.midi - b.midi);
    const heardTones: Tone[] = [];
    for (const n of heard) if (!heardTones.some((t) => sameTone(t, n.tone))) heardTones.push(n.tone);
    const exact = wanted.length === heardTones.length && wanted.every((w) => heardTones.some((h) => sameTone(h, w)));
    if (!exact)
      differences.push({
        kind: 'chordLesson',
        code: 'chord-tones',
        bar: symbol.bar,
        detail: `${chord.name} needs ${chord.tones.map((t) => toneName(t.tone)).join(' ')}, sounds ${heardTones.map(toneName).join(' ')}`,
      });
    const lowest = heard[0];
    if (lowest && !sameTone(lowest.tone, chord.bass))
      differences.push({
        kind: 'chordLesson',
        code: 'bass',
        bar: symbol.bar,
        detail: `${chord.name} needs ${toneName(chord.bass)} in the bass, the lowest note is ${pitchName(lowest)}`,
      });

    // notes struck later under this name must be its tones
    const until = ordered[i + 1]?.at ?? end;
    for (const n of notes) {
      if (cmp(n.start, symbol.at) <= 0 || cmp(n.start, until) >= 0) continue;
      if (!chord.tones.some((t) => sameTone(t.tone, n.tone)))
        differences.push({
          kind: 'chordLesson',
          code: 'stray-note',
          bar: n.bar,
          detail: `${pitchName(n)} is not a tone of ${chord.name}`,
        });
    }
  });

  for (const tone of claims.commonTones ?? []) {
    const t = timeAt(barStarts, ordered, tone.bar, tone.beat) ?? timeAt(barStarts, notes, tone.bar, tone.beat);
    const before = ordered.filter((s) => t !== undefined && cmp(s.at, t) < 0).pop();
    const now = t !== undefined ? sounding(notes, t) : [];
    const earlier = before ? sounding(notes, before.at) : [];
    const kept =
      now.some((n) => pitchName(n) === normalise(tone.pitch)) &&
      earlier.some((n) => pitchName(n) === normalise(tone.pitch));
    if (!kept)
      differences.push({
        kind: 'chordLesson',
        code: 'common-tone',
        bar: String(tone.bar),
        detail: `${tone.pitch} is claimed to stay from the chord before, but is not held or struck again`,
      });
  }
  return differences;
}

/** "F♯3" and "F#3" name the same key: the file's spelling uses # and b. */
function normalise(pitch: string): string {
  return pitch.replace('♯', '#').replace('♭', 'b');
}
