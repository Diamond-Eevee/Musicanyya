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
  /** Measures where the *existing* encoded beam data does not close within its own measure. Only
   *  populated when `skipped` (beamDataInvalid). */
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
 * B11 validity check for a voice that already carries at least one `<beam>` somewhere (so it is
 * skipped by completion): does every `begin`/`continue` at a given `number` close with an `end` in
 * the same measure? Hooks are standalone and never open/close a run.
 */
function findInvalidMeasures(events: readonly VoiceEvent[]): string[] {
  const byMeasure = new Map<number, VoiceEvent[]>();
  for (const e of events) {
    let list = byMeasure.get(e.measureIndex);
    if (!list) {
      list = [];
      byMeasure.set(e.measureIndex, list);
    }
    list.push(e);
  }

  const invalid: string[] = [];
  for (const measureEvents of byMeasure.values()) {
    const open = new Set<number>();
    let bad = false;
    let label = measureEvents[0]?.measureLabel ?? '';
    for (const e of measureEvents) {
      for (const b of encodedBeams(e.noteRef.element)) {
        label = e.measureLabel;
        if (b.value === 'begin') {
          open.add(b.number);
        } else if (b.value === 'continue') {
          if (!open.has(b.number)) bad = true;
        } else if (b.value === 'end') {
          if (!open.has(b.number)) bad = true;
          open.delete(b.number);
        }
      }
    }
    if (bad || open.size > 0) invalid.push(label);
  }
  return invalid;
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
): VoiceBeamResult {
  if (events.some((e) => e.hasBeam)) {
    return { assignments: new Map(), groupsAdded: 0, skipped: true, invalidMeasureLabels: findInvalidMeasures(events) };
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
      if (group.length >= 2) {
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
    const spans = applyEighthExtensions(measure.time, baseline, groupable);

    for (const span of spans) {
      const inSpan = mainEvents.filter((e) => e.onset >= span.start && e.onset < span.end);
      let current: VoiceEvent[] = [];
      let tupletRatioKey: string | null = null;
      let tupletCountInRun = 0;

      const flush = () => {
        if (current.length >= 2) {
          groupsAdded++;
          assignBeamValues(current, assignments, ppq);
        }
        current = [];
        tupletRatioKey = null;
        tupletCountInRun = 0;
      };

      for (const e of inSpan) {
        if (!isBeamable(e)) {
          flush(); // B6: a rest (or any non-beamable note) breaks the group
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
