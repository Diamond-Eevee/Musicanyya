// The token notation of a lesson bar (contract lesson-definition 1.0.0 §2): one staff of one bar is a list of tokens
//   [symbol] head ":" value [dot] [tie] [marks] [finger]
// e.g. `{C/E}<E4 G4 C5>:h@1-2-5`, `C4:q.~(`, `r:q`, `R:w`. Every error names the bar and the token.
import type { WriteDuration } from '../../../src/core/musicxml/write';
import { type Alter, type Spelling, type Step, spellingMidi } from '../fidelity/reference';
import { add, cmp, mul, type QuarterTime, q, show, sub } from '../fidelity/time';
import { type LessonBarDefinition, type LessonBarline, LessonDefinitionError } from './definition';

export type LessonStaff = 'rh' | 'lh';

export interface LessonToken {
  /** The token as written, for error messages. */
  text: string;
  /** A chord symbol printed above staff 1 at this onset. */
  symbol?: string;
  rest: boolean;
  /** `R`: a rest that fills the staff's whole bar. */
  measureRest: boolean;
  /** Bottom to top; empty for a rest. */
  pitches: Spelling[];
  type: WriteDuration;
  dots: 0 | 1;
  length: QuarterTime;
  tie: boolean;
  slurStart: boolean;
  slurEnd: boolean;
  staccato: boolean;
  accent: boolean;
  tenuto: boolean;
  /** As written after `@`, one per pitch bottom to top. */
  fingers?: number[];
}

export interface ParsedBar {
  /** Position in `bars`, from 0. */
  index: number;
  /** The printed bar number: a pickup is 0. */
  number: number;
  length: QuarterTime;
  /** The pickup bar, or the last bar that completes it: written `implicit`. */
  implicit: boolean;
  barline?: LessonBarline;
  rh: LessonToken[];
  lh: LessonToken[];
  /** Per token of `rh` / `lh`: the finger of each pitch (bottom to top), carried by the fingering rule of §2. */
  rhFingers: number[][];
  lhFingers: number[][];
  /** Per token: the pitches (MIDI) a tie from the previous token continues here. */
  rhTiedFrom: Set<number>[];
  lhTiedFrom: Set<number>[];
}

const VALUES: Record<string, { type: WriteDuration; length: QuarterTime }> = {
  w: { type: 'whole', length: q(4) },
  h: { type: 'half', length: q(2) },
  q: { type: 'quarter', length: q(1) },
  e: { type: 'eighth', length: q(1, 2) },
  s: { type: '16th', length: q(1, 4) },
};
const PITCH = /^([A-G])(#|b)?([0-8])$/;

function failAt(at: { bar: number; staff: LessonStaff }, token: string, reason: string): never {
  throw new LessonDefinitionError(`bar ${at.bar}, ${at.staff}: "${token}" - ${reason}`);
}

/** Splits a staff's text at spaces, keeping `<...>` and `{...}` together. */
function split(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '<' || ch === '{') depth++;
    if (ch === '>' && depth > 0 && current.includes('<') && !current.includes(':')) depth--;
    else if (ch === '}' && depth > 0) depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current !== '') tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current !== '') tokens.push(current);
  return tokens;
}

function pitchOf(text: string): Spelling | null {
  const m = PITCH.exec(text);
  if (!m) return null;
  const alter: Alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

/** Parses one staff of one bar. */
export function parseStaff(text: string, at: { bar: number; staff: LessonStaff }): LessonToken[] {
  return split(text).map((raw) => parseToken(raw, at));
}

function parseToken(raw: string, at: { bar: number; staff: LessonStaff }): LessonToken {
  let rest = raw;
  let symbol: string | undefined;
  if (rest.startsWith('{')) {
    const close = rest.indexOf('}');
    if (close < 2) failAt(at, raw, 'a chord symbol is written {name}');
    symbol = rest.slice(1, close);
    rest = rest.slice(close + 1);
  }

  const colon = rest.startsWith('<') ? rest.indexOf(':', rest.indexOf('>')) : rest.indexOf(':');
  if (colon < 0) failAt(at, raw, 'a token is head:value, e.g. C4:q');
  const head = rest.slice(0, colon);
  let tail = rest.slice(colon + 1);

  let pitches: Spelling[] = [];
  let isRest = false;
  let measureRest = false;
  if (head === 'r') {
    isRest = true;
  } else if (head === 'R') {
    isRest = true;
    measureRest = true;
  } else if (head.startsWith('<') && head.endsWith('>')) {
    const names = head.slice(1, -1).trim().split(/\s+/);
    if (names.length < 2) failAt(at, raw, 'a chord in <...> needs two or more pitches');
    pitches = names.map((name) => pitchOf(name) ?? failAt(at, raw, `"${name}" is not a pitch like C4, F#3 or Bb3`));
  } else {
    const pitch = pitchOf(head);
    if (!pitch) failAt(at, raw, `"${head}" is not a pitch like C4, F#3 or Bb3, a rest r or a bar rest R`);
    pitches = [pitch];
  }
  pitches.sort((a, b) => spellingMidi(a) - spellingMidi(b));
  if (symbol !== undefined && isRest) failAt(at, raw, 'a chord symbol belongs on a note or chord');

  const value = VALUES[tail[0] ?? ''];
  if (!value) failAt(at, raw, 'the value must be w, h, q, e or s');
  tail = tail.slice(1);
  let dots: 0 | 1 = 0;
  if (tail.startsWith('.')) {
    dots = 1;
    tail = tail.slice(1);
  }

  const token: LessonToken = {
    text: raw,
    ...(symbol !== undefined ? { symbol } : {}),
    rest: isRest,
    measureRest,
    pitches,
    type: value.type,
    dots,
    length: dots === 1 ? mul(value.length, 3, 2) : value.length,
    tie: false,
    slurStart: false,
    slurEnd: false,
    staccato: false,
    accent: false,
    tenuto: false,
  };
  while (tail.length > 0) {
    const ch = tail[0];
    if (ch === '@') {
      const fingers = tail.slice(1).split('-');
      if (!fingers.every((f) => /^[1-5]$/.test(f))) failAt(at, raw, 'fingering is @ and digits 1-5 joined by -');
      if (isRest) failAt(at, raw, 'a rest has no fingering');
      if (fingers.length !== pitches.length)
        failAt(at, raw, `the fingering names ${fingers.length} finger(s) for ${pitches.length} notes`);
      token.fingers = fingers.map(Number);
      break;
    }
    if (ch === '~') token.tie = true;
    else if (ch === '(') token.slurStart = true;
    else if (ch === ')') token.slurEnd = true;
    else if (ch === '!') token.staccato = true;
    else if (ch === '>') token.accent = true;
    else if (ch === '_') token.tenuto = true;
    else failAt(at, raw, `"${ch}" is not a tie, mark or fingering`);
    tail = tail.slice(1);
  }
  if (isRest && (token.tie || token.slurStart || token.slurEnd || token.staccato || token.accent || token.tenuto))
    failAt(at, raw, 'a rest takes no tie or mark');
  return token;
}

function metreLength(metre: string): QuarterTime {
  const [beats, beatType] = metre.split('/').map(Number) as [number, number];
  return q(beats * 4, beatType);
}

function sum(tokens: readonly LessonToken[]): QuarterTime {
  return tokens.reduce((total, t) => add(total, t.length), q(0));
}

/** Parses every bar of a lesson and checks contract §2's rules: each staff of a bar adds up to the metre (a pickup bar
 *  is shorter and the last bar completes it), `R` stands alone, a tie joins equal pitches, and every note has a finger
 *  (written, or carried from the same pitch on its staff). */
export function parseLessonBars(
  bars: readonly LessonBarDefinition[],
  options: { metre: string; pickup: boolean },
): ParsedBar[] {
  const full = metreLength(options.metre);
  if (options.pickup && bars.length < 2)
    throw new LessonDefinitionError('a lesson with a pickup needs two bars or more');
  const parsed: ParsedBar[] = bars.map((bar, index) => {
    const number = options.pickup ? index : index + 1;
    const rh = parseStaff(bar.rh, { bar: number, staff: 'rh' });
    const lh = parseStaff(bar.lh, { bar: number, staff: 'lh' });
    for (const [staff, tokens] of [
      ['rh', rh],
      ['lh', lh],
    ] as const) {
      if (tokens.length === 0) throw new LessonDefinitionError(`bar ${number}, ${staff}: the staff is empty`);
      const whole = tokens.find((t) => t.measureRest);
      if (whole && tokens.length > 1)
        failAt({ bar: number, staff }, whole.text, 'R fills the whole bar and must stand alone in its staff');
    }
    const implicit = options.pickup && (index === 0 || index === bars.length - 1);
    return {
      index,
      number,
      length: full,
      implicit,
      ...(bar.barline !== undefined ? { barline: bar.barline } : {}),
      rh,
      lh,
      rhFingers: [],
      lhFingers: [],
      rhTiedFrom: [],
      lhTiedFrom: [],
    };
  });

  // Bar lengths: R takes the length of the other staff; a pickup and the last bar share one full bar
  let pickupLength = q(0);
  for (const bar of parsed) {
    const lengths = (['rh', 'lh'] as const)
      .filter((staff) => !bar[staff][0]?.measureRest)
      .map((staff) => ({ staff, length: sum(bar[staff]) }));
    let expected = full;
    if (bar.implicit && bar.index === 0) {
      const first = lengths[0];
      if (!first) throw new LessonDefinitionError(`bar ${bar.number}: a pickup bar cannot be rests in both staves`);
      expected = first.length;
      if (cmp(expected, full) >= 0 || cmp(expected, q(0)) <= 0)
        throw new LessonDefinitionError(
          `bar ${bar.number}: the pickup is ${show(expected)} quarters; it must be shorter than the ${show(full)}-quarter bar`,
        );
      pickupLength = expected;
    } else if (bar.implicit) {
      expected = sub(full, pickupLength);
      const short = lengths.find((l) => cmp(l.length, expected) !== 0);
      if (short)
        throw new LessonDefinitionError(
          `bar ${bar.number}, ${short.staff}: the last bar is ${show(short.length)} quarters; with the pickup of ${show(pickupLength)} it must complete the bar (${show(expected)} quarters)`,
        );
    }
    for (const { staff, length } of lengths) {
      if (cmp(length, expected) !== 0)
        throw new LessonDefinitionError(
          `bar ${bar.number}, ${staff}: the notes add up to ${show(length)} quarters, the bar needs ${show(expected)} quarters`,
        );
    }
    bar.length = expected;
  }

  // Ties and fingering, staff by staff across the bars
  for (const staff of ['rh', 'lh'] as const) {
    const fingerOf = new Map<number, number>();
    let tiedFrom = new Set<number>();
    let tieToken: { text: string; bar: number } | null = null;
    for (const bar of parsed) {
      const fingersList = staff === 'rh' ? bar.rhFingers : bar.lhFingers;
      const tiedList = staff === 'rh' ? bar.rhTiedFrom : bar.lhTiedFrom;
      for (const token of bar[staff]) {
        const midis = token.pitches.map(spellingMidi);
        if (tieToken) {
          const same = midis.length === tiedFrom.size && midis.every((m) => tiedFrom.has(m));
          if (!same || token.rest)
            failAt({ bar: tieToken.bar, staff }, tieToken.text, 'a tie joins a note to the same pitch, written next');
        }
        tiedList.push(tieToken ? tiedFrom : new Set());
        const fingers = midis.map((midi, i) => {
          const carried = fingerOf.get(midi);
          if (tieToken && carried !== undefined) return carried;
          const written = token.fingers?.[i];
          if (written !== undefined) return written;
          if (carried === undefined) {
            const name = token.pitches[i];
            failAt(
              { bar: bar.number, staff },
              token.text,
              `the first ${name ? `${name.step}${name.alter === 1 ? '#' : name.alter === -1 ? 'b' : ''}${name.octave}` : 'note'} on this staff needs a finger (@)`,
            );
          }
          return carried;
        });
        midis.forEach((midi, i) => {
          fingerOf.set(midi, fingers[i] as number);
        });
        fingersList.push(fingers);
        if (token.tie) {
          if (token.rest) failAt({ bar: bar.number, staff }, token.text, 'a rest cannot be tied');
          tiedFrom = new Set(midis);
          tieToken = { text: token.text, bar: bar.number };
        } else {
          tiedFrom = new Set();
          tieToken = null;
        }
      }
    }
    if (tieToken) failAt({ bar: tieToken.bar, staff }, tieToken.text, 'the tie has no note to continue into');
  }
  return parsed;
}
