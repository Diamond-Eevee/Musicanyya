import type { NoteType, TupletInfo } from './walk.js';

export interface Span {
  start: number;
  end: number;
}

export interface MeasureTime {
  beats: number[];
  beatType: number;
}

/** The note content `applyEighthExtensions` needs to decide a B4 merge/split - not the full VoiceEvent. */
export interface GroupableNote {
  onset: number;
  type: NoteType | null;
  dots: number;
  rest: boolean;
  tuplet: TupletInfo | null;
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

function shorterThanEighth(type: NoteType | null): boolean {
  if (!type) return false;
  return NOTE_TYPE_ORDER.indexOf(type) > NOTE_TYPE_ORDER.indexOf('eighth');
}

function isPlainEighth(note: GroupableNote): boolean {
  return note.type === 'eighth' && note.dots === 0 && note.tuplet === null && !note.rest;
}

function baseGroups(time: MeasureTime, ppq: number): Span[] {
  const unitTicks = (ppq * 4) / time.beatType;

  if (time.beats.length > 1) {
    const groups: Span[] = [];
    let pos = 0;
    for (const b of time.beats) {
      const end = pos + b * unitTicks;
      groups.push({ start: pos, end });
      pos = end;
    }
    return groups;
  }

  const n = time.beats[0] ?? 4;
  const isEighthOrShorterMetre = time.beatType === 8 || time.beatType === 16;

  if (isEighthOrShorterMetre && n <= 3) {
    return [{ start: 0, end: n * unitTicks }];
  }
  if ((time.beatType === 8 || time.beatType === 16) && (n === 6 || n === 9 || n === 12)) {
    return compoundGroups(n / 3, 3 * unitTicks);
  }
  if (time.beatType === 8 && n === 5) {
    return splitGroups([3, 2], unitTicks);
  }
  if (time.beatType === 8 && n === 7) {
    return splitGroups([2, 2, 3], unitTicks);
  }
  // Default (R-2 B3): "one group per single unit of 1/beat-type" - covers x/4, 2/2, 3/2, `cut`,
  // senza-misura-with-a-nominal-time and anything else not matched above.
  return compoundGroups(n, unitTicks);
}

function compoundGroups(count: number, groupSize: number): Span[] {
  const groups: Span[] = [];
  for (let i = 0; i < count; i++) groups.push({ start: i * groupSize, end: (i + 1) * groupSize });
  return groups;
}

function splitGroups(parts: readonly number[], unitTicks: number): Span[] {
  const groups: Span[] = [];
  let pos = 0;
  for (const p of parts) {
    const end = pos + p * unitTicks;
    groups.push({ start: pos, end });
    pos = end;
  }
  return groups;
}

/**
 * R-2 B3 baseline groups for one measure, B2 pickup-alignment applied. `measureLength` is the
 * measure's actual notated length (in the walk's common tick unit); for an `implicit` bar this is
 * shorter than the metre's nominal length, and the returned spans are aligned to the *end* of a full
 * bar (B2) rather than its start.
 */
export function beamSpans(time: MeasureTime | null, measureLength: number, implicit: boolean, ppq: number): Span[] {
  if (!time || measureLength <= 0) return measureLength > 0 ? [{ start: 0, end: measureLength }] : [];

  const groups = baseGroups(time, ppq);
  const nominalLength = groups[groups.length - 1]?.end ?? measureLength;

  if (!implicit || measureLength >= nominalLength) {
    return groups
      .filter((g) => g.start < measureLength)
      .map((g) => ({ start: g.start, end: Math.min(g.end, measureLength) }));
  }

  // B2: end-align a short pickup bar to where it would sit at the end of a full bar of this metre.
  const shift = nominalLength - measureLength;
  return groups.filter((g) => g.end > shift).map((g) => ({ start: Math.max(0, g.start - shift), end: g.end - shift }));
}

/**
 * R-2 B4: content-dependent widening (4/4 half-bar fours, 3/4 whole-bar six) or narrowing (2/2 half
 * splits to quarters) of the B3 baseline groups, given the actual notes in this measure for one
 * (part, voice). `notes` need only cover this one measure. Metres other than 2/2, 3/4 and 4/4 are
 * returned unchanged.
 */
export function applyEighthExtensions(
  time: MeasureTime | null,
  groups: readonly Span[],
  notes: readonly GroupableNote[],
): Span[] {
  if (time?.beats.length !== 1) return [...groups];
  const [n] = time.beats;

  if (time.beatType === 4 && n === 4 && groups.length === 4) {
    const halves: Span[] = [
      mergeIfQualifies(groups[0]!, groups[1]!, notes),
      mergeIfQualifies(groups[2]!, groups[3]!, notes),
    ].flat();
    return halves;
  }

  if (time.beatType === 4 && n === 3 && groups.length === 3) {
    const whole = { start: groups[0]!.start, end: groups[2]!.end };
    const inWhole = notes.filter((nt) => nt.onset >= whole.start && nt.onset < whole.end);
    if (inWhole.length === 6 && inWhole.every(isPlainEighth)) return [whole];
    return [...groups];
  }

  if (time.beatType === 2 && groups.length >= 1) {
    const result: Span[] = [];
    for (const half of groups) {
      const inHalf = notes.filter((nt) => nt.onset >= half.start && nt.onset < half.end);
      const hasShort = inHalf.some((nt) => shorterThanEighth(nt.type));
      if (hasShort) {
        const mid = (half.start + half.end) / 2;
        result.push({ start: half.start, end: mid }, { start: mid, end: half.end });
      } else {
        result.push(half);
      }
    }
    return result;
  }

  return [...groups];
}

function mergeIfQualifies(a: Span, b: Span, notes: readonly GroupableNote[]): Span[] {
  const merged = { start: a.start, end: b.end };
  const inHalf = notes.filter((nt) => nt.onset >= merged.start && nt.onset < merged.end);
  if (inHalf.length === 4 && inHalf.every(isPlainEighth)) return [merged];
  return [a, b];
}
