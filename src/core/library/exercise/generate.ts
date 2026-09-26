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
import { chordTones, invertOrder, pitchClassOfTone, tonicPitchClass } from './degrees.js';
import { assertFingeringLength, triadFingering } from './fingering.js';
import { displayKeyName, keyBySlug, keySlug } from './keys.js';
import { assertWithin88Keys } from './range-guard.js';
import { scaleFingering, scaleName, scaleNotes } from './scales.js';
import type {
  BarlineKind,
  ExerciseDefinition,
  ExerciseKey,
  ExerciseStep,
  Inversion,
  KeyPair,
  PatternChord,
  PatternHandPart,
  PatternSection,
  Quality,
  ScalePart,
  StepDuration,
} from './types.js';
import { bassInWindow, placeAscending, registerAnchorMidi, transposeOctaves, type VoicedNote } from './voicing.js';

export interface GeneratedExerciseItem {
  fileStem: string;
  /** The index section id the item is written into (contract exercise-definition 1.1: `{key}` resolved). */
  section: string;
  xml: string;
  meta: ItemMetadata;
  /** Old item ids this generated item replaces; `tools/library/build-exercises.ts` looks their hashes up. */
  supersedes: readonly string[];
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
    ...(definition.meta.raisedBecause !== undefined ? { raisedBecause: definition.meta.raisedBecause } : {}),
    ...(definition.step !== undefined ? { step: definition.step, stepOrder: definition.stepOrder ?? 0 } : {}),
  };
}

/** Where an item is written and what it replaces: the fixed `fileStem` (or the 1.0.0 rule `<family>-<key-slug>`), the section
 *  with `{key}` resolved, and the old ids the definition says this item supersedes (contract exercise-definition 1.1). */
function identityOf(
  definition: ExerciseDefinition,
  slug: string,
): Pick<GeneratedExerciseItem, 'fileStem' | 'section' | 'supersedes'> {
  return {
    fileStem: definition.fileStem ?? `${definition.family}-${slug}`,
    section: definition.section.replace('{key}', slug).replace('{pair}', slug),
    supersedes: definition.supersedes?.[slug] ?? [],
  };
}

/** Generates the family's 24 (or however many `keys` are given) per-key items: the same 15-step
 *  triad progression (data-model.md §5.1), continuous half notes, both hands the same shape an
 *  octave apart - FR-005's cross-key consistency is true by construction, since every key runs the
 *  same `steps` through the same voicing code. */
export function generateTriadFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  return definitionKeys(definition).map((key) => generateTriadItem(definition, key, generatedOn));
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

  definitionSteps(definition).forEach((step, i) => {
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

  return {
    ...identityOf(definition, keySlug(key)),
    xml,
    meta: buildMeta(definition, title, generatedOn),
  };
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
  return definitionKeys(definition).map((key) => generateChangeItem(definition, key, generatedOn));
}

function generateChangeItem(
  definition: ExerciseDefinition,
  key: ExerciseKey,
  generatedOn: string,
): GeneratedExerciseItem {
  const anchorMidi = exerciseAnchorMidi(key);
  const cycle = definitionSteps(definition);
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

  return {
    ...identityOf(definition, keySlug(key)),
    xml,
    meta: buildMeta(definition, title, generatedOn),
  };
}

// ---- Pattern form (feature 011, contracts/exercise-definition 1.1 §1a-§2a) ---------------------------------------------
// A scale in one hand against chords in the other, hands swapping. One definition makes one step in every key.

/** Ticks of each written value (DIVISIONS = 4 per quarter). */
const TICKS_TYPE: Readonly<Record<number, { type: WriteDuration; dot: boolean }>> = {
  16: { type: 'whole', dot: false },
  12: { type: 'half', dot: true },
  8: { type: 'half', dot: false },
  6: { type: 'quarter', dot: true },
  4: { type: 'quarter', dot: false },
  2: { type: 'eighth', dot: false },
  1: { type: '16th', dot: false },
};

type HandName = 'right' | 'left';
const STAFF_OF: Readonly<Record<HandName, number>> = { right: 1, left: 2 };
/** Voice ids as the 1.0.0 families write them: the right hand's voice 1, the left hand's voice 5. */
const VOICE_OF: Readonly<Record<HandName, string>> = { right: '1', left: '5' };

/** One thing a hand plays in a section: written events that fill exactly `ticks`. */
interface Segment {
  ticks: number;
  events: WriteEvent[];
}

/** A resolved section: the parts each hand plays once `mirror` has been followed. */
interface ResolvedSection {
  spec: PatternSection;
  key: ExerciseKey;
  right: PatternHandPart;
  left: PatternHandPart;
}

function definitionKeys(definition: ExerciseDefinition): ExerciseKey[] {
  if (!definition.keys) throw new Error(`${definition.family}: this form needs \`keys\``);
  return definition.keys;
}

function definitionSteps(definition: ExerciseDefinition): ExerciseStep[] {
  if (!definition.steps) throw new Error(`${definition.family}: the chords form needs \`steps\``);
  return definition.steps;
}

/** The MIDI number of the scale tonic: octave 4 for tonics C to F, octave 3 from F sharp up (key table, data-model §5). */
/** The scale/chord tonic's MIDI pitch (data-model §5, per-key table). `octaveShift` does not apply to a plain
 *  pattern section (one key throughout - contract exercise-definition 1.1 §3) but a key-change pair's `to` (or
 *  `from`) key may set it to bridge two keys whose table octaves land far apart (contract 1.2 §3): the four
 *  relative pairs sit 3 semitones apart except G major/E minor, which straddle the table's octave-4/3 boundary in
 *  the "wrong" direction (G > E's table octave despite G being the higher letter) and land 9 apart unshifted. */
function tonicMidiOf(key: ExerciseKey): number {
  const info = keyBySlug(keySlug(key));
  if (!info) throw new Error(`${key.tonic} ${key.mode} is not one of the 24 keys of the shelf`);
  return 12 * (info.tonicOctave + 1 + (key.octaveShift ?? 0)) + tonicPitchClass(key);
}

function ticksOfDuration(duration: StepDuration): number {
  return DURATION_TICKS[duration];
}

function resolveSections(
  definition: ExerciseDefinition,
  keyOf: (section: PatternSection) => ExerciseKey,
): ResolvedSection[] {
  const sections = definition.sections;
  if (!sections || sections.length === 0)
    throw new Error(`${definition.family}: the ${definition.form} form needs \`sections\``);
  const resolved: ResolvedSection[] = [];
  sections.forEach((spec, index) => {
    const here = `${definition.family}: section ${index + 1}`;
    if (spec.mirror !== undefined) {
      const source = resolved[spec.mirror];
      if (!Number.isInteger(spec.mirror) || spec.mirror < 0 || spec.mirror >= index || !source) {
        throw new Error(`${here}: \`mirror\` ${spec.mirror} must name an earlier section (mirror)`);
      }
      if (spec.bars !== source.spec.bars) {
        throw new Error(
          `${here}: a mirror has ${spec.bars} bars but section ${spec.mirror + 1} has ${source.spec.bars}`,
        );
      }
      resolved.push({ spec, key: keyOf(spec), right: source.left, left: source.right });
      return;
    }
    if ('mirror' in spec.right || 'mirror' in spec.left) {
      throw new Error(`${here}: a hand part of \`mirror\` needs the section's \`mirror\` index`);
    }
    resolved.push({ spec, key: keyOf(spec), right: spec.right, left: spec.left });
  });
  return resolved;
}

function scaleLabel(section: ResolvedSection): string | undefined {
  for (const part of [section.right, section.left]) {
    if ('scale' in part) return scaleName(section.key, part.scale.form);
  }
  return undefined;
}

function sectionLabel(definition: ExerciseDefinition, section: ResolvedSection, index: number): string | undefined {
  const label = section.spec.label;
  if (label === undefined) return undefined;
  let resolved = label;
  if (resolved.includes('{scale}')) {
    const scale = scaleLabel(section);
    if (scale === undefined) {
      throw new Error(`${definition.family}: section ${index + 1}: the label uses {scale} but no hand plays a scale`);
    }
    resolved = resolved.replaceAll('{scale}', scale);
  }
  // Key-change form (contracts/exercise-definition 1.1 §3): the arrival section names the key it lands on.
  if (resolved.includes('{toKey}')) resolved = resolved.replaceAll('{toKey}', displayKeyName(section.key));
  return resolved;
}

function noteEvent(hand: HandName, pitch: WritePitch, ticks: number, finger: number, chord: boolean): WriteEvent {
  const shape = TICKS_TYPE[ticks];
  if (!shape) throw new Error(`no written value for ${ticks} ticks`);
  return {
    kind: 'note',
    note: {
      pitch,
      duration: ticks,
      voice: VOICE_OF[hand],
      type: shape.type,
      dot: shape.dot,
      staff: STAFF_OF[hand],
      chord,
      fingering: finger,
      tie: { start: false, stop: false },
    },
  };
}

function scaleSegments(section: ResolvedSection, hand: HandName, part: ScalePart, context: string): Segment[] {
  const fingers = scaleFingering(section.key, hand, part.form);
  const tonicMidi = tonicMidiOf(section.key) - (hand === 'left' ? 12 : 0);
  const notes = scaleNotes(section.key, part.form, part.shape, tonicMidi);
  return notes.map((note, i) => {
    assertWithin88Keys(note.midi, `${context} scale note ${i + 1}`);
    const duration = i === notes.length - 1 && part.lastValue !== undefined ? part.lastValue : part.value;
    const ticks = ticksOfDuration(duration);
    return {
      ticks,
      events: [
        noteEvent(
          hand,
          { step: note.step, alter: note.alter, octave: note.octave },
          ticks,
          fingers[note.degree - 1] as number,
          false,
        ),
      ],
    };
  });
}

/** The fixed finger pattern of a voicing over the three fingers of `triadFingering`: broken 1-3-5-3 uses fingers
 *  [0, 1, 2, 1]; root-fifth uses [0, 2]. */
const BROKEN_PATTERN = [0, 1, 2, 1] as const;
const ROOT_FIFTH_PATTERN = [0, 2] as const;

function chordSegments(
  section: ResolvedSection,
  hand: HandName,
  chords: readonly PatternChord[],
  context: string,
): Segment[] {
  const key = section.key;
  const anchor = tonicMidiOf(key) + (hand === 'left' ? -12 : 12);
  return chords.map((written, i) => {
    // a minor key may rename or reshape the chord (I -> i, ii -> iv): the definition says how, once, for all 24 keys
    const entry: PatternChord = key.mode === 'minor' && written.minor ? { ...written, ...written.minor } : written;
    const inversion = entry.inversion ?? 0;
    const voicing = entry.voicing ?? 'triad';
    const here = `${context} chord ${i + 1} (${entry.degree})`;
    if (voicing === 'root-fifth' && inversion !== 0) throw new Error(`${here}: a root-fifth chord is in root position`);
    const ordered = invertOrder(chordTones(key, entry.degree, entry.quality), inversion);
    const first = ordered[0];
    if (!first) throw new Error(`${here}: no chord tones`);
    const notes = placeAscending(ordered, bassInWindow(pitchClassOfTone(first), anchor));
    for (const n of notes) assertWithin88Keys(n.midi, here);
    const fingers = triadFingering(inversion, hand);
    const ticks = ticksOfDuration(entry.duration);
    const words: WriteEvent = {
      kind: 'direction',
      words: entry.label ?? romanFigure(entry.degree, inversion, entry.quality),
      staff: STAFF_OF[hand],
      placement: hand === 'left' ? 'below' : 'above',
    };

    if (voicing === 'triad') {
      return {
        ticks,
        events: [words, ...notes.map((n, k) => noteEvent(hand, toWritePitch(n), ticks, fingers[k] as number, k > 0))],
      };
    }
    const pattern = voicing === 'broken' ? BROKEN_PATTERN : ROOT_FIFTH_PATTERN;
    const each = ticks / pattern.length;
    if (!Number.isInteger(each) || !TICKS_TYPE[each])
      throw new Error(`${here}: ${entry.duration} cannot be split into ${pattern.length} notes`);
    return {
      ticks,
      events: [
        words,
        ...pattern.map((k) => noteEvent(hand, toWritePitch(notes[k] as VoicedNote), each, fingers[k] as number, false)),
      ],
    };
  });
}

function restSegments(hand: HandName, bars: number, barTicks: number): Segment[] {
  return Array.from({ length: bars }, () => ({
    ticks: barTicks,
    events: [
      {
        kind: 'note' as const,
        note: {
          rest: true,
          measureRest: true,
          duration: barTicks,
          voice: VOICE_OF[hand],
          type: 'whole' as const,
          staff: STAFF_OF[hand],
        },
      },
    ],
  }));
}

function handSegments(section: ResolvedSection, hand: HandName, barTicks: number, context: string): Segment[] {
  const part = section[hand];
  let segments: Segment[];
  if ('scale' in part) segments = scaleSegments(section, hand, part.scale, context);
  else if ('chords' in part) segments = chordSegments(section, hand, part.chords, context);
  else if ('rest' in part) segments = restSegments(hand, section.spec.bars, barTicks);
  else throw new Error(`${context}: a mirror part was not resolved`);
  const filled = segments.reduce((sum, s) => sum + s.ticks, 0);
  const wanted = section.spec.bars * barTicks;
  if (filled !== wanted) {
    throw new Error(`${context}: ${hand} hand fills ${filled} of the ${wanted} ticks of ${section.spec.bars} bar(s)`);
  }
  return segments;
}

interface PatternRender {
  title: string;
  definition: ExerciseDefinition;
  sections: ResolvedSection[];
  firstKey: ExerciseKey;
}

/** Lays the hands' segments out bar by bar and writes the completed file. Section barlines, the tempo mark and the words
 *  directions come from the definition. Shared by the pattern and key-change forms. */
function renderPattern(render: PatternRender): string {
  const { definition, sections, firstKey, title } = render;
  const barTicks = measureTicks(definition.metre);
  const streams: Record<HandName, Segment[]> = { right: [], left: [] };
  const sectionEnds: { lastBar: number; barline: BarlineKind }[] = [];
  const sectionStarts = new Map<number, ResolvedSection>();
  let bars = 0;

  sections.forEach((section, index) => {
    const label = sectionLabel(definition, section, index);
    const context = `${definition.family}: section ${index + 1}${label ? ` ("${label}")` : ''}`;
    sectionStarts.set(bars + 1, section);
    for (const hand of ['right', 'left'] as const) {
      const segments = handSegments(section, hand, barTicks, context);
      if (hand === 'right') {
        // the tempo mark and the section label lead the right hand's first segment of the score / section
        const lead: WriteEvent[] = [];
        if (index === 0) {
          lead.push({
            kind: 'direction',
            metronome: { beatUnit: 'quarter', perMinute: definition.tempoBpm },
            tempo: definition.tempoBpm,
            staff: 1,
            placement: 'above',
          });
        }
        if (label !== undefined) lead.push({ kind: 'direction', words: label, staff: 1, placement: 'above' });
        const head = segments[0];
        if (head && lead.length > 0) segments[0] = { ticks: head.ticks, events: [...lead, ...head.events] };
      }
      streams[hand].push(...segments);
    }
    bars += section.spec.bars;
    sectionEnds.push({ lastBar: bars, barline: section.spec.barline ?? 'regular' });
  });

  // Cut each hand's stream into measures; a segment must never straddle a barline.
  const cut = (hand: HandName): WriteEvent[][] => {
    const measures: WriteEvent[][] = [];
    let current: WriteEvent[] = [];
    let used = 0;
    for (const segment of streams[hand]) {
      current.push(...segment.events);
      used += segment.ticks;
      if (used > barTicks) throw new Error(`${definition.family}: a ${hand}-hand note crosses a barline`);
      if (used === barTicks) {
        measures.push(current);
        current = [];
        used = 0;
      }
    }
    if (used !== 0) throw new Error(`${definition.family}: the ${hand} hand ends inside a bar`);
    return measures;
  };
  const right = cut('right');
  const left = cut('left');

  const measures: WriteMeasure[] = [];
  let previousKey: ExerciseKey | undefined;
  for (let bar = 1; bar <= bars; bar++) {
    const section = sectionStarts.get(bar);
    const key = section?.key ?? previousKey ?? firstKey;
    // Key-change form only: previousKey is always firstKey for the pattern form (one key throughout), so this never
    // fires there. fifths (not mode) is what decides a *written* key change - a relative change shares a signature.
    const keyChanged = bar > 1 && previousKey !== undefined && key.fifths !== previousKey.fifths;
    const cancel = keyChanged ? cancelFifths(previousKey?.fifths ?? 0, key.fifths) : undefined;
    const events: WriteEvent[] = [
      ...(keyChanged
        ? [
            {
              kind: 'attributes' as const,
              key: { fifths: key.fifths, mode: key.mode, ...(cancel !== undefined ? { cancel } : {}) },
            },
          ]
        : []),
      ...(right[bar - 1] ?? []),
      { kind: 'backup', duration: barTicks },
      ...(left[bar - 1] ?? []),
    ];
    const attributes: WriteMeasureAttributes | undefined =
      bar === 1
        ? {
            divisions: DIVISIONS,
            key: { fifths: key.fifths, mode: key.mode },
            time: timeOf(definition.metre),
            staves: 2,
            clefs: [
              { number: 1, sign: 'G', line: 2 },
              { number: 2, sign: 'F', line: 4 },
            ],
          }
        : undefined;
    previousKey = key;
    const end = sectionEnds.find((s) => s.lastBar === bar);
    const isLast = bar === bars;
    const barline = isLast ? 'light-heavy' : end && end.barline !== 'regular' ? end.barline : undefined;
    if (barline) events.push({ kind: 'barline', location: 'right', barStyle: barline });
    measures.push({ number: String(bar), ...(attributes ? { attributes } : {}), events });
  }

  return completeXml(
    writeScoreXml({ title, composer: 'Musicanyya practice material', parts: [{ id: 'P1', name: 'Piano', measures }] }),
  );
}

function timeOf(metre: string): { beats: string; beatType: number } {
  const [beats, beatType] = metre.split('/');
  return { beats: beats ?? '4', beatType: Number(beatType ?? 4) };
}

/** Generates the pattern form's items, one per key (contract exercise-definition 1.1): the scale in one hand against the
 *  chords in the other, the hands swapping in mirrored sections, the same shape in every key. */
export function generatePatternFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  if (definition.form !== 'pattern')
    throw new Error(`${definition.family}: generatePatternFamily needs form "pattern"`);
  if (definition.steps !== undefined || definition.keyPairs !== undefined) {
    throw new Error(
      `${definition.family}: the pattern form takes \`keys\` and \`sections\`, not \`steps\` or \`keyPairs\``,
    );
  }
  return definitionKeys(definition).map((key) => {
    const slug = keySlug(key);
    const sections = resolveSections(definition, () => key);
    const title = definition.titleTemplate.replace('{key}', displayKeyName(key));
    const xml = renderPattern({ title, definition, sections, firstKey: key });
    return { ...identityOf(definition, slug), xml, meta: buildMeta(definition, title, generatedOn) };
  });
}

/** MusicXML `<cancel>` (contracts/exercise-definition 1.1 §3): needed when the arriving signature has fewer
 *  accidentals in the same direction as the old one, flips direction, or lands on no sharps/flats at all -
 *  `undefined` when there was nothing to cancel (`oldFifths` 0) or the new signature only adds more. */
function cancelFifths(oldFifths: number, newFifths: number): number | undefined {
  if (oldFifths === 0) return undefined;
  if (newFifths === 0) return oldFifths;
  if (Math.sign(oldFifths) !== Math.sign(newFifths)) return oldFifths;
  return Math.abs(newFifths) < Math.abs(oldFifths) ? oldFifths : undefined;
}

function pairSlug(pair: KeyPair): string {
  return `${keySlug(pair.from)}-to-${keySlug(pair.to)}`;
}

/** Generates the key-change form's items, one per key pair (contract exercise-definition 1.1): each section's chords
 *  are read in `pair.from` or `pair.to` per its `inKey` (the same `.minor` mechanism `chordSegments` already has -
 *  the *pivot* chord degree is the major-key spelling of the shared triad, its `.minor` override the minor-key
 *  spelling of that same triad, resolved by whichever of the pair is actually minor); `renderPattern` (shared with
 *  the pattern form) writes the new `<key>`/`<cancel>` itself once the section's key actually has different fifths,
 *  (no note is tied across the change: a held key cannot change finger, music review 2026-09-26). */
export function generateKeyChangeFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  if (definition.form !== 'key-change')
    throw new Error(`${definition.family}: generateKeyChangeFamily needs form "key-change"`);
  if (definition.keys !== undefined || definition.steps !== undefined) {
    throw new Error(
      `${definition.family}: the key-change form takes \`keyPairs\` and \`sections\`, not \`keys\` or \`steps\``,
    );
  }
  const pairs = definition.keyPairs;
  if (!pairs || pairs.length === 0) throw new Error(`${definition.family}: the key-change form needs \`keyPairs\``);
  return pairs.map((pair) => {
    const slug = pairSlug(pair);
    const sections = resolveSections(definition, (section) => (section.inKey === 'to' ? pair.to : pair.from));
    const title = definition.titleTemplate
      .replace('{from}', displayKeyName(pair.from))
      .replace('{to}', displayKeyName(pair.to));
    const xml = renderPattern({ title, definition, sections, firstKey: pair.from });
    return { ...identityOf(definition, slug), xml, meta: buildMeta(definition, title, generatedOn) };
  });
}

/** The generator for a definition, by its `form` (contract exercise-definition 1.1 §1a): the 1.0.0 families are told apart
 *  by their name as before (`changes-*` are chord-change drills, the rest triad exercises). One dispatch for the build tool
 *  and the tests, so a new form is added in one place. */
export function generateFamily(definition: ExerciseDefinition, generatedOn: string): GeneratedExerciseItem[] {
  if (definition.form === 'pattern') return generatePatternFamily(definition, generatedOn);
  if (definition.form === 'key-change') return generateKeyChangeFamily(definition, generatedOn);
  return definition.family.startsWith('changes')
    ? generateChangeFamily(definition, generatedOn)
    : generateTriadFamily(definition, generatedOn);
}
