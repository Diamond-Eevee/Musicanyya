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
  octave: number;
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

const BEAM_BEFORE = ['notations', 'lyric', 'play', 'listen'];
const ACCIDENTAL_AFTER = ['type', 'dot'];
const ACCIDENTAL_BEFORE = [
  'time-modification',
  'stem',
  'notehead',
  'notehead-text',
  'staff',
  'beam',
  'notations',
  'lyric',
  'play',
  'listen',
];

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

/** R-8: the offset to splice new markup into a `<note>` element, given what already exists inside it. */
function insertOffset(note: XmlElement, opts: { after?: string[]; before: string[] }): number {
  if (opts.after) {
    let last: XmlElement | undefined;
    for (const child of note.children) {
      if (child instanceof XmlElement && opts.after.includes(child.name)) last = child;
    }
    if (last && last.end >= 0) return last.end;
  }
  for (const child of note.children) {
    if (child instanceof XmlElement && opts.before.includes(child.name) && child.start >= 0) return child.start;
  }
  // No anchor found: splice right after the last child (equivalent to "before `</note>`" - the
  // gap between the last child and the closing tag is whitespace only, so either position is valid XML).
  const children = note.children;
  const lastChild = children[children.length - 1];
  if (lastChild && lastChild.end >= 0) return lastChild.end;
  return note.end;
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

function parseKeyElement(keyEl: XmlElement): number {
  const fifthsEl = getChild(keyEl, 'fifths');
  if (fifthsEl) {
    const fifths = parseInt(getText(fifthsEl), 10);
    return Number.isFinite(fifths) ? fifths : 0;
  }
  // Non-traditional keys (<key-step>/<key-alter> pairs, no <fifths>): not modelled - treated as
  // no alteration. Rare in practice (research R-3 scope is common-practice key signatures).
  return 0;
}

export function walkScore(doc: XmlDocument): WalkResult {
  const root = doc.children.find((c): c is XmlElement => c instanceof XmlElement);
  if (!root || root.name !== 'score-partwise') {
    return { ppq: 960, parts: [] };
  }

  const divisionsSeen: number[] = [];
  (function gather(el: XmlElement) {
    if (el.name === 'divisions') {
      const d = parseInt(getText(el), 10);
      if (!Number.isNaN(d) && d > 0) divisionsSeen.push(d);
    }
    for (const c of el.children) if (c instanceof XmlElement) gather(c);
  })(root);

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

        // Every leading `<attributes>` block (still at onset 0, before any note/backup/forward) belongs
        // to "the start of the measure"; only a later one is truly mid-bar (R-3 A2).
        if (!startSnapshotTaken && el.name !== 'attributes') {
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
          const isChord = getChild(el, 'chord') !== undefined;
          const isGrace = getChild(el, 'grace') !== undefined;
          const isRest = getChild(el, 'rest') !== undefined;
          const isCue = getChild(el, 'cue') !== undefined;
          const durTxt = getText(getChild(el, 'duration'));
          const ticks = durTxt ? durationToTicks(durTxt, ppq, currentDivisions) : 0;
          const voice = getText(getChild(el, 'voice')) || '1';
          const staff = parseInt(getText(getChild(el, 'staff')), 10) || 1;
          const typeTxt = getText(getChild(el, 'type'));
          const dots = getChildren(el, 'dot').length;
          const timeModEl = getChild(el, 'time-modification');
          const tuplet = timeModEl
            ? {
                actual: parseInt(getText(getChild(timeModEl, 'actual-notes')), 10) || 1,
                normal: parseInt(getText(getChild(timeModEl, 'normal-notes')), 10) || 1,
              }
            : null;
          const hasBeam = getChildren(el, 'beam').length > 0;

          const noteRef: NoteRef = { start: el.start, end: el.end, element: el };
          const beamOffset = insertOffset(el, { before: BEAM_BEFORE });
          const accidentalOffset = insertOffset(el, { after: ACCIDENTAL_AFTER, before: ACCIDENTAL_BEFORE });

          const pitchEl = getChild(el, 'pitch');
          let pitch: WrittenPitch | null = null;
          if (pitchEl && !isRest && !isCue) {
            const step = getText(getChild(pitchEl, 'step'));
            const alterTxt = getText(getChild(pitchEl, 'alter'));
            const alterRaw = alterTxt ? parseFloat(alterTxt) : 0;
            const octave = parseInt(getText(getChild(pitchEl, 'octave')), 10) || 4;
            const hasAccidental = getChild(el, 'accidental') !== undefined;
            let tieStop = false;
            for (const t of getChildren(el, 'tie')) {
              if (getAttr(t, 'type') === 'stop') tieStop = true;
            }
            pitch = {
              step,
              alter: Math.round(alterRaw),
              fractionalAlter: Number.isFinite(alterRaw) && alterRaw !== Math.round(alterRaw),
              octave,
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

    parts.push({ index: partIndex, measures, events });
  });

  return { ppq, parts };
}
