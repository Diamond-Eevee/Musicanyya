import { XmlElement, XmlText } from '@rgrove/parse-xml';
import type { EngravingMode } from './index.js';
import type { PartWalk, VoiceEvent } from './walk.js';

export type AccidentalSign = 'sharp' | 'flat' | 'natural' | 'double-sharp' | 'flat-flat';

export interface AccidentalPlanEntry {
  event: VoiceEvent;
  pitchIndex: number;
  sign: AccidentalSign;
  courtesy: boolean;
}

export interface AccidentalResult {
  entries: AccidentalPlanEntry[];
  requiredCount: number;
  courtesyCount: number;
  contradictions: Array<{ measureLabel: string; staff: number; pitch: string }>;
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** The key signature's alteration for one letter (A2): standard circle-of-fifths spelling. */
function fifthsToAlter(fifths: number, step: string): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, Math.min(fifths, 7)).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, Math.min(-fifths, 7)).includes(step) ? -1 : 0;
  return 0;
}

function alterToSign(alter: number): AccidentalSign | null {
  switch (alter) {
    case 1:
      return 'sharp';
    case -1:
      return 'flat';
    case 0:
      return 'natural';
    case 2:
      return 'double-sharp';
    case -2:
      return 'flat-flat';
    default:
      return null; // microtones and anything else: no single sign to print (A4 skips these)
  }
}

function signToAlter(sign: string): number | null {
  switch (sign) {
    case 'sharp':
      return 1;
    case 'flat':
      return -1;
    case 'natural':
      return 0;
    case 'double-sharp':
    case 'sharp-sharp':
      return 2;
    case 'flat-flat':
      return -2;
    default:
      return null;
  }
}

function getText(el: XmlElement): string {
  const txt = el.children.find((c): c is XmlText => c instanceof XmlText);
  return txt ? txt.text.trim() : '';
}

function printedAccidentalSign(noteEl: XmlElement): string | null {
  const accEl = noteEl.children.find((c): c is XmlElement => c instanceof XmlElement && c.name === 'accidental');
  return accEl ? getText(accEl) : null;
}

interface PitchEntry {
  event: VoiceEvent;
  pitchIndex: number;
}

function keyForStaffAt(measure: PartWalk['measures'][number], staff: number, onset: number): number {
  let fifths = measure.keyByStaff.get(staff) ?? measure.keyByStaff.get(0) ?? 0;
  for (const change of measure.midBarChanges) {
    if (change.onset <= onset && change.keyByStaff) {
      fifths = change.keyByStaff.get(staff) ?? change.keyByStaff.get(0) ?? 0;
    }
  }
  return fifths;
}

/**
 * Plans required and courtesy accidentals for one whole part (R-3): all voices and staves together,
 * per (staff, bar). `mode` controls where courtesy signs apply (C3): `'library'` always, `'opened'`
 * only when this part prints no `<accidental>` at all.
 */
export function planAccidentalsForPart(part: PartWalk, mode: EngravingMode): AccidentalResult {
  const entries: AccidentalPlanEntry[] = [];
  const contradictions: AccidentalResult['contradictions'] = [];
  let requiredCount = 0;
  let courtesyCount = 0;

  const partHasAnyAccidental = part.events.some((e) => e.pitches.some((p) => p.hasAccidental));

  const eventsByMeasure = new Map<number, VoiceEvent[]>();
  for (const e of part.events) {
    let list = eventsByMeasure.get(e.measureIndex);
    if (!list) {
      list = [];
      eventsByMeasure.set(e.measureIndex, list);
    }
    list.push(e);
  }

  // C1 courtesy memory: last alteration per (staff, step) from the previous bar, in document order
  // (any octave). Keyed `${staff}|${step}`.
  let courtesyMemory = new Map<string, number>();
  // C1 special case: the bar right before the most recent numbered ending 1 started, snapshotted so
  // ending 2+'s first bar can use it instead of the (physically preceding) ending-1 bar's memory.
  let preEnding1Memory: Map<string, number> | null = null;

  for (let measureIndex = 0; measureIndex < part.measures.length; measureIndex++) {
    const measure = part.measures[measureIndex];
    if (!measure) continue;
    const measureEvents = eventsByMeasure.get(measureIndex) ?? [];

    if (measure.endingStarts.includes(1)) {
      preEnding1Memory = new Map(courtesyMemory); // always the *most recent* ending-1 anchor
    }
    const effectiveMemory =
      measure.endingStarts.some((n) => n >= 2) && preEnding1Memory ? preEnding1Memory : courtesyMemory;

    const pitchEntries: PitchEntry[] = [];
    for (const event of measureEvents) {
      for (let pitchIndex = 0; pitchIndex < event.pitches.length; pitchIndex++) {
        pitchEntries.push({ event, pitchIndex });
      }
    }
    // A1: ordered by (position, grace before main, document order). A stable sort keeps document
    // order for anything already equal (chord members, simultaneous voices).
    pitchEntries.sort((a, b) => {
      if (a.event.onset !== b.event.onset) return a.event.onset - b.event.onset;
      if (a.event.grace !== b.event.grace) return a.event.grace ? -1 : 1;
      return 0;
    });

    const barState = new Map<string, number>(); // `${staff}|${step}|${octave}` -> alteration in force
    const letterMemoryThisBar = new Map<string, number>();
    const seenLetterThisBar = new Set<string>();
    let midBarChangeIndex = 0;

    for (const { event, pitchIndex } of pitchEntries) {
      // R-3 A2: a mid-bar key change resets the bar's required-accidental state.
      while (midBarChangeIndex < measure.midBarChanges.length) {
        const change = measure.midBarChanges[midBarChangeIndex];
        if (!change || change.onset > event.onset) break;
        if (change.keyByStaff) barState.clear();
        midBarChangeIndex++;
      }

      const pitch = event.pitches[pitchIndex];
      if (!pitch) continue;
      const staff = event.staff;
      const stateKey = `${staff}|${pitch.step}|${pitch.octave}`;
      const letterKey = `${staff}|${pitch.step}`;
      const isFirstOfLetterThisBar = !seenLetterThisBar.has(letterKey);
      seenLetterThisBar.add(letterKey);

      if (pitch.hasAccidental) {
        // A4: never touch an existing accidental. Detect (but don't fix) a printed sign that
        // contradicts <alter> (FR-006 exception).
        const printedSign = printedAccidentalSign(pitch.noteRef.element);
        const printedAlter = printedSign ? signToAlter(printedSign) : null;
        if (printedAlter !== null && printedAlter !== pitch.alter) {
          contradictions.push({
            measureLabel: event.measureLabel,
            staff,
            pitch: `${pitch.step}${pitch.octave}`,
          });
        }
        if (!pitch.tieStop) barState.set(stateKey, pitch.alter);
        letterMemoryThisBar.set(letterKey, pitch.alter);
        continue;
      }

      if (pitch.tieStop) {
        // A3: a tie-stop continuation prints nothing and does not set the bar's required-accidental
        // state, but its alteration is still remembered for C1's courtesy memory.
        letterMemoryThisBar.set(letterKey, pitch.alter);
        continue;
      }

      if (pitch.fractionalAlter) continue; // microtones: not representable, skip (A4)

      const keyAlter = fifthsToAlter(keyForStaffAt(measure, staff, event.onset), pitch.step);
      const expected = barState.has(stateKey) ? (barState.get(stateKey) as number) : keyAlter;

      if (pitch.alter !== expected) {
        const sign = alterToSign(pitch.alter);
        if (sign) {
          entries.push({ event, pitchIndex, sign, courtesy: false });
          requiredCount++;
        }
        barState.set(stateKey, pitch.alter);
        letterMemoryThisBar.set(letterKey, pitch.alter);
        continue;
      }

      barState.set(stateKey, pitch.alter);
      letterMemoryThisBar.set(letterKey, pitch.alter);

      if (isFirstOfLetterThisBar) {
        const courtesyAllowed = mode === 'library' || !partHasAnyAccidental;
        const prevAlter = effectiveMemory.get(letterKey);
        if (courtesyAllowed && prevAlter !== undefined && prevAlter !== pitch.alter) {
          const sign = alterToSign(pitch.alter);
          if (sign) {
            entries.push({ event, pitchIndex, sign, courtesy: true });
            courtesyCount++;
          }
        }
      }
    }

    // C1: memory is of *the previous bar* specifically, not the last bar a letter happened to appear
    // in - a letter absent from this bar has no defined "previous bar" alteration for the next one,
    // so the memory is replaced wholesale each bar, never merged/accumulated across an absent bar.
    courtesyMemory = letterMemoryThisBar;
  }

  return { entries, requiredCount, courtesyCount, contradictions };
}
