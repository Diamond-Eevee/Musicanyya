/** Turns an `ExerciseDefinition` (contracts/exercise-definition.md) plus one of its keys into a
 *  generated MusicXML file and its sidecar. Pure: no filesystem, no Date.now() (the generation date
 *  is a parameter) - `tools/library/build-exercises.ts` is the only thing that writes to disk. */

import { applyInserts, planEngraving } from '../../musicxml/engraving/plan.js';
import { readXml } from '../../musicxml/read.js';
import type {
  WriteDuration,
  WriteEvent,
  WriteMeasure,
  WriteMeasureAttributes,
  WritePitch,
} from '../../musicxml/write.js';
import { writeScoreXml } from '../../musicxml/write.js';
import type { ItemMetadata } from '../types.js';
import { chordTones, invertOrder, tonicPitchClass } from './degrees.js';
import { assertFingeringLength, triadFingering } from './fingering.js';
import { assertWithin88Keys } from './range-guard.js';
import type { ExerciseDefinition, ExerciseKey, ExerciseStep, Inversion, Quality, StepDuration } from './types.js';
import { placeAscending, registerAnchorMidi, transposeOctaves, type VoicedNote } from './voicing.js';

export interface GeneratedExerciseItem {
  fileStem: string;
  xml: string;
  meta: ItemMetadata;
}

/** Every generated file ships fully engraved (beams + accidentals), same as the hand-written
 *  repertoire (`tools/library/engrave.ts`) - so the library guard (FR-012) has one truth for both. */
function completeXml(xml: string): string {
  const { doc } = readXml(xml);
  const plan = planEngraving(doc, 'library');
  return plan.inserts.length > 0 ? applyInserts(xml, plan.inserts) : xml;
}

/** Divisions per quarter note. Every duration this family uses (whole, half, dotted-half, quarter)
 *  divides evenly at 4, matching the existing hand-authored chords fixture. */
const DIVISIONS = 4;

const DURATION_TICKS: Record<StepDuration, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  'dotted-half': 12,
  'dotted-quarter': 6,
};
const DURATION_TYPE: Record<StepDuration, WriteDuration> = {
  whole: 'whole',
  half: 'half',
  quarter: 'quarter',
  eighth: 'eighth',
  'dotted-half': 'half',
  'dotted-quarter': 'quarter',
};
const DURATION_DOT: Record<StepDuration, boolean> = {
  whole: false,
  half: false,
  quarter: false,
  eighth: false,
  'dotted-half': true,
  'dotted-quarter': true,
};
const REST_TICKS: Record<'none' | 'eighth' | 'quarter' | 'half', number> = { none: 0, eighth: 2, quarter: 4, half: 8 };

const SUPERSCRIPT_DIGITS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '4': '⁴', '6': '⁶' };
function superscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join('');
}

/** "I", "I⁶" (first inversion), "I⁶⁴" (second inversion) - the figured-bass shorthand this family's
 *  content plan (data-model.md §5.1) writes above the staff. A diminished triad carries the degree sign ("vii°"). */
export function romanFigure(degree: string, inversion: Inversion, quality?: Quality): string {
  const numeral = quality === 'diminished' ? `${degree}°` : degree;
  if (inversion === 0) return numeral;
  if (inversion === 1) return `${numeral}${superscript(6)}`;
  return `${numeral}${superscript(6)}${superscript(4)}`;
}

function displayKeyName(key: ExerciseKey): string {
  const letter = key.tonic[0];
  const accidental = key.tonic.slice(1);
  const symbol = accidental === '#' ? '♯' : accidental === 'b' ? '♭' : '';
  return `${letter}${symbol} ${key.mode}`;
}

function keySlug(key: ExerciseKey): string {
  const letter = (key.tonic[0] ?? '').toLowerCase();
  const accidental = key.tonic.slice(1);
  const accSlug = accidental === '#' ? '-sharp' : accidental === 'b' ? '-flat' : '';
  return `${letter}${accSlug}-${key.mode}`;
}

function toWritePitch(n: VoicedNote): WritePitch {
  return { step: n.step, alter: n.alter, octave: n.octave };
}

function exerciseAnchorMidi(key: ExerciseKey): number {
  return registerAnchorMidi(tonicPitchClass(key)) + 12 * (key.octaveShift ?? 0);
}

/** Voices one triad step for both hands: the right hand in close position nearest the exercise's
 *  register anchor, the left hand the identical pitch classes exactly one octave below (data-model.md
 *  §5.1 - "both hands play the same shape, LH exactly one octave below RH"). Throws if a resulting
 *  pitch falls outside the 88-key range (contracts/exercise-definition.md §2.4). */
function voiceTriad(
  key: ExerciseKey,
  degree: string,
  quality: ExerciseStep['quality'],
  inversion: Inversion,
  anchorMidi: number,
  context: string,
): { right: VoicedNote[]; left: VoicedNote[] } {
  const tones = invertOrder(chordTones(key, degree, quality), inversion);
  const right = placeAscending(tones, anchorMidi);
  const left = transposeOctaves(right, -1);
  for (const n of [...right, ...left]) assertWithin88Keys(n.midi, context);
  return { right, left };
}

function firstMeasureAttributes(definition: ExerciseDefinition, key: ExerciseKey): WriteMeasureAttributes {
  const [beats, beatTypeTxt] = definition.metre.split('/');
  return {
    divisions: DIVISIONS,
    key: { fifths: key.fifths },
    time: { beats: beats ?? '4', beatType: Number(beatTypeTxt ?? 4) },
    staves: 2,
    clefs: [
      { number: 1, sign: 'G', line: 2 },
      { number: 2, sign: 'F', line: 4 },
    ],
  };
}

function chordEvents(
  voiced: VoicedNote[],
  fingers: readonly number[],
  durationTicks: number,
  type: WriteDuration,
  dot: boolean,
  voice: string,
  staff: number,
  tieStopIndices: Set<number>,
  tieStartIndices: Set<number>,
): WriteEvent[] {
  assertFingeringLength(fingers, voiced.length, `${voice}/${staff} chord`);
  return voiced.map((n, idx) => ({
    kind: 'note' as const,
    note: {
      pitch: toWritePitch(n),
      duration: durationTicks,
      voice,
      type,
      dot,
      staff,
      chord: idx > 0,
      fingering: fingers[idx] as number,
      tie: { start: tieStartIndices.has(idx), stop: tieStopIndices.has(idx) },
    },
  }));
}

function buildMeta(definition: ExerciseDefinition, title: string, generatedOn: string): ItemMetadata {
  return {
    version: 1,
    title,
    kind: definition.meta.kind,
    level: definition.meta.level,
    tags: definition.meta.tags,
    ...(definition.meta.trains !== undefined ? { trains: definition.meta.trains } : {}),
    ...(definition.meta.hands !== undefined ? { hands: definition.meta.hands } : {}),
    provenance: {
      origin: 'authored',
      licence: 'CC0-1.0',
      author: definition.meta.provenance.author,
      created: generatedOn,
      ...(definition.meta.provenance.note ? { note: definition.meta.provenance.note } : {}),
    },
    reviewedBy: definition.meta.reviewedBy ?? definition.meta.provenance.author,
    reviewedOn: definition.meta.reviewedOn ?? generatedOn,
  };
}

/** Generates the family's 24 (or however many `keys` are given) per-key items: the same 15-step
 *  triad progression (data-model.md §5.1), continuous half notes, both hands the same shape an
 *  octave apart - FR-005's cross-key consistency is true by construction, since every key runs the
 *  same `steps` through the same voicing code. */
export function generateTriadFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  return definition.keys.map((key) => generateTriadItem(definition, key, generatedOn));
}

function generateTriadItem(
  definition: ExerciseDefinition,
  key: ExerciseKey,
  generatedOn: string,
): GeneratedExerciseItem {
  const anchorMidi = exerciseAnchorMidi(key);
  const capacity = measureTicks(definition.metre);
  const measures: WriteMeasure[] = [];
  let rightEvents: WriteEvent[] = [];
  let leftEvents: WriteEvent[] = [];
  let ticksUsed = 0;
  let measureNumber = 1;

  const flush = () => {
    const events: WriteEvent[] = [...rightEvents, { kind: 'backup', duration: ticksUsed }, ...leftEvents];
    measures.push({
      number: String(measureNumber),
      ...(measureNumber === 1 ? { attributes: firstMeasureAttributes(definition, key) } : {}),
      events,
    });
    measureNumber++;
    rightEvents = [];
    leftEvents = [];
    ticksUsed = 0;
  };

  definition.steps.forEach((step, i) => {
    const inversion = step.inversion ?? 0;
    const context = `${key.tonic} ${key.mode} step ${i} (${step.degree})`;
    const { right, left } = voiceTriad(key, step.degree, step.quality, inversion, anchorMidi, context);
    const durationTicks = DURATION_TICKS[step.duration];
    const type = DURATION_TYPE[step.duration];
    const dot = DURATION_DOT[step.duration];

    if (i === 0) {
      rightEvents.push({
        kind: 'direction',
        metronome: { beatUnit: 'quarter', perMinute: definition.tempoBpm },
        tempo: definition.tempoBpm,
        staff: 1,
        placement: 'above',
      });
    }
    rightEvents.push({
      kind: 'direction',
      words: step.label ?? romanFigure(step.degree, inversion, step.quality),
      staff: 1,
      placement: 'above',
    });

    rightEvents.push(
      ...chordEvents(right, triadFingering(inversion, 'right'), durationTicks, type, dot, '1', 1, new Set(), new Set()),
    );
    leftEvents.push(
      ...chordEvents(left, triadFingering(inversion, 'left'), durationTicks, type, dot, '5', 2, new Set(), new Set()),
    );

    ticksUsed += durationTicks;
    if (ticksUsed >= capacity) flush();
  });
  if (ticksUsed > 0) flush();

  const lastMeasure = measures[measures.length - 1];
  if (lastMeasure) lastMeasure.events.push({ kind: 'barline', location: 'right', barStyle: 'light-heavy' });

  const title = definition.titleTemplate.replace('{key}', displayKeyName(key));
  const xml = completeXml(
    writeScoreXml({
      title,
      composer: 'Musicanyya practice material',
      parts: [{ id: 'P1', name: 'Piano', measures }],
    }),
  );

  return { fileStem: `${definition.family}-${keySlug(key)}`, xml, meta: buildMeta(definition, title, generatedOn) };
}

function measureTicks(metre: string): number {
  const [beatsTxt, beatTypeTxt] = metre.split('/');
  const beats = Number(beatsTxt ?? 4);
  const beatType = Number(beatTypeTxt ?? 4);
  return beats * DIVISIONS * (4 / beatType);
}

/** Generates one chord-change drill (data-model.md §5.2): `definition.steps` is the cycle exactly as
 *  authored (one measure per chord, dotted-half + quarter rest), engraved once as section A with a
 *  backward-repeat barline, then again as section B with the rest removed (one joined whole note per
 *  chord, common tones tied to whichever neighbour shares them so the player stops lifting what does
 *  not move), and closed with one whole-note tonic
 *  triad. **Deviates from the data-model's illustrative "13 written measures"**: that count assumed
 *  every cycle was tiled out to 8 measures before repeating; here the cycle is written exactly as
 *  given (2 to 8 chords - see `research.md` "changes family written-measure count" for the reasoning)
 *  and repeated by the barline instead, which is what `<barline><repeat>` exists for. */
export function generateChangeFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  return definition.keys.map((key) => generateChangeItem(definition, key, generatedOn));
}

function generateChangeItem(
  definition: ExerciseDefinition,
  key: ExerciseKey,
  generatedOn: string,
): GeneratedExerciseItem {
  const anchorMidi = exerciseAnchorMidi(key);
  const cycle = definition.steps;
  if (cycle.length < 2) throw new Error(`${definition.family}: a chord-change drill needs at least two chords`);

  // Pre-voice every cycle chord once so section B can compare neighbours for tied common tones.
  // Each chord after the first is voiced nearest the *previous* chord's bass, not the fixed exercise
  // anchor: snapping every chord independently to the same anchor is fine for a short I-IV-V-I
  // phrase, but produces a jarring octave leap in a longer cycle that walks through several roots
  // (found by music-domain-expert review of changes-diatonic-ladder-c-major.musicxml, drill 14 -
  // T043). Chained voice leading keeps the whole cycle in one comfortable hand position.
  const voicedCycle: Array<{ step: ExerciseStep; inversion: Inversion; right: VoicedNote[]; left: VoicedNote[] }> = [];
  let chainAnchorMidi = anchorMidi;
  cycle.forEach((step, i) => {
    const inversion = step.inversion ?? 0;
    const context = `${key.tonic} ${key.mode} cycle chord ${i} (${step.degree})`;
    const voiced = voiceTriad(key, step.degree, step.quality, inversion, chainAnchorMidi, context);
    voicedCycle.push({ step, inversion, ...voiced });
    chainAnchorMidi = voiced.right[0]?.midi ?? chainAnchorMidi;
  });

  const measures: WriteMeasure[] = [];
  let measureNumber = 1;

  // Section A: one measure per cycle chord, dotted-half + quarter rest, ending in a backward repeat.
  voicedCycle.forEach(({ step, inversion, right, left }, i) => {
    const rightEvents: WriteEvent[] = [];
    if (i === 0) {
      rightEvents.push({
        kind: 'direction',
        metronome: { beatUnit: 'quarter', perMinute: definition.tempoBpm },
        tempo: definition.tempoBpm,
        staff: 1,
        placement: 'above',
      });
    }
    rightEvents.push({
      kind: 'direction',
      words: step.label
        ? `${step.label} · ${romanFigure(step.degree, inversion, step.quality)}`
        : romanFigure(step.degree, inversion, step.quality),
      staff: 1,
      placement: 'above',
    });
    rightEvents.push(
      ...chordEvents(
        right,
        triadFingering(inversion, 'right'),
        DURATION_TICKS['dotted-half'],
        'half',
        true,
        '1',
        1,
        new Set(),
        new Set(),
      ),
    );
    rightEvents.push({
      kind: 'note',
      note: { rest: true, duration: REST_TICKS.quarter, voice: '1', type: 'quarter', staff: 1 },
    });

    const leftEvents: WriteEvent[] = [
      ...chordEvents(
        left,
        triadFingering(inversion, 'left'),
        DURATION_TICKS['dotted-half'],
        'half',
        true,
        '5',
        2,
        new Set(),
        new Set(),
      ),
      { kind: 'note', note: { rest: true, duration: REST_TICKS.quarter, voice: '5', type: 'quarter', staff: 2 } },
    ];

    const events: WriteEvent[] = [
      ...rightEvents,
      { kind: 'backup', duration: DURATION_TICKS['dotted-half'] + REST_TICKS.quarter },
      ...leftEvents,
    ];
    const isLast = i === voicedCycle.length - 1;
    if (isLast) events.push({ kind: 'barline', location: 'right', repeat: { direction: 'backward' } });

    measures.push({
      number: String(measureNumber),
      ...(measureNumber === 1 ? { attributes: firstMeasureAttributes(definition, key) } : {}),
      events,
    });
    measureNumber++;
  });

  // Section B: the same cycle joined - the rest is gone, so one whole note per chord fills the
  // measure - with common tones tied into whichever neighbour shares them (data-model.md §5.2).
  voicedCycle.forEach(({ inversion, right, left }, i) => {
    const next = voicedCycle[i + 1];
    const tieStartRight = new Set<number>();
    const tieStartLeft = new Set<number>();
    if (next) {
      right.forEach((n, idx) => {
        if (next.right.some((m) => m.midi === n.midi)) tieStartRight.add(idx);
      });
      left.forEach((n, idx) => {
        if (next.left.some((m) => m.midi === n.midi)) tieStartLeft.add(idx);
      });
    }
    const prev = voicedCycle[i - 1];
    const tieStopRight = new Set<number>();
    const tieStopLeft = new Set<number>();
    if (prev) {
      right.forEach((n, idx) => {
        if (prev.right.some((m) => m.midi === n.midi)) tieStopRight.add(idx);
      });
      left.forEach((n, idx) => {
        if (prev.left.some((m) => m.midi === n.midi)) tieStopLeft.add(idx);
      });
    }

    const rightEvents = chordEvents(
      right,
      triadFingering(inversion, 'right'),
      DURATION_TICKS.whole,
      'whole',
      false,
      '1',
      1,
      tieStopRight,
      tieStartRight,
    );
    const leftEvents = chordEvents(
      left,
      triadFingering(inversion, 'left'),
      DURATION_TICKS.whole,
      'whole',
      false,
      '5',
      2,
      tieStopLeft,
      tieStartLeft,
    );
    const events: WriteEvent[] = [...rightEvents, { kind: 'backup', duration: DURATION_TICKS.whole }, ...leftEvents];
    measures.push({ number: String(measureNumber), events });
    measureNumber++;
  });

  // Final measure: the tonic triad, root position, a whole note.
  const tonicDegree = key.mode === 'major' ? 'I' : 'i';
  const finalContext = `${key.tonic} ${key.mode} final tonic`;
  const finalChord = voiceTriad(key, tonicDegree, undefined, 0, anchorMidi, finalContext);
  const finalRight = chordEvents(
    finalChord.right,
    triadFingering(0, 'right'),
    DURATION_TICKS.whole,
    'whole',
    false,
    '1',
    1,
    new Set(),
    new Set(),
  );
  const finalLeft = chordEvents(
    finalChord.left,
    triadFingering(0, 'left'),
    DURATION_TICKS.whole,
    'whole',
    false,
    '5',
    2,
    new Set(),
    new Set(),
  );
  measures.push({
    number: String(measureNumber),
    events: [
      ...finalRight,
      { kind: 'backup', duration: DURATION_TICKS.whole },
      ...finalLeft,
      { kind: 'barline', location: 'right', barStyle: 'light-heavy' },
    ],
  });

  const title = definition.titleTemplate.replace('{key}', displayKeyName(key));
  const xml = completeXml(
    writeScoreXml({
      title,
      composer: 'Musicanyya practice material',
      parts: [{ id: 'P1', name: 'Piano', measures }],
    }),
  );

  return { fileStem: `${definition.family}-${keySlug(key)}`, xml, meta: buildMeta(definition, title, generatedOn) };
}
