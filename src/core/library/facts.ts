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
  hasNonSimpleTuplet: boolean;
  hasOctaveShift: boolean;
  hasPedal: boolean;
  /** Count of explicit `<accidental>` markup - accidentals outside the key signature (data-model.md
   *  §4 criterion 11). `<key-accidental>` (inside `<key>` itself) is a different element name, so
   *  this never double-counts a key signature. */
  accidentalMarkCount: number;
}

/** Walks the whole document once for the handful of facts the Score model does not carry - key
 *  signatures, tuplet/octave-shift/pedal markup - none of which affect playback timing (Principle II),
 *  so `build.ts` never records them. This is the one place `src/core/library` reads XML directly. */
function scanDoc(doc: XmlDocument): DocScan {
  const scan: DocScan = {
    keys: [],
    hasTuplets: false,
    hasNonSimpleTuplet: false,
    hasOctaveShift: false,
    hasPedal: false,
    accidentalMarkCount: 0,
  };
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
      const actual = Number.parseInt(textOf(elementChild(el, 'actual-notes')), 10);
      const normal = Number.parseInt(textOf(elementChild(el, 'normal-notes')), 10);
      if (Number.isFinite(actual) && Number.isFinite(normal) && !(actual === 3 && normal === 2)) {
        scan.hasNonSimpleTuplet = true;
      }
    } else if (el.name === 'octave-shift') {
      scan.hasOctaveShift = true;
    } else if (el.name === 'pedal') {
      scan.hasPedal = true;
    } else if (el.name === 'accidental') {
      scan.accidentalMarkCount++;
    }
    for (const child of el.children) {
      if (child instanceof XmlElement) walk(child);
    }
  }
  walk(root);
  return scan;
}

/** Consecutive onsets, one staff at a time, in tick order - the unit `maxLeapSemitones` and
 *  `longestRunAtShortestValue` (data-model.md §4 criteria 6, 17) are computed over. Grace notes are
 *  excluded, same reasoning as `shortestDivision` above: they are ornamental, not part of the
 *  written rhythm or melodic line a leap is measured against. */
interface OnsetGroup {
  tick: number;
  measureIndex: number;
  pitches: number[];
  durationTicks: number;
}

function onsetGroupsByStaff(
  notes: readonly import('../score/model.js').Note[],
  measureStart: Map<number, number>,
): Map<number, OnsetGroup[]> {
  const byKey = new Map<string, OnsetGroup>();
  const byStaff = new Map<number, OnsetGroup[]>();
  for (const note of notes) {
    if (note.grace !== null) continue;
    const tick = (measureStart.get(note.measureIndex) ?? 0) + note.onsetInMeasure;
    const key = `${note.staff}:${tick}`;
    let group = byKey.get(key);
    if (!group) {
      group = { tick, measureIndex: note.measureIndex, pitches: [], durationTicks: note.durationTicks };
      byKey.set(key, group);
      const list = byStaff.get(note.staff) ?? [];
      list.push(group);
      byStaff.set(note.staff, list);
    }
    group.pitches.push(note.soundingKey);
    group.durationTicks = Math.min(group.durationTicks, note.durationTicks);
  }
  for (const list of byStaff.values()) list.sort((a, b) => a.tick - b.tick);
  return byStaff;
}

/** Longest chain of tied notes sharing a pitch within one staff+voice, and the most barlines any one
 *  chain crosses (data-model.md §4 criterion 20). A chain's length starts at 2 (the first tie-stop
 *  that matches an open tie-start) - an untied note never appears here. */
function tieChains(
  notes: readonly import('../score/model.js').Note[],
  measureStart: Map<number, number>,
): { maxChainNotes: number; maxBarlinesCrossed: number } {
  const perVoice = new Map<string, { note: import('../score/model.js').Note; tick: number }[]>();
  for (const note of notes) {
    if (note.grace !== null) continue;
    const tick = (measureStart.get(note.measureIndex) ?? 0) + note.onsetInMeasure;
    const key = `${note.staff}:${note.voice}`;
    const list = perVoice.get(key) ?? [];
    list.push({ note, tick });
    perVoice.set(key, list);
  }

  let maxChainNotes = 0;
  let maxBarlinesCrossed = 0;
  for (const list of perVoice.values()) {
    list.sort((a, b) => a.tick - b.tick);
    const open = new Map<number, { length: number; startMeasure: number }>();
    let i = 0;
    while (i < list.length) {
      const tick = list[i]?.tick;
      const group: { note: import('../score/model.js').Note; tick: number }[] = [];
      while (i < list.length && list[i]?.tick === tick) {
        const entry = list[i];
        if (entry) group.push(entry);
        i++;
      }
      const continued = new Set<number>();
      for (const { note } of group) {
        const chain = open.get(note.soundingKey);
        if (note.tie.stop && chain) {
          chain.length++;
          maxChainNotes = Math.max(maxChainNotes, chain.length);
          maxBarlinesCrossed = Math.max(maxBarlinesCrossed, note.measureIndex - chain.startMeasure);
          if (note.tie.start) continued.add(note.soundingKey);
          else open.delete(note.soundingKey);
        } else if (note.tie.start) {
          open.set(note.soundingKey, { length: 1, startMeasure: note.measureIndex });
          continued.add(note.soundingKey);
        }
      }
      for (const key of Array.from(open.keys())) {
        if (!continued.has(key)) open.delete(key);
      }
    }
  }
  return { maxChainNotes, maxBarlinesCrossed };
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
      // Both hands must be rhythmically *active* (more than one onset) for a differing pattern to be
      // a coordination challenge - a melody over one held chord differs in onset count on every
      // measure but needs no ongoing coordination once the chord is pressed, so it does not count
      // (data-model.md §4 correction C, found generating the Ode to Joy / triad exercise content).
      if (staff1.size < 2 || staff2.size < 2) continue;
      const same = staff1.size === staff2.size && Array.from(staff1).every((t) => staff2.has(t));
      if (!same) independentMeasures++;
    }
    handIndependenceFraction = measures > 0 ? independentMeasures / measures : 0;
  }

  // Grace notes carry durationTicks 0 (their timing "steals" from a neighbour rather than occupying the
  // timeline themselves) and would otherwise make every graced piece look like it has no rhythm at all;
  // the shortest *notated* value is what data-model.md §4 criterion 5 means, so they are excluded here.
  const notatedDurations = allNotes.filter((n) => n.grace === null).map((n) => n.durationTicks);
  const minDurationTicks = notatedDurations.length > 0 ? Math.min(...notatedDurations) : timeline.ppq;
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

  const measureStart = new Map<number, number>();
  for (const m of score.measures) measureStart.set(m.index, m.startTick);

  const parts = score.parts.length;

  let tempoChanges = 0;
  let prevQpm: number | null = null;
  for (const mark of score.tempoMarks) {
    const qpm = mark.qpmNum / mark.qpmDen;
    if (prevQpm !== null && qpm !== prevQpm) tempoChanges++;
    prevQpm = qpm;
  }

  const groupsByStaff = onsetGroupsByStaff(pitchedNotes, measureStart);
  let maxLeapSemitones = 0;
  let longestRunAtShortestValue = 0;
  // A run only matters when the shortest value is actually fast (data-model.md §4 correction C): a
  // piece written entirely in half notes has every onset "at the shortest value" by definition, which
  // is not what criterion 6 means to catch (a chord exercise's 14 consecutive half-note chords are not
  // a technical run). `4` is the quarter note in `shortestDivision`'s "1 = whole ... " encoding.
  const runsMatter = shortestDivision > 4;
  for (const list of groupsByStaff.values()) {
    let run = 0;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (!g) continue;
      if (runsMatter && g.durationTicks === minDurationTicks) {
        run++;
        longestRunAtShortestValue = Math.max(longestRunAtShortestValue, run);
      } else {
        run = 0;
      }
      if (i > 0) {
        const prev = list[i - 1];
        if (prev) {
          const leap = Math.abs(Math.max(...g.pitches) - Math.max(...prev.pitches));
          maxLeapSemitones = Math.max(maxLeapSemitones, leap);
        }
      }
    }
  }

  // Peak note-attack rate: every pitched, non-grace onset (chords count once per onset, not per
  // pitch - a chord is one attack), in a sliding 2-second window (data-model.md §4 criteria 18, 19).
  const onsetTimes: number[] = [];
  for (const list of groupsByStaff.values()) {
    for (const g of list) onsetTimes.push(audioTimeAtTick(g.tick, timeline.tempo, timeline.ppq, 100));
  }
  onsetTimes.sort((a, b) => a - b);
  const attackCount = onsetTimes.length;
  let peakCountIn2s = 0;
  let left = 0;
  for (let right = 0; right < onsetTimes.length; right++) {
    const rightTime = onsetTimes[right];
    if (rightTime === undefined) continue;
    while (left < right) {
      const leftTime = onsetTimes[left];
      if (leftTime === undefined || rightTime - leftTime <= 2) break;
      left++;
    }
    peakCountIn2s = Math.max(peakCountIn2s, right - left + 1);
  }
  const peakNotesPerSecond = peakCountIn2s / 2;

  const { maxChainNotes: maxTieChainNotes, maxBarlinesCrossed: maxTieBarlinesCrossed } = tieChains(
    pitchedNotes,
    measureStart,
  );

  const graceNoteCount = allNotes.filter((n) => n.grace !== null).length;
  const ornamentCount = allNotes.filter((n) => n.ornament !== null).length;

  const backwardRepeatCount = score.navigation.repeats.filter((r) => r.direction === 'backward').length;
  const repeatKind: 'none' | 'simple' | 'voltas' | 'jumps' =
    score.navigation.jumps.length > 0
      ? 'jumps'
      : score.navigation.endings.length > 0
        ? 'voltas'
        : backwardRepeatCount > 0
          ? 'simple'
          : 'none';

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
    parts,
    tempoChanges,
    maxLeapSemitones,
    longestRunAtShortestValue,
    attackCount,
    peakNotesPerSecond,
    accidentalMarkCount: scan.accidentalMarkCount,
    maxTieChainNotes,
    maxTieBarlinesCrossed,
    hasNonSimpleTuplet: scan.hasNonSimpleTuplet,
    graceNoteCount,
    ornamentCount,
    repeatKind,
    backwardRepeatCount,
  };
}
