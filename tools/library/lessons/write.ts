// Turns a lesson definition into library items (contract lesson-definition 1.0.0 §4 step 2, data-model §3): one part
// "Piano", two staves, the key, metre and tempo mark, the explanation line and the chord symbols as <words> above
// staff 1, then planEngraving(doc, 'library') for beams and accidentals - through the app's own MusicXML writer, like
// the songs. One item per transposition.
import { displayKeyName } from '../../../src/core/library/exercise/keys';
import { applyInserts, planEngraving } from '../../../src/core/musicxml/engraving/plan';
import { readXml } from '../../../src/core/musicxml/read';
import {
  type WriteArticulation,
  type WriteEvent,
  type WriteMeasure,
  type WriteNote,
  type WritePitch,
  writeScoreXml,
} from '../../../src/core/musicxml/write';
import { type Interval, parseInterval, transposeSpelling } from '../fidelity/compare';
import { type Spelling, spellingMidi } from '../fidelity/reference';
import { add, type QuarterTime, q, show } from '../fidelity/time';
import { isCompoundMetre, type LessonDefinition, type LessonKey } from './definition';
import { type LessonToken, type ParsedBar, parseLessonBars } from './parse';

export interface BuiltLesson {
  id: string;
  section: string;
  title: string;
  level: LessonDefinition['level'];
  stepOrder: number;
  simplifies?: string;
  xml: string;
  sidecar: Record<string, unknown>;
}

/** Ticks per quarter note in every lesson file: a dotted sixteenth (3/8 of a quarter) is 3. */
const DIVISIONS = 8;
const RH_VOICE = '1';
const LH_VOICE = '5';

const ticks = (t: QuarterTime): number => (t.num * DIVISIONS) / t.den;

function writePitch(s: Spelling): WritePitch {
  return { step: s.step, ...(s.alter !== 0 ? { alter: s.alter } : {}), octave: s.octave };
}

const ACCIDENTAL: Record<string, string> = { '#': '♯', b: '♭', '♯': '♯', '♭': '♭', '': '' };
const SYMBOL = /^([A-G])(♯|♭|#|b)?(.*?)(?:\/([A-G])(♯|♭|#|b)?)?$/;

/** A chord name moved by `interval`: its root and slash bass are respelled, its quality kept (research R4). */
function transposeSymbol(symbol: string, interval: Interval | undefined): string {
  const m = SYMBOL.exec(symbol);
  if (!m) return symbol;
  const name = (letter: string, accidental: string | undefined): string => {
    if (!interval) return `${letter}${ACCIDENTAL[accidental ?? ''] ?? ''}`;
    const alter = accidental === '#' || accidental === '♯' ? 1 : accidental === 'b' || accidental === '♭' ? -1 : 0;
    const moved = transposeSpelling({ step: letter as Spelling['step'], alter, octave: 4 }, interval);
    return `${moved.step}${moved.alter === 1 ? '♯' : moved.alter === -1 ? '♭' : moved.alter === 2 ? '𝄪' : moved.alter === -2 ? '𝄫' : ''}`;
  };
  const root = name(m[1] as string, m[2]);
  const bass = m[4] ? `/${name(m[4], m[5])}` : '';
  return `${root}${m[3] ?? ''}${bass}`;
}

function articulationsOf(token: LessonToken): WriteArticulation[] {
  const marks: WriteArticulation[] = [];
  if (token.staccato) marks.push('staccato');
  if (token.accent) marks.push('accent');
  if (token.tenuto) marks.push('tenuto');
  return marks;
}

function notesOf(
  token: LessonToken,
  fingers: readonly number[],
  tiedFrom: ReadonlySet<number>,
  midis: readonly number[],
  pitches: readonly Spelling[],
  staff: number,
  voice: string,
  barLength: QuarterTime,
): WriteNote[] {
  const base = { voice, staff, type: token.measureRest ? ('whole' as const) : token.type };
  if (token.rest) {
    return [
      {
        ...base,
        rest: true,
        ...(token.measureRest ? { measureRest: true } : {}),
        duration: ticks(token.measureRest ? barLength : token.length),
        ...(token.dots && !token.measureRest ? { dot: true } : {}),
      },
    ];
  }
  const articulations = articulationsOf(token);
  const slurs = [
    ...(token.slurEnd ? [{ type: 'stop' as const, number: 1 }] : []),
    ...(token.slurStart ? [{ type: 'start' as const, number: 1 }] : []),
  ];
  return pitches.map((pitch, i) => {
    const tieStop = tiedFrom.has(midis[i] as number);
    return {
      ...base,
      pitch: writePitch(pitch),
      duration: ticks(token.length),
      ...(token.dots ? { dot: true } : {}),
      ...(i > 0 ? { chord: true } : {}),
      fingering: fingers[i] as number,
      ...(token.tie || tieStop
        ? { tie: { ...(tieStop ? { stop: true } : {}), ...(token.tie ? { start: true } : {}) } }
        : {}),
      ...(i === 0 && slurs.length > 0 ? { slurs } : {}),
      ...(articulations.length > 0 ? { articulations } : {}),
    };
  });
}

/** The measures of one item: `interval` moves every note and symbol (undefined: as written). */
function measuresOf(
  definition: LessonDefinition,
  bars: readonly ParsedBar[],
  key: LessonKey,
  interval: Interval | undefined,
): WriteMeasure[] {
  const [beats, beatType] = definition.metre.split('/');
  const compound = isCompoundMetre(definition.metre);
  const move = (s: Spelling): Spelling => (interval ? transposeSpelling(s, interval) : s);
  const midiOf = spellingMidi;

  return bars.map((bar, index) => {
    const events: WriteEvent[] = [];
    if (bar.barline === 'repeat-start' || bar.barline === 'repeat-both')
      events.push({ kind: 'barline', location: 'left', barStyle: 'heavy-light', repeat: { direction: 'forward' } });
    if (index === 0) {
      events.push({
        kind: 'direction',
        metronome: compound
          ? { beatUnit: 'quarter', dots: 1, perMinute: definition.tempoBpm / 1.5 }
          : { beatUnit: 'quarter', perMinute: definition.tempoBpm },
        tempo: definition.tempoBpm,
        staff: 1,
        placement: 'above',
      });
      if (definition.scoreText !== undefined)
        events.push({ kind: 'direction', words: definition.scoreText, italic: true, staff: 1, placement: 'above' });
    }

    // Chord symbols are printed above staff 1: one written in the left hand goes in staff 1's stream when a right-hand
    // token starts at its onset, else in the left hand's stream with <staff>1</staff>
    const onsets = (tokens: readonly LessonToken[]) => {
      let at = q(0);
      return tokens.map((t) => {
        const start = at;
        at = add(at, t.length);
        return show(start);
      });
    };
    const rhOnsets = onsets(bar.rh);
    const lhOnsets = onsets(bar.lh);
    const lhSymbolAt = new Map<string, string>();
    bar.lh.forEach((t, i) => {
      if (t.symbol !== undefined) lhSymbolAt.set(lhOnsets[i] as string, t.symbol);
    });
    const symbolEvent = (symbol: string): WriteEvent => ({
      kind: 'direction',
      words: transposeSymbol(symbol, interval),
      staff: 1,
      placement: 'above',
    });

    bar.rh.forEach((token, i) => {
      const onset = rhOnsets[i] as string;
      const symbol = token.symbol ?? (token.rest ? undefined : lhSymbolAt.get(onset));
      if (symbol !== undefined) {
        events.push(symbolEvent(symbol));
        if (token.symbol === undefined) lhSymbolAt.delete(onset);
      }
      const pitches = token.pitches.map(move);
      for (const note of notesOf(
        token,
        bar.rhFingers[i] ?? [],
        bar.rhTiedFrom[i] ?? new Set(),
        token.pitches.map(midiOf),
        pitches,
        1,
        RH_VOICE,
        bar.length,
      ))
        events.push({ kind: 'note', note });
    });
    events.push({ kind: 'backup', duration: ticks(bar.length) });
    bar.lh.forEach((token, i) => {
      const onset = lhOnsets[i] as string;
      const symbol = lhSymbolAt.get(onset);
      if (token.symbol !== undefined && symbol !== undefined) events.push(symbolEvent(symbol));
      const pitches = token.pitches.map(move);
      for (const note of notesOf(
        token,
        bar.lhFingers[i] ?? [],
        bar.lhTiedFrom[i] ?? new Set(),
        token.pitches.map(midiOf),
        pitches,
        2,
        LH_VOICE,
        bar.length,
      ))
        events.push({ kind: 'note', note });
    });

    const last = index === bars.length - 1;
    if (bar.barline === 'repeat-end' || bar.barline === 'repeat-both')
      events.push({ kind: 'barline', location: 'right', barStyle: 'light-heavy', repeat: { direction: 'backward' } });
    else if (last || bar.barline === 'final')
      events.push({ kind: 'barline', location: 'right', barStyle: 'light-heavy' });

    return {
      number: String(bar.number),
      ...(bar.implicit ? { implicit: true } : {}),
      ...(index === 0
        ? {
            attributes: {
              divisions: DIVISIONS,
              key: { fifths: key.fifths, mode: key.mode },
              time: { beats: beats as string, beatType: Number(beatType) },
              staves: 2,
              clefs: [
                { number: 1, sign: 'G', line: 2 },
                { number: 2, sign: 'F', line: 4 },
              ],
            },
          }
        : {}),
      events,
    };
  });
}

/** Every item `definition` (read from content/library/lessons/`file`) writes, in transposition order. Throws a
 *  LessonDefinitionError for a bar or token that breaks contract §2. */
export function buildLessonItems(definition: LessonDefinition, file: string, generatedOn: string): BuiltLesson[] {
  const bars = parseLessonBars(definition.bars, { metre: definition.metre, pickup: definition.pickup ?? false });
  const variants = definition.transpositions?.map((t, index) => ({
    slug: t.slug,
    key: { tonic: t.tonic, mode: t.mode, fifths: t.fifths },
    interval: parseInterval(t.interval),
    index,
  })) ?? [{ slug: undefined, key: definition.key, interval: undefined, index: 0 }];

  return variants.map((variant) => {
    const resolve = (text: string) => (variant.slug === undefined ? text : text.split('{key}').join(variant.slug));
    const id = resolve(definition.id);
    const title = definition.title.split('{keyName}').join(displayKeyName(variant.key));
    const stepOrder = definition.stepOrder + variant.index;
    const simplifies = definition.simplifies !== undefined ? resolve(definition.simplifies) : undefined;

    const raw = writeScoreXml({
      title,
      parts: [{ id: 'P1', name: 'Piano', measures: measuresOf(definition, bars, variant.key, variant.interval) }],
    });
    const plan = planEngraving(readXml(raw).doc, 'library');
    const xml = plan.inserts.length > 0 ? applyInserts(raw, plan.inserts) : raw;

    const sidecar: Record<string, unknown> = {
      version: 1,
      title,
      kind: 'exercise',
      level: definition.level,
      ...(definition.raisedBecause !== undefined ? { raisedBecause: definition.raisedBecause } : {}),
      tags: definition.tags,
      trains: definition.trains,
      hands: definition.hands,
      provenance: {
        origin: 'authored',
        licence: 'CC0-1.0',
        author: definition.author,
        created: generatedOn,
        note: `Generated by tools/library/build-lessons.ts from content/library/lessons/${file} (contract lesson-definition 1.0.0); never hand-edit`,
      },
      reviewedBy: definition.reviewedBy,
      reviewedOn: definition.reviewedOn,
      stepOrder,
      ...(simplifies !== undefined ? { simplifies } : {}),
    };
    return {
      id,
      section: definition.section,
      title,
      level: definition.level,
      stepOrder,
      ...(simplifies !== undefined ? { simplifies } : {}),
      xml,
      sidecar,
    };
  });
}
