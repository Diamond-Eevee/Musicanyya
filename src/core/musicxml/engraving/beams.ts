import { XmlElement, XmlText } from '@rgrove/parse-xml';
import { applyEighthExtensions, beamSpans, type GroupableNote } from './beat-grouping.js';
import type { MeasureContext, NoteType, VoiceEvent } from './walk.js';

export type BeamValue = 'begin' | 'continue' | 'end' | 'forward hook' | 'backward hook';

export interface BeamAssignment {
  number: number;
  value: BeamValue;
}

export interface VoiceBeamResult {
  /** Beam values per completed event, in ascending `number`. Empty when `skipped`. */
  assignments: Map<VoiceEvent, BeamAssignment[]>;
  /** Level-1 (primary) groups formed. */
  groupsAdded: number;
  /** True when this voice already carries a `<beam>` somewhere (B11) - nothing above was completed. */
  skipped: boolean;
  /** Measures where a run of the *existing* encoded beam data is inconsistent (R-2 B12), labelled by the measure
   *  where the run began. Only populated when `skipped` (beamDataInvalid). */
  invalidMeasureLabels: string[];
}

const NOTE_TYPE_ORDER: readonly NoteType[] = [
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
const EIGHTH_INDEX = NOTE_TYPE_ORDER.indexOf('eighth');

function beamCount(type: NoteType): number {
  return NOTE_TYPE_ORDER.indexOf(type) - EIGHTH_INDEX + 1;
}

function isBeamable(e: VoiceEvent): boolean {
  if (e.rest || e.grace || !e.type) return false;
  return NOTE_TYPE_ORDER.indexOf(e.type) >= EIGHTH_INDEX;
}

function getText(el: XmlElement): string {
  const txt = el.children.find((c): c is XmlText => c instanceof XmlText);
  return txt ? txt.text.trim() : '';
}

function encodedBeams(el: XmlElement): Array<{ number: number; value: string }> {
  return el.children
    .filter((c): c is XmlElement => c instanceof XmlElement && c.name === 'beam')
    .map((c) => ({ number: parseInt(c.attributes.number || '1', 10) || 1, value: getText(c) }));
}

/**
 * B12 validity check for a voice that already carries at least one `<beam>` somewhere (so it is skipped by
 * completion). Runs are followed through the whole voice, because a beam may cross a barline: per `number`, a
 * `continue`/`end` needs an open run, a `begin` needs none, a pitched note without a level-1 beam may not sit inside
 * an open level-1 run (rests may - beams can span them), and no run may stay open at the end. Grace notes form their
 * own stream. Hooks are standalone and never open or close a run. Returns the labels of the measures where the bad
 * runs began, in order, without repeats.
 */
function findInvalidMeasures(events: readonly VoiceEvent[]): string[] {
  const invalid: string[] = [];
  const flag = (label: string) => {
    if (!invalid.includes(label)) invalid.push(label);
  };
  const stream = (e: VoiceEvent) => (e.grace ? 'grace' : e.cue ? 'cue' : 'main');

  for (const which of ['main', 'grace', 'cue']) {
    const open = new Map<number, string>(); // beam number -> label of the measure where its run began
    for (const e of events) {
      if (stream(e) !== which) continue;
      const beams = eventBeams(e);
      if (!beams.some((b) => b.number === 1) && !e.rest && open.has(1)) {
        flag(open.get(1) ?? e.measureLabel);
        open.clear();
      }
      for (const b of beams) {
        const began = open.get(b.number);
        if (b.value === 'begin') {
          if (began !== undefined) flag(began);
          open.set(b.number, e.measureLabel);
        } else if (b.value === 'continue') {
          if (began === undefined) flag(e.measureLabel);
        } else if (b.value === 'end') {
          if (began === undefined) flag(e.measureLabel);
          open.delete(b.number);
        }
      }
      // Nesting: once the primary beam ends, no secondary beam may still be open.
      if (!open.has(1)) {
        for (const [number, began] of open) {
          flag(began);
          open.delete(number);
        }
      }
    }
    for (const label of open.values()) flag(label);
  }
  return invalid;
}

/** The encoded beams of an event: the head's, else the first chord member's that has any (B6 - an exporter may write
 *  them on another chord note). */
function eventBeams(e: VoiceEvent): Array<{ number: number; value: string }> {
  const head = encodedBeams(e.noteRef.element);
  if (head.length > 0) return head;
  for (const pitch of e.pitches) {
    const member = encodedBeams(pitch.noteRef.element);
    if (member.length > 0) return member;
  }
  return head;
}

/** B9/B10: beam values for one already-formed group (2+ beamable events, document order). */
function assignBeamValues(group: readonly VoiceEvent[], assignments: Map<VoiceEvent, BeamAssignment[]>, ppq: number) {
  const counts = group.map((e) => (e.type ? beamCount(e.type) : 0));
  const maxLevel = Math.max(...counts);
  const groupStart = group[0]?.onset ?? 0;

  for (let level = 1; level <= maxLevel; level++) {
    const participates = counts.map((c) => c >= level);
    for (let i = 0; i < group.length; i++) {
      if (!participates[i]) continue;
      const event = group[i];
      if (!event) continue;

      const leftOk = i > 0 && (participates[i - 1] ?? false);
      const rightOk = i < group.length - 1 && (participates[i + 1] ?? false);
      let value: BeamValue;
      if (leftOk && rightOk) {
        value = 'continue';
      } else if (leftOk && !rightOk) {
        value = 'end';
      } else if (!leftOk && rightOk) {
        value = 'begin';
      } else if (i === 0) {
        value = 'forward hook';
      } else if (i === group.length - 1) {
        value = 'backward hook';
      } else {
        // Middle note isolated at this level: hook direction follows whether it sits on the
        // level-(L-1) grid (B9).
        const levelMinus1Unit = ppq / 2 ** (level - 1);
        const onGrid = (event.onset - groupStart) % levelMinus1Unit === 0;
        value = onGrid ? 'forward hook' : 'backward hook';
      }

      const arr = assignments.get(event) ?? [];
      arr.push({ number: level, value });
      assignments.set(event, arr);
    }
  }
}

/** B8: runs of consecutive grace events (adjacent in document order) within one measure's events. */
function collectGraceGroups(measureEvents: readonly VoiceEvent[]): VoiceEvent[][] {
  const groups: VoiceEvent[][] = [];
  let current: VoiceEvent[] = [];
  for (const e of measureEvents) {
    if (e.grace) {
      current.push(e);
    } else if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Plans beam completion for one (part, voice) across the whole piece. `events` must already be
 * filtered to exactly one voice, in document order; `measures` is that part's full measures array
 * (indexed by `measureIndex`).
 */
export function planBeamsForVoice(
  events: readonly VoiceEvent[],
  measures: readonly MeasureContext[],
  ppq: number,
  /** B11 in library mode: complete the groups of a partly beamed voice whose notes carry no `<beam>` (FR-001 - a
   *  library file must be fully beamed); an opened file's partly beamed voice is the encoder's choice. */
  completePartlyBeamed = false,
): VoiceBeamResult {
  const partlyBeamed = events.some((e) => e.hasBeam);
  if (partlyBeamed) {
    const invalidMeasureLabels = findInvalidMeasures(events);
    if (!completePartlyBeamed || invalidMeasureLabels.length > 0) {
      return { assignments: new Map(), groupsAdded: 0, skipped: true, invalidMeasureLabels };
    }
  }

  const assignments = new Map<VoiceEvent, BeamAssignment[]>();
  let groupsAdded = 0;

  const byMeasure = new Map<number, VoiceEvent[]>();
  for (const e of events) {
    let list = byMeasure.get(e.measureIndex);
    if (!list) {
      list = [];
      byMeasure.set(e.measureIndex, list);
    }
    list.push(e);
  }

  for (const [measureIndex, measureEvents] of byMeasure) {
    const measure = measures[measureIndex];
    if (!measure) continue;

    for (const group of collectGraceGroups(measureEvents)) {
      if (group.length >= 2 && !group.some((e) => e.hasBeam)) {
        groupsAdded++;
        assignBeamValues(group, assignments, ppq);
      }
    }

    const mainEvents = measureEvents.filter((e) => !e.grace);
    const groupable: GroupableNote[] = mainEvents.map((e) => ({
      onset: e.onset,
      type: e.type,
      dots: e.dots,
      rest: e.rest,
      tuplet: e.tuplet,
    }));
    const baseline = beamSpans(measure.time, measure.lengthDivisions, measure.implicit, ppq);
    const spans = applyEighthExtensions(measure.time, baseline, groupable, ppq);

    for (const span of spans) {
      const inSpan = mainEvents.filter((e) => e.onset >= span.start && e.onset < span.end);
      let current: VoiceEvent[] = [];
      let tupletRatioKey: string | null = null;
      let tupletCountInRun = 0;

      const flush = () => {
        // A group that already carries any encoded beam is left exactly as encoded (partly beamed voices, B11).
        if (current.length >= 2 && !current.some((e) => e.hasBeam)) {
          groupsAdded++;
          assignBeamValues(current, assignments, ppq);
        }
        current = [];
        tupletRatioKey = null;
        tupletCountInRun = 0;
      };

      for (const e of inSpan) {
        if (!isBeamable(e) || e.hasBeam) {
          // B6: a rest (or any non-beamable note) breaks the group; in a partly beamed voice (library mode, B11) so
          // does a note that already carries its own beam - only the loose runs around it are completed.
          flush();
          continue;
        }

        const ratioKey = e.tuplet ? `${e.tuplet.actual}/${e.tuplet.normal}` : null;
        if (ratioKey !== null) {
          // B7: a tuplet span is its own group, "up to actual-notes" long; two same-ratio tuplet
          // spans back to back are never joined into one.
          if (tupletRatioKey !== ratioKey) {
            flush();
            tupletRatioKey = ratioKey;
          }
          current.push(e);
          tupletCountInRun++;
          if (tupletCountInRun >= (e.tuplet?.actual ?? 1)) flush();
        } else {
          if (tupletRatioKey !== null) flush();
          current.push(e);
        }
      }
      flush();
    }
  }

  return { assignments, groupsAdded, skipped: false, invalidMeasureLabels: [] };
}
