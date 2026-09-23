import type { XmlDocument } from '@rgrove/parse-xml';
import { XmlElement, XmlText } from '@rgrove/parse-xml';
import { computePPQ } from '../../ticks.js';

export type NoteType =
  | 'maxima'
  | 'long'
  | 'breve'
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | '16th'
  | '32nd'
  | '64th'
  | '128th'
  | '256th'
  | '512th'
  | '1024th';

export interface NoteRef {
  /** Offset of the owning `<note>` element's `<`, for source-position debugging only. */
  start: number;
  /** Offset right after the owning `<note>` element's closing `>` (`XmlElement.end`). */
  end: number;
  element: XmlElement;
}

export interface WrittenPitch {
  step: string;
  /** Rounded to the nearest integer; fractional (microtonal) alter is flagged via `fractionalAlter`. */
  alter: number;
  fractionalAlter: boolean;
  /** The sounding octave, as `<pitch>` encodes it. */
  octave: number;
  /** The octave of the staff line the note is printed on: `octave` minus any `<octave-shift>` in force (an 8va
   *  passage encodes sounding pitch one octave above the printed line). Accidentals follow this (R-3 A1, A6). */
  printedOctave: number;
  /** This note's own printed staff; a chord member may sit on another staff than its head. */
  staff: number;
  /** `print-object="no"`: a playback-only note the reader never sees - it needs no sign and sets no state. */
  hidden: boolean;
  hasAccidental: boolean;
  tieStop: boolean;
  noteRef: NoteRef;
}

export interface TupletInfo {
  actual: number;
  normal: number;
}

export interface InsertAt {
  /** One offset per `pitches[i]`, into that pitch's own `<note>` element (R-8). */
  accidental: number[];
  /** Offset for a `<beam>` insert on the event's own (head) `<note>` element (R-8). */
  beam: number;
}

export interface VoiceEvent {
  part: number;
  measureIndex: number;
  measureLabel: string;
  staff: number;
  voice: string;
  /** Position within the measure, in this walk's common tick unit (`WalkResult.ppq`), after `<backup>`/`<forward>`. */
  onset: number;
  /** 0 for grace notes and chord members (the event carries the head's duration). */
  duration: number;
  type: NoteType | null;
  dots: number;
  rest: boolean;
  grace: boolean;
  /** A cue-sized note (`<cue/>`): not played, and beamed as its own stream. */
  cue: boolean;
  /** True if this event has at least one chord member beyond the head. */
  chord: boolean;
  tuplet: TupletInfo | null;
  /** Head pitch first, then chord members in document order; empty for rests and unpitched notes. */
  pitches: WrittenPitch[];
  hasBeam: boolean;
  insertAt: InsertAt;
  /** The head `<note>` element (for beam insertion and as an anchor for other passes). */
  noteRef: NoteRef;
}

export interface MidBarChange {
  /** Onset within the measure (common tick unit) where this change takes effect. */
  onset: number;
  keyByStaff?: Map<number, number>;
  time?: { beats: number[]; beatType: number } | null;
}

export interface MeasureContext {
  divisions: number;
  time: { beats: number[]; beatType: number } | null;
  implicit: boolean;
  /** Actual notated length of this measure, in the common tick unit. */
  lengthDivisions: number;
  /** Key signature alteration (fifths) in force per printed staff at the *start* of the measure; `0` is the default for a staff with no explicit entry. */
  keyByStaff: Map<number, number>;
  /** Further key/time changes after measure start, in onset order (R-3 A2 mid-bar key reset). */
  midBarChanges: MidBarChange[];
  /** Numbered endings (`<ending type="start">`) that begin at this measure's barline (R-3 C1's
   *  first/second-ending courtesy-memory special case), e.g. `[1]` or `[2, 3]`. */
  endingStarts: number[];
}

export interface PartWalk {
  index: number;
  measures: MeasureContext[];
  events: VoiceEvent[];
}

export interface WalkResult {
  /** Common tick unit onset/duration/lengthDivisions are expressed in (research R-2 B1: a `<divisions>`
   *  change mid-piece must be harmless - normalizing every part to one document-wide PPQ, the same
   *  technique `buildScore` uses for the Score's own ticks, makes every position directly comparable
   *  regardless of where or how often `<divisions>` changes). */
  ppq: number;
  parts: PartWalk[];
}

function getChild(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}
function getChildren(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name);
}
function getText(el: XmlElement | undefined): string {
  if (!el) return '';
  const txt = el.children.find((c): c is XmlText => c instanceof XmlText);
  return txt ? txt.text.trim() : '';
}
function getAttr(el: XmlElement, name: string): string | undefined {
  return el.attributes[name];
}

const NOTE_TYPES: readonly string[] = [
  'maxima',
  'long',
  'breve',
  'whole',
  'half',
  'quarter',
  'eighth',
  '16th',
  '32nd',
  '64th',
  '128th',
  '256th',
  '512th',
  '1024th',
];

function isNoteType(txt: string): txt is NoteType {
  return NOTE_TYPES.includes(txt);
}

/** Ticks in this walk's common `ppq`, mirroring `buildScore`'s `durationToTicks` (never NaN/negative). */
function durationToTicks(durTxt: string, ppq: number, divisions: number): number {
  const ticks = Math.round(parseFloat(durTxt) * (ppq / divisions));
  return Number.isFinite(ticks) && ticks >= 0 ? ticks : 0;
}

/** A key whose alterations are not modelled: completion adds no required signs on a staff while it is in force. */
export const NON_TRADITIONAL_KEY = Number.NaN;

function parseKeyElement(keyEl: XmlElement): number {
  const fifthsEl = getChild(keyEl, 'fifths');
  if (fifthsEl) {
    const fifths = parseInt(getText(fifthsEl), 10);
    return Number.isFinite(fifths) ? fifths : 0;
  }
  // Non-traditional keys (<key-step>/<key-alter> pairs, no <fifths>): reading them as C major would add a false sign
  // to every note the key alters, so they are marked unknown instead (research R-3 A2).
  return getChild(keyEl, 'key-step') ? NON_TRADITIONAL_KEY : 0;
}

/** An `<octave-shift>` start or stop on one staff, at a position in the part (R-3 A6). */
interface OctaveShiftChange {
  staff: number;
  /** The shift's `number` attribute: overlapping shifts on one staff are told apart by it. */
  number: string;
  measureIndex: number;
  onset: number;
  /** Document offset of the `<direction>`: at the same position, it applies to the notes written after it. */
  docOffset: number;
  /** Octaves the printed line lies above (+) or below (-) the sounding pitch while this shift is in force. */
  printedMinusSounding: number;
}

/** `<octave-shift type="down" size="8">` is 8va: notes print an octave below their sounding pitch. Size 15 is two
 *  octaves, 22 three; `stop` (and `continue`) end or keep the shift. */
function octaveShiftDelta(el: XmlElement): number | null {
  const type = getAttr(el, 'type');
  if (type === 'stop') return 0;
  if (type !== 'up' && type !== 'down') return null; // `continue` keeps the shift already in force
  const size = parseInt(getAttr(el, 'size') ?? '8', 10) || 8;
  const octaves = Math.max(1, Math.round((size - 1) / 7));
  return type === 'down' ? -octaves : octaves;
}

/** The printed octave of every pitch: the shifts on its own staff in force at its position (a start applies from its
 *  position, a stop from its position on; at an equal position, document order decides). */
function applyOctaveShifts(events: VoiceEvent[], changes: OctaveShiftChange[]): void {
  if (changes.length === 0) return;
  const byStaff = new Map<number, OctaveShiftChange[]>();
  for (const change of changes) {
    const list = byStaff.get(change.staff) ?? [];
    list.push(change);
    byStaff.set(change.staff, list);
  }
  for (const list of byStaff.values()) {
    list.sort((a, b) => a.measureIndex - b.measureIndex || a.onset - b.onset || a.docOffset - b.docOffset);
  }
  for (const event of events) {
    for (const pitch of event.pitches) {
      const list = byStaff.get(pitch.staff);
      if (!list) continue;
      const active = new Map<string, number>();
      for (const change of list) {
        const before =
          change.measureIndex < event.measureIndex ||
          (change.measureIndex === event.measureIndex &&
            (change.onset < event.onset || (change.onset === event.onset && change.docOffset < pitch.noteRef.start)));
        if (!before) break;
        active.set(change.number, change.printedMinusSounding);
      }
      let delta = 0;
      for (const d of active.values()) delta += d;
      pitch.printedOctave = pitch.octave + delta;
    }
  }
}

export function walkScore(doc: XmlDocument): WalkResult {
  const root = doc.children.find((c): c is XmlElement => c instanceof XmlElement);
  if (root?.name !== 'score-partwise') {
    return { ppq: 960, parts: [] };
  }

  const divisionsSeen: number[] = [];
  for (const part of root.children) {
    if (part instanceof XmlElement && part.name === 'part') {
      for (const measure of part.children) {
        if (measure instanceof XmlElement && measure.name === 'measure') {
          for (const el of measure.children) {
            if (el instanceof XmlElement && el.name === 'attributes') {
              for (const attr of el.children) {
                if (attr instanceof XmlElement && attr.name === 'divisions') {
                  const d = parseInt(getText(attr), 10);
                  if (!Number.isNaN(d) && d > 0) divisionsSeen.push(d);
                }
              }
            }
          }
        }
      }
    }
  }

  let ppq = 960;
  try {
    if (divisionsSeen.length > 0) ppq = computePPQ(divisionsSeen);
  } catch {
    ppq = 960;
  }

  const partNodes = getChildren(root, 'part');
  const parts: PartWalk[] = [];

  partNodes.forEach((partNode, partIndex) => {
    const measures: MeasureContext[] = [];
    const events: VoiceEvent[] = [];
    const octaveShifts: OctaveShiftChange[] = [];

    let currentDivisions = 1;
    let cursor = 0;
    let measureIndex = -1;
    const keyByStaff = new Map<number, number>();
    let currentTime: { beats: number[]; beatType: number } | null = null;

    let lastEventKey: string | null = null; // `${voice}` of the last pushed event, for chord folding

    for (const measureNode of getChildren(partNode, 'measure')) {
      measureIndex++;
      const measureLabel = getAttr(measureNode, 'number') || `${measureIndex}`;
      const implicit = getAttr(measureNode, 'implicit') === 'yes';
      const measureStartCursor = cursor;
      let measureMaxCursor = cursor;
      lastEventKey = null;

      let keyByStaffAtStart = new Map(keyByStaff);
      let timeAtStart = currentTime;
      let startSnapshotTaken = false;
      const midBarChanges: MidBarChange[] = [];
      const endingStarts: number[] = [];

      for (const el of measureNode.children) {
        if (!(el instanceof XmlElement)) continue;

        // Everything before the first note/backup/forward belongs to "the start of the measure" - including an
        // `<attributes>` that follows `<print>`, `<barline location="left">` or a `<direction>`, as MuseScore
        // writes a key change at a system break; only a later one is truly mid-bar (R-3 A2).
        if (!startSnapshotTaken && (el.name === 'note' || el.name === 'backup' || el.name === 'forward')) {
          keyByStaffAtStart = new Map(keyByStaff);
          timeAtStart = currentTime;
          startSnapshotTaken = true;
        }

        if (el.name === 'attributes') {
          const divEl = getChild(el, 'divisions');
          if (divEl) {
            const d = parseInt(getText(divEl), 10);
            if (!Number.isNaN(d) && d > 0) currentDivisions = d;
          }

          let keyChanged = false;
          for (const keyEl of getChildren(el, 'key')) {
            const numberAttr = getAttr(keyEl, 'number');
            const fifths = parseKeyElement(keyEl);
            if (numberAttr) {
              keyByStaff.set(parseInt(numberAttr, 10), fifths);
            } else {
              keyByStaff.clear();
              keyByStaff.set(0, fifths);
            }
            keyChanged = true;
          }

          let timeChanged = false;
          const timeEl = getChild(el, 'time');
          if (timeEl) {
            if (getChild(timeEl, 'senza-misura')) {
              currentTime = null;
            } else {
              const beatsTxt = getText(getChild(timeEl, 'beats')) || '4';
              const beats = beatsTxt
                .split('+')
                .map((b) => parseInt(b, 10))
                .filter((n) => !Number.isNaN(n));
              const beatType = parseInt(getText(getChild(timeEl, 'beat-type')), 10) || 4;
              currentTime = { beats: beats.length > 0 ? beats : [4], beatType };
            }
            timeChanged = true;
          }

          const onsetHere = cursor - measureStartCursor;
          if (onsetHere > 0 && (keyChanged || timeChanged)) {
            midBarChanges.push({
              onset: onsetHere,
              ...(keyChanged ? { keyByStaff: new Map(keyByStaff) } : {}),
              ...(timeChanged ? { time: currentTime } : {}),
            });
          } else if (startSnapshotTaken && (keyChanged || timeChanged)) {
            // Back at onset 0 after a <backup> (another voice's stream): still the start of the bar.
            if (keyChanged) keyByStaffAtStart = new Map(keyByStaff);
            if (timeChanged) timeAtStart = currentTime;
          }
        } else if (el.name === 'direction') {
          const staff = parseInt(getText(getChild(el, 'staff')), 10) || 1;
          const offsetTxt = getText(getChild(el, 'offset'));
          const offset = offsetTxt ? Math.round(parseFloat(offsetTxt) * (ppq / currentDivisions)) : 0;
          const onset = Math.max(0, cursor - measureStartCursor + (Number.isFinite(offset) ? offset : 0));
          for (const typeEl of getChildren(el, 'direction-type')) {
            for (const shiftEl of getChildren(typeEl, 'octave-shift')) {
              const delta = octaveShiftDelta(shiftEl);
              if (delta === null) continue;
              octaveShifts.push({
                staff,
                number: getAttr(shiftEl, 'number') ?? '1',
                measureIndex,
                onset,
                docOffset: el.start,
                printedMinusSounding: delta,
              });
            }
          }
        } else if (el.name === 'barline') {
          for (const endingEl of getChildren(el, 'ending')) {
            if (getAttr(endingEl, 'type') !== 'start') continue;
            const numbers = (getAttr(endingEl, 'number') || '')
              .split(/[,.-]/)
              .map((n) => parseInt(n, 10))
              .filter((n) => !Number.isNaN(n));
            endingStarts.push(...numbers);
          }
        } else if (el.name === 'backup') {
          const durTxt = getText(getChild(el, 'duration'));
          if (durTxt) {
            const backed = cursor - durationToTicks(durTxt, ppq, currentDivisions);
            cursor = Math.max(backed, measureStartCursor);
          }
        } else if (el.name === 'forward') {
          const durTxt = getText(getChild(el, 'duration'));
          if (durTxt) {
            cursor += durationToTicks(durTxt, ppq, currentDivisions);
            measureMaxCursor = Math.max(measureMaxCursor, cursor);
          }
        } else if (el.name === 'note') {
          let isChord = false;
          let isGrace = false;
          let isRest = false;
          let isCue = false;
          let durTxt = '';
          let voice = '1';
          let staffTxt = '';
          let typeTxt = '';
          let dots = 0;
          let timeModEl: XmlElement | undefined;
          let hasBeam = false;
          let pitchEl: XmlElement | undefined;
          let hasAccidental = false;
          let tieStop = false;

          let beamOffset = -1;
          let accidentalOffsetBefore = -1;
          let accidentalOffsetAfter = -1;

          for (const c of el.children) {
            if (c instanceof XmlElement) {
              if (
                beamOffset === -1 &&
                (c.name === 'notations' || c.name === 'lyric' || c.name === 'play' || c.name === 'listen')
              ) {
                if (c.start >= 0) beamOffset = c.start;
              }
              if (
                accidentalOffsetBefore === -1 &&
                (c.name === 'time-modification' ||
                  c.name === 'stem' ||
                  c.name === 'notehead' ||
                  c.name === 'notehead-text' ||
                  c.name === 'staff' ||
                  c.name === 'beam' ||
                  c.name === 'notations' ||
                  c.name === 'lyric' ||
                  c.name === 'play' ||
                  c.name === 'listen')
              ) {
                if (c.start >= 0) accidentalOffsetBefore = c.start;
              }
              if (c.name === 'type' || c.name === 'dot') {
                if (c.end >= 0) accidentalOffsetAfter = c.end;
              }

              switch (c.name) {
                case 'chord':
                  isChord = true;
                  break;
                case 'grace':
                  isGrace = true;
                  break;
                case 'rest':
                  isRest = true;
                  break;
                case 'cue':
                  isCue = true;
                  break;
                case 'duration':
                  durTxt = getText(c);
                  break;
                case 'voice':
                  voice = getText(c) || '1';
                  break;
                case 'staff':
                  staffTxt = getText(c);
                  break;
                case 'type':
                  typeTxt = getText(c);
                  break;
                case 'dot':
                  dots++;
                  break;
                case 'time-modification':
                  timeModEl = c;
                  break;
                case 'beam':
                  hasBeam = true;
                  break;
                case 'pitch':
                  pitchEl = c;
                  break;
                case 'accidental':
                  hasAccidental = true;
                  break;
                case 'tie':
                  if (getAttr(c, 'type') === 'stop') tieStop = true;
                  break;
                case 'notations':
                  // Some exporters write the tie only as notation (`<tied>`), without a `<tie>`.
                  for (const tied of getChildren(c, 'tied')) {
                    const tiedType = getAttr(tied, 'type');
                    if (tiedType === 'stop' || tiedType === 'continue') tieStop = true;
                  }
                  break;
              }
            }
          }

          const staff = parseInt(staffTxt, 10) || 1;
          const ticks = durTxt ? durationToTicks(durTxt, ppq, currentDivisions) : 0;
          const tuplet = timeModEl
            ? {
                actual: parseInt(getText(getChild(timeModEl, 'actual-notes')), 10) || 1,
                normal: parseInt(getText(getChild(timeModEl, 'normal-notes')), 10) || 1,
              }
            : null;

          const noteRef: NoteRef = { start: el.start, end: el.end, element: el };

          if (beamOffset === -1) {
            const lastC = el.children[el.children.length - 1];
            beamOffset = lastC && lastC.end >= 0 ? lastC.end : el.end;
          }
          let accidentalOffset = -1;
          if (accidentalOffsetAfter !== -1) accidentalOffset = accidentalOffsetAfter;
          else if (accidentalOffsetBefore !== -1) accidentalOffset = accidentalOffsetBefore;
          else {
            const lastC = el.children[el.children.length - 1];
            accidentalOffset = lastC && lastC.end >= 0 ? lastC.end : el.end;
          }

          let pitch: WrittenPitch | null = null;
          if (pitchEl && !isRest && !isCue) {
            let step = '';
            let alterTxt = '';
            let octaveTxt = '';
            for (const c of pitchEl.children) {
              if (c instanceof XmlElement) {
                switch (c.name) {
                  case 'step':
                    step = getText(c);
                    break;
                  case 'alter':
                    alterTxt = getText(c);
                    break;
                  case 'octave':
                    octaveTxt = getText(c);
                    break;
                }
              }
            }
            const alterRaw = alterTxt ? parseFloat(alterTxt) : 0;
            const octave = parseInt(octaveTxt, 10) || 4;
            pitch = {
              step,
              alter: Math.round(alterRaw),
              fractionalAlter: Number.isFinite(alterRaw) && alterRaw !== Math.round(alterRaw),
              octave,
              printedOctave: octave,
              staff,
              hidden: getAttr(el, 'print-object') === 'no',
              hasAccidental,
              tieStop,
              noteRef,
            };
          }

          const onset = cursor - measureStartCursor;

          if (!isChord && !isGrace) {
            cursor += ticks;
            measureMaxCursor = Math.max(measureMaxCursor, cursor);
          }

          const eventKey = `${voice}`;
          if (isChord && lastEventKey === eventKey && events.length > 0) {
            const prev = events[events.length - 1];
            if (prev) {
              prev.chord = true;
              prev.hasBeam = prev.hasBeam || hasBeam; // B6: a <beam> on any chord member counts as encoded
              if (pitch) {
                prev.pitches.push(pitch);
                prev.insertAt.accidental.push(accidentalOffset);
              }
            }
          } else {
            events.push({
              part: partIndex,
              measureIndex,
              measureLabel,
              staff,
              voice,
              onset,
              duration: isGrace ? 0 : ticks,
              type: isNoteType(typeTxt) ? typeTxt : null,
              dots,
              rest: isRest,
              grace: isGrace,
              cue: isCue,
              chord: false,
              tuplet,
              pitches: pitch ? [pitch] : [],
              hasBeam,
              insertAt: { accidental: pitch ? [accidentalOffset] : [], beam: beamOffset },
              noteRef,
            });
            lastEventKey = eventKey;
          }
        }
      }

      // A measure with only `<attributes>` (no note/backup/forward at all) never took the "start"
      // snapshot above; there is nothing to distinguish start-of-measure from end-of-measure in that
      // case, so fall back to the final state instead of the stale pre-measure one.
      if (!startSnapshotTaken) {
        keyByStaffAtStart = new Map(keyByStaff);
        timeAtStart = currentTime;
      }

      measures.push({
        divisions: currentDivisions,
        time: timeAtStart,
        implicit,
        lengthDivisions: measureMaxCursor - measureStartCursor,
        keyByStaff: keyByStaffAtStart,
        midBarChanges,
        endingStarts,
      });

      cursor = measureMaxCursor;
    }

    applyOctaveShifts(events, octaveShifts);
    parts.push({ index: partIndex, measures, events });
  });

  return { ppq, parts };
}
