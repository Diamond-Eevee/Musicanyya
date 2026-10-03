// The independent check of a Basics lesson (rule set lesson-claims-v1, feature 022, contract audit-record 1.5.0).
//
// A Basics lesson promises a beginner three things: its idea is explained on the score, it uses only notation that it or
// an earlier lesson has introduced, and (where it says so) it repeats one pitch so only the rhythm changes. Like theory.ts
// this reads only the finished MusicXML and the claims written in the item's audit record; it never sees the lesson
// definition or the builder that wrote the file.
import type { XmlElement as XmlElementType } from '@rgrove/parse-xml';
import { XmlElement } from '@rgrove/parse-xml';
import { readXml } from '../../../src/core/musicxml/read';
import { add, cmp, type QuarterTime, q, show } from './time';

export type LessonClaimCode =
  | 'explanation-missing'
  | 'not-single-pitch'
  | 'not-introduced'
  | 'tie-pitch'
  | 'slur-same-pitch';

export interface LessonClaimDifference {
  kind: 'lessonClaim';
  code: LessonClaimCode;
  /** The printed measure number. */
  bar: string;
  detail: string;
}

export interface LessonClaimRecord {
  itemId: string;
  /** The lesson's place in the teaching order (its stepOrder). */
  teachingOrder: number;
  claims: { introduces?: string[]; singlePitch?: boolean; practice?: boolean };
}

interface ReadNote {
  measureIndex: number;
  bar: string;
  staff: number;
  voice: string;
  onset: QuarterTime;
  length: QuarterTime;
  rest: boolean;
  measureRest: boolean;
  type: string;
  dots: number;
  midi?: number;
  name?: string;
  tieStart: boolean;
  tieStop: boolean;
  slurStarts: string[];
  slurStops: string[];
  articulations: string[];
  chord: boolean;
  finger?: number;
}

interface ReadWords {
  measureIndex: number;
  bar: string;
  staff: number;
  placement?: string;
  italic: boolean;
  text: string;
}

interface Reading {
  notes: ReadNote[];
  words: ReadWords[];
  /** Per measure: its printed number, whether implicit, its written length and the metre in force. */
  measures: { bar: string; implicit: boolean; length: QuarterTime; metre: QuarterTime }[];
  metres: { bar: string; name: string }[];
  repeats: string[];
  /** Clef sign per staff, as first written. */
  clefs: Map<number, string>;
}

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const VALUE_NAMES: Record<string, string> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  '16th': 'sixteenth',
};

const kids = (el: XmlElementType, name?: string): XmlElementType[] =>
  el.children.filter((c): c is XmlElementType => c instanceof XmlElement && (name === undefined || c.name === name));
const kid = (el: XmlElementType, name: string): XmlElementType | undefined => kids(el, name)[0];
const textOf = (el: XmlElementType | undefined): string => (el ? el.text.trim() : '');

function read(xml: string): Reading {
  const { doc } = readXml(xml);
  const root = doc.children.find((c): c is XmlElementType => c instanceof XmlElement);
  if (root?.name !== 'score-partwise') throw new Error('lesson-claims-v1 reads score-partwise files');
  const reading: Reading = { notes: [], words: [], measures: [], metres: [], repeats: [], clefs: new Map() };
  const part = kid(root, 'part');
  if (!part) return reading;
  let divisions = 1;
  let metre = q(4);
  let start = q(0);
  kids(part, 'measure').forEach((measure, measureIndex) => {
    const bar = measure.attributes.number ?? String(measureIndex + 1);
    let cursor = start;
    let furthest = start;
    let lastOnset = start;
    for (const el of kids(measure)) {
      if (el.name === 'attributes') {
        const d = Number(textOf(kid(el, 'divisions')));
        if (d > 0) divisions = d;
        const time = kid(el, 'time');
        if (time) {
          const beats = Number(textOf(kid(time, 'beats')));
          const beatType = Number(textOf(kid(time, 'beat-type')));
          metre = q(beats * 4, beatType);
          reading.metres.push({ bar, name: `metre-${beats}-${beatType}` });
        }
        for (const clef of kids(el, 'clef')) {
          const staff = Number(clef.attributes.number ?? '1');
          if (!reading.clefs.has(staff)) reading.clefs.set(staff, textOf(kid(clef, 'sign')));
        }
      } else if (el.name === 'direction') {
        for (const type of kids(el, 'direction-type'))
          for (const words of kids(type, 'words'))
            if (words.text.trim() !== '')
              reading.words.push({
                measureIndex,
                bar,
                staff: Number(textOf(kid(el, 'staff')) || '1'),
                ...(el.attributes.placement !== undefined ? { placement: el.attributes.placement } : {}),
                italic: words.attributes['font-style'] === 'italic',
                text: words.text.trim(),
              });
      } else if (el.name === 'barline') {
        if (kid(el, 'repeat')) reading.repeats.push(bar);
      } else if (el.name === 'backup' || el.name === 'forward') {
        const d = q(Number(textOf(kid(el, 'duration'))), divisions);
        cursor = el.name === 'backup' ? add(cursor, q(-d.num, d.den)) : add(cursor, d);
      } else if (el.name === 'note') {
        if (kid(el, 'grace')) continue;
        const chord = kid(el, 'chord') !== undefined;
        const onset = chord ? lastOnset : cursor;
        const length = q(Number(textOf(kid(el, 'duration'))), divisions);
        const pitch = kid(el, 'pitch');
        const restEl = kid(el, 'rest');
        const notations = kids(el, 'notations');
        const note: ReadNote = {
          measureIndex,
          bar,
          staff: Number(textOf(kid(el, 'staff')) || '1'),
          voice: textOf(kid(el, 'voice')) || '1',
          onset,
          length,
          rest: restEl !== undefined,
          measureRest: restEl?.attributes.measure === 'yes',
          type: textOf(kid(el, 'type')),
          dots: kids(el, 'dot').length,
          tieStart: kids(el, 'tie').some((t) => t.attributes.type === 'start'),
          tieStop: kids(el, 'tie').some((t) => t.attributes.type === 'stop'),
          slurStarts: notations.flatMap((n) =>
            kids(n, 'slur')
              .filter((s) => s.attributes.type === 'start')
              .map((s) => s.attributes.number ?? '1'),
          ),
          slurStops: notations.flatMap((n) =>
            kids(n, 'slur')
              .filter((s) => s.attributes.type === 'stop')
              .map((s) => s.attributes.number ?? '1'),
          ),
          articulations: notations.flatMap((n) => kids(n, 'articulations').flatMap((a) => kids(a).map((x) => x.name))),
          chord,
        };
        const finger = notations
          .flatMap((n) => kids(n, 'technical').flatMap((t) => kids(t, 'fingering')))
          .map((f) => Number(f.text))[0];
        if (finger !== undefined && Number.isFinite(finger)) note.finger = finger;
        if (pitch) {
          const step = textOf(kid(pitch, 'step'));
          const alter = Number(textOf(kid(pitch, 'alter')) || '0');
          const octave = Number(textOf(kid(pitch, 'octave')));
          note.midi = 12 * (octave + 1) + (STEP_SEMITONES[step] ?? 0) + alter;
          note.name = `${step}${alter === 1 ? '#' : alter === -1 ? 'b' : ''}${octave}`;
        }
        reading.notes.push(note);
        if (!chord) {
          lastOnset = cursor;
          cursor = add(cursor, length);
        }
        if (cmp(cursor, furthest) > 0) furthest = cursor;
      }
    }
    const length = add(furthest, q(-start.num, start.den));
    reading.measures.push({ bar, implicit: measure.attributes.implicit === 'yes', length, metre });
    start = furthest;
  });
  return reading;
}

/** The staves that hold more than whole-bar rests: a staff of `R` only (with its clef) is not notation a lesson uses. */
function usedStaves(reading: Reading): Set<number> {
  const used = new Set<number>();
  const perStaffMeasure = new Map<string, ReadNote[]>();
  for (const note of reading.notes) {
    const key = `${note.staff}|${note.measureIndex}`;
    perStaffMeasure.set(key, [...(perStaffMeasure.get(key) ?? []), note]);
  }
  for (const notes of perStaffMeasure.values()) {
    const wholeBarRest = notes.length === 1 && notes[0]?.rest === true;
    if (!wholeBarRest) for (const n of notes) used.add(n.staff);
  }
  return used;
}

function valueFeature(note: ReadNote): string {
  const name = VALUE_NAMES[note.type] ?? note.type;
  const dotted = note.dots > 0 ? `${'dotted-'.repeat(note.dots)}` : '';
  return note.rest ? `${dotted}${name}-rest` : `${dotted}${name}`;
}

/** Every notation feature of contract lesson-definition §3 the file uses, with the first bar it appears in. Tempo
 *  marks, key signatures, bar numbers and the explanation line are never counted. */
export function detectNotationFeatures(xml: string): Map<string, string> {
  return detect(read(xml));
}

function detect(reading: Reading): Map<string, string> {
  const features = new Map<string, string>();
  const see = (feature: string, bar: string) => {
    if (!features.has(feature)) features.set(feature, bar);
  };
  const used = usedStaves(reading);
  const firstBar = reading.measures[0]?.bar ?? '1';
  for (const staff of used) {
    see('staff', firstBar);
    const sign = reading.clefs.get(staff) ?? (staff === 1 ? 'G' : 'F');
    if (sign === 'G') see('treble-clef', firstBar);
    if (sign === 'F') see('bass-clef', firstBar);
  }
  for (const m of reading.metres) see(m.name, m.bar);
  const first = reading.measures[0];
  if (first?.implicit && cmp(first.length, first.metre) < 0) see('pickup', first.bar);
  for (const bar of reading.repeats) see('repeat', bar);
  for (const w of reading.words) if (!w.italic) see('chord-symbol', w.bar);

  const notes = reading.notes.filter((n) => used.has(n.staff));
  const pitched = notes.filter((n) => !n.rest && n.midi !== undefined);
  for (const note of notes) {
    if (note.rest && note.measureRest) see('whole-rest', note.bar);
    else see(valueFeature(note), note.bar);
    if (note.rest) continue;
    if (note.midi === 60) see('middle-c', note.bar);
    if (note.chord) see('chord', note.bar);
    if (note.slurStarts.length > 0 || note.slurStops.length > 0) see('slur', note.bar);
    for (const a of note.articulations) if (a === 'staccato' || a === 'accent' || a === 'tenuto') see(a, note.bar);
    if (note.finger === 4 || note.finger === 5) see('five-finger-position', note.bar);
  }

  // ties: a tie stop continues an earlier note; across the bar line when that note is in another measure
  for (const note of pitched.filter((n) => n.tieStop)) {
    see('tie', note.bar);
    const from = pitched.find(
      (p) =>
        p.tieStart &&
        p.staff === note.staff &&
        p.voice === note.voice &&
        p.midi === note.midi &&
        cmp(add(p.onset, p.length), note.onset) === 0,
    );
    if (from && from.measureIndex !== note.measureIndex) see('tie-across-barline', note.bar);
  }

  // per staff: steps, a five-note position, the hands
  for (const staff of new Set(pitched.map((n) => n.staff))) {
    const onStaff = pitched.filter((n) => n.staff === staff);
    if (new Set(onStaff.map((n) => n.midi)).size >= 4) see('five-finger-position', onStaff[0]?.bar ?? firstBar);
    const attacks = onStaff.filter((n) => !n.chord).sort((a, b) => cmp(a.onset, b.onset));
    for (let i = 1; i < attacks.length; i++) {
      const step = Math.abs((attacks[i]?.midi ?? 0) - (attacks[i - 1]?.midi ?? 0));
      if (step === 1 || step === 2) see('steps', attacks[i]?.bar ?? firstBar);
    }
    if (staff === 2) see('left-hand', onStaff[0]?.bar ?? firstBar);
  }
  const staves = new Set(pitched.map((n) => n.staff));
  if (staves.has(1) && staves.has(2)) {
    const second = pitched.filter((n) => n.staff === 2).sort((a, b) => cmp(a.onset, b.onset))[0];
    see('hands-alternate', second?.bar ?? firstBar);
    const rightOnsets = new Set(pitched.filter((n) => n.staff === 1 && !n.tieStop).map((n) => show(n.onset)));
    const together = pitched.find((n) => n.staff === 2 && !n.tieStop && rightOnsets.has(show(n.onset)));
    if (together) see('hands-together', together.bar);
  }
  return features;
}

/** The differences of contract audit-record 1.5.0 `lesson-claims-v1` for the lesson `own` in `xml`; `others` are the
 *  records of the other Basics lessons (those earlier in the teaching order introduce what this one may use). */
export function checkLessonClaims(
  xml: string,
  own: LessonClaimRecord,
  others: readonly LessonClaimRecord[],
): LessonClaimDifference[] {
  const reading = read(xml);
  const differences: LessonClaimDifference[] = [];
  const firstBar = reading.measures[0]?.bar ?? '1';

  const explained = reading.words.some(
    (w) => w.measureIndex === 0 && w.staff === 1 && (w.placement ?? 'above') === 'above' && w.italic,
  );
  if (!explained)
    differences.push({
      kind: 'lessonClaim',
      code: 'explanation-missing',
      bar: firstBar,
      detail: 'no explanation printed above staff 1',
    });

  const pitched = reading.notes.filter((n) => !n.rest && n.midi !== undefined);
  if (own.claims.singlePitch) {
    const names = new Map<number, string>();
    for (const n of pitched) if (!names.has(n.midi as number)) names.set(n.midi as number, n.name as string);
    if (names.size > 1) {
      const firstMidi = pitched[0]?.midi;
      const other = pitched.find((n) => n.midi !== firstMidi);
      differences.push({
        kind: 'lessonClaim',
        code: 'not-single-pitch',
        bar: other?.bar ?? firstBar,
        detail: `claims one pitch, sounds ${[...names.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, name]) => name)
          .join(', ')}`,
      });
    }
  }

  const introduced = new Set([
    ...(own.claims.introduces ?? []),
    ...others.filter((o) => o.teachingOrder < own.teachingOrder).flatMap((o) => o.claims.introduces ?? []),
  ]);
  const missing = [...detect(reading).entries()]
    .filter(([feature]) => !introduced.has(feature))
    .sort((a, b) => barOrder(reading, a[1]) - barOrder(reading, b[1]) || (a[0] < b[0] ? -1 : 1));
  for (const [feature, bar] of missing)
    differences.push({
      kind: 'lessonClaim',
      code: 'not-introduced',
      bar,
      detail: `${feature} is not introduced by this or an earlier lesson`,
    });

  // a tie continues on the same pitch, written next in its voice
  for (const start of pitched.filter((n) => n.tieStart)) {
    const end = add(start.onset, start.length);
    const continued = pitched.some(
      (n) =>
        n.tieStop &&
        n.staff === start.staff &&
        n.voice === start.voice &&
        n.midi === start.midi &&
        cmp(n.onset, end) === 0,
    );
    if (!continued)
      differences.push({
        kind: 'lessonClaim',
        code: 'tie-pitch',
        bar: start.bar,
        detail: `a tie from ${start.name} does not continue on ${start.name}`,
      });
  }

  // a slur over two equal notes only is a tie in disguise
  for (const start of pitched.filter((n) => n.slurStarts.length > 0)) {
    const voice = pitched
      .filter((n) => n.staff === start.staff && n.voice === start.voice && !n.chord)
      .sort((a, b) => cmp(a.onset, b.onset));
    const next = voice[voice.indexOf(start) + 1];
    if (next && next.midi === start.midi && start.slurStarts.some((s) => next.slurStops.includes(s)))
      differences.push({
        kind: 'lessonClaim',
        code: 'slur-same-pitch',
        bar: start.bar,
        detail: `a slur joins two ${start.name}s only; a tie joins equal pitches`,
      });
  }
  return differences;
}

function barOrder(reading: Reading, bar: string): number {
  const i = reading.measures.findIndex((m) => m.bar === bar);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}
