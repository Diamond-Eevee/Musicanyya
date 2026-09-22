import type { XmlDocument, XmlElement as XmlElementType } from '@rgrove/parse-xml';
import { XmlElement, XmlText } from '@rgrove/parse-xml';
import type { LoadReport } from '../score/load-report.js';
import type { Score } from '../score/model.js';
import { audioTimeAtTick } from '../tempo/rate.js';
import type { PlaybackTimeline } from '../timeline/types.js';
import type { ItemFacts } from './types.js';

/** `fifths` (-7..7, clamped) to the major key name at that point in the circle of fifths. */
const MAJOR_KEY_NAMES = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
/** Same index (same `fifths`): the relative minor. */
const MINOR_KEY_NAMES = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'];

function keyName(fifths: number, mode: string): string {
  const clamped = Math.max(-7, Math.min(7, fifths));
  const index = clamped + 7;
  const isMinor = mode === 'minor';
  const name = (isMinor ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES)[index] ?? 'C';
  return `${name} ${isMinor ? 'minor' : 'major'}`;
}

function elementChild(el: XmlElementType, name: string): XmlElementType | undefined {
  return el.children.find((c): c is XmlElementType => c instanceof XmlElement && c.name === name);
}

function textOf(el: XmlElementType | undefined): string {
  if (!el) return '';
  const text = el.children.find((c): c is XmlText => c instanceof XmlText);
  return text ? text.text.trim() : '';
}

interface DocScan {
  keys: { fifths: number; mode: string }[];
  hasTuplets: boolean;
  hasOctaveShift: boolean;
  hasPedal: boolean;
}

/** Walks the whole document once for the handful of facts the Score model does not carry - key
 *  signatures, tuplet/octave-shift/pedal markup - none of which affect playback timing (Principle II),
 *  so `build.ts` never records them. This is the one place `src/core/library` reads XML directly. */
function scanDoc(doc: XmlDocument): DocScan {
  const scan: DocScan = { keys: [], hasTuplets: false, hasOctaveShift: false, hasPedal: false };
  const root = doc.children.find((c): c is XmlElementType => c instanceof XmlElement);
  if (!root) return scan;

  function walk(el: XmlElementType): void {
    if (el.name === 'key') {
      const fifthsText = textOf(elementChild(el, 'fifths'));
      const fifths = fifthsText === '' ? 0 : Number.parseInt(fifthsText, 10);
      const mode = textOf(elementChild(el, 'mode')) || 'major';
      scan.keys.push({ fifths: Number.isFinite(fifths) ? fifths : 0, mode });
    } else if (el.name === 'time-modification') {
      scan.hasTuplets = true;
    } else if (el.name === 'octave-shift') {
      scan.hasOctaveShift = true;
    } else if (el.name === 'pedal') {
      scan.hasPedal = true;
    }
    for (const child of el.children) {
      if (child instanceof XmlElement) walk(child);
    }
  }
  walk(root);
  return scan;
}

export interface FactsInput {
  doc: XmlDocument;
  score: Score;
  timeline: PlaybackTimeline;
  report: LoadReport;
  timelineNotices?: readonly { code: string }[];
}

/** Derives `ItemFacts` (contracts/library-index.md §2) from a parsed Score plus its load report -
 *  display and filtering data only, never a second source of musical truth (data-model.md §3). */
export function deriveFacts(input: FactsInput): ItemFacts {
  const { doc, score, timeline, report } = input;
  const scan = scanDoc(doc);

  const allNotes = score.parts.flatMap((part) => part.notes);
  const pitchedNotes = allNotes.filter((note) => !note.unpitched);

  const measures = score.measures.length;
  const notes = allNotes.length;
  const durationSeconds = audioTimeAtTick(timeline.endTick, timeline.tempo, timeline.ppq, 100);

  const keys: string[] = [];
  for (const { fifths, mode } of scan.keys) {
    const name = keyName(fifths, mode);
    if (keys[keys.length - 1] !== name) keys.push(name);
  }
  if (keys.length === 0) keys.push(keyName(0, 'major'));

  const metres: string[] = [];
  for (const measure of score.measures) {
    if (!measure.time) continue;
    const name = `${measure.time.beats}/${measure.time.beatType}`;
    if (metres[metres.length - 1] !== name) metres.push(name);
  }

  const firstTempo = score.tempoMarks[0];
  const tempoBpm = firstTempo ? firstTempo.qpmNum / firstTempo.qpmDen : null;

  const lowestMidi = pitchedNotes.length > 0 ? Math.min(...pitchedNotes.map((n) => n.soundingKey)) : 0;
  const highestMidi = pitchedNotes.length > 0 ? Math.max(...pitchedNotes.map((n) => n.soundingKey)) : 0;

  // Chords are notes that share a staff and an onset; the widest such group is the largest simultaneous
  // interval "in one hand" the criteria ask for (data-model.md §4, criterion 16).
  const byStaffOnset = new Map<string, number[]>();
  // Distinct voice ids seen per staff, and per-staff onset-tick sets per measure (hand independence).
  const voicesByStaff = new Map<number, Set<string>>();
  const onsetsByStaffMeasure = new Map<string, Set<number>>();
  for (const note of pitchedNotes) {
    const staffKey = `${note.measureIndex}:${note.onsetInMeasure}:${note.staff}`;
    const group = byStaffOnset.get(staffKey) ?? [];
    group.push(note.soundingKey);
    byStaffOnset.set(staffKey, group);

    const voices = voicesByStaff.get(note.staff) ?? new Set<string>();
    voices.add(note.voice);
    voicesByStaff.set(note.staff, voices);

    const onsetKey = `${note.staff}:${note.measureIndex}`;
    const onsets = onsetsByStaffMeasure.get(onsetKey) ?? new Set<number>();
    onsets.add(note.onsetInMeasure);
    onsetsByStaffMeasure.set(onsetKey, onsets);
  }
  let maxSpanSemitones = 0;
  for (const group of byStaffOnset.values()) {
    const span = Math.max(...group) - Math.min(...group);
    if (span > maxSpanSemitones) maxSpanSemitones = span;
  }
  const voicesPerStaff =
    voicesByStaff.size > 0 ? Math.max(...Array.from(voicesByStaff.values()).map((v) => v.size)) : 1;

  const staves = Math.max(1, ...score.parts.map((p) => p.staves));
  let handIndependenceFraction = 0;
  if (staves >= 2) {
    let independentMeasures = 0;
    for (let m = 0; m < measures; m++) {
      const staff1 = onsetsByStaffMeasure.get(`1:${m}`) ?? new Set<number>();
      const staff2 = onsetsByStaffMeasure.get(`2:${m}`) ?? new Set<number>();
      const same = staff1.size === staff2.size && Array.from(staff1).every((t) => staff2.has(t));
      if (!same) independentMeasures++;
    }
    handIndependenceFraction = measures > 0 ? independentMeasures / measures : 0;
  }

  const minDurationTicks = allNotes.length > 0 ? Math.min(...allNotes.map((n) => n.durationTicks)) : timeline.ppq;
  const shortestDivision = minDurationTicks > 0 ? Math.round((timeline.ppq * 4) / minDurationTicks) : 1;

  const totalBeats = timeline.ppq > 0 ? timeline.endTick / timeline.ppq : 0;
  const notesPerBeat = totalBeats > 0 ? notes / totalBeats : 0;

  const accidentals = scan.keys.length > 0 ? Math.max(...scan.keys.map((k) => Math.abs(k.fifths))) : 0;

  const hasTies = allNotes.some((n) => n.tie.start || n.tie.stop);
  const hasGraceNotes = allNotes.some((n) => n.grace !== null);
  const hasRepeats = score.navigation.repeats.length > 0;

  const fingered = allNotes.filter((n) => n.fingerings.length > 0).length;
  const fingeringCoverage = allNotes.length > 0 ? fingered / allNotes.length : 0;

  const notices = [
    ...report.entries.map((e) => e.code),
    ...(input.timelineNotices ?? []).map((n) => n.code),
  ] as string[];

  return {
    measures,
    notes,
    durationSeconds,
    keys,
    metres,
    tempoBpm,
    tempoDefaulted: score.defaultTempoUsed,
    lowestMidi,
    highestMidi,
    maxSpanSemitones,
    staves,
    voicesPerStaff,
    handIndependenceFraction,
    shortestDivision,
    notesPerBeat,
    accidentals,
    hasTies,
    hasTuplets: scan.hasTuplets,
    hasGraceNotes,
    hasOctaveShift: scan.hasOctaveShift,
    hasRepeats,
    hasPedal: scan.hasPedal,
    fingeringCoverage,
    notices,
  };
}
