// The LilyPond reading (data-model.md §2, contract fidelity-tools.md §3): variables are expanded where they are
// used, octaves resolved as \relative defines them, then the music is laid out in time. Bars come from \time,
// \partial and the accumulated durations, and every bar check must fall on a bar line (§3.2).
import { playedOrder } from '../fidelity/played-order';
import {
  type Alter,
  compareGraceNotes,
  compareNotes,
  type ReferenceBar,
  type ReferenceGraceNote,
  type ReferenceNote,
  type ReferenceScore,
  type Spelling,
  type Step,
  spellingMidi,
  validateReference,
} from '../fidelity/reference';
import { add, cmp, mul, type QuarterTime, q, show, sub } from '../fidelity/time';
import { LyUnsupportedError } from './errors';
import type { LyDuration, LyMark, LyMusic, LyPitch, LyReadOptions, LyScore, Pos } from './parse';
import { parseLilyPond, START_REPEAT_BARS } from './parse';

export type { LyMark, LyReadOptions, LyScore } from './parse';

const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function readLilyPond(source: string, options: LyReadOptions = {}): LyScore {
  return parseLilyPond(source, options);
}

export function fromLilyPond(score: LyScore): ReferenceScore {
  return analyse(score).reading;
}

/** A note, chord or rest as the page prints it, before ties are merged (`sound` merges them for the reading). */
interface WrittenBase {
  /** Onset in quarter notes from the start of the piece; a grace note's is its principal note's. */
  t: QuarterTime;
  staff: number;
  voice: string;
  /** Written value: 1, 2, 4 ... for whole, half, quarter ...; 0.5 for \breve. */
  base: number;
  dots: number;
  /** Sounding length in quarter notes (tuplets and `*n/m` applied); 0 for a grace note. */
  length: QuarterTime;
  /** The `*n/m` factor written after the value (R1*3, s2*3/4). */
  factor: QuarterTime;
  /** The enclosing \tuplet, if any: its number in source order, and its time modification. */
  tuplet?: { group: number; actual: number; normal: number; nested: boolean };
  marks: LyMark[];
  pos: Pos;
}

/** What the printed page shows, in source order, for the converter (contract §3.3). */
export type LyEvent =
  | (WrittenBase & {
      kind: 'note';
      /** One entry per note of a chord. `tie` = tied to the next note of the same pitch in this voice. */
      pitches: { spelling: Spelling; tie: boolean; marks: LyMark[] }[];
      chord: boolean;
      /** The grace command (\grace, \acciaccatura, ...) for a grace note. */
      grace?: string;
    })
  | (WrittenBase & { kind: 'rest'; rest: 'r' | 'R' | 's'; inDynamics: boolean })
  | { kind: 'clef'; t: QuarterTime; staff: number; name: string; pos: Pos }
  | { kind: 'key'; t: QuarterTime; staff: number; tonic: LyPitch; mode: string; pos: Pos }
  | { kind: 'time'; t: QuarterTime; num: number; den: number; pos: Pos }
  | { kind: 'ottava'; t: QuarterTime; staff: number; octaves: number; pos: Pos }
  | { kind: 'tempo'; t: QuarterTime; staff: number; text?: string; beat?: LyDuration; bpm?: number; pos: Pos }
  | { kind: 'mark'; t: QuarterTime; staff: number; voice: string; name: string; inDynamics: boolean; pos: Pos }
  | { kind: 'bar'; t: QuarterTime; style: string; pos: Pos };

export interface LyWritten {
  /** The same reading `fromLilyPond` gives: its bars are the converter's measures. */
  reading: ReferenceScore;
  events: LyEvent[];
  /** Number of staves (1 when the music names none). */
  staves: number;
}

/** The reading together with the written events, from one walk through the music. */
export function readWritten(score: LyScore): LyWritten {
  const { reading, layout, staves } = analyse(score);
  return { reading, events: layout.events, staves: Math.max(1, staves.count) };
}

function analyse(score: LyScore): { reading: ReferenceScore; layout: Layout; staves: Staves } {
  const music = expand(score.music, score.variables, []);
  resolveOctaves(music);
  const staves = numberStaves(music);
  const layout = layOut(music, staves);
  const bars = buildBars(layout);
  markRepeats(bars, layout.repeats, layout.repeatBars);

  const barAt = (t: QuarterTime, pos: Pos): number => {
    for (let i = bars.length - 1; i >= 0; i--) if (cmp((bars[i] as ReferenceBar).start, t) <= 0) return i;
    return fail(pos, `time ${show(t)} is before the first bar`);
  };
  for (const n of layout.notes) n.note.bar = barAt(n.note.onset, n.pos);
  for (const g of layout.graces) {
    if (cmp(g.grace.before, layout.end) >= 0) fail(g.pos, 'grace note after the last note');
    g.grace.bar = barAt(g.grace.before, g.pos);
  }
  const notes = layout.notes.map((n) => n.note).sort(compareNotes);
  const graceNotes = layout.graces.map((g) => g.grace).sort(compareGraceNotes);
  const reading = validateReference({ origin: 'lilypond', bars, notes, graceNotes, playedOrder: playedOrder(bars) });
  return { reading, layout, staves };
}

function spell(pitch: LyPitch): Spelling {
  return { step: STEPS[pitch.letter] as Step, alter: pitch.alter as Alter, octave: pitch.octave as number };
}

function fail(pos: Pos, construct: string): never {
  throw new LyUnsupportedError(pos.line, pos.column, construct);
}

// ---- 1. variables ------------------------------------------------------------------------------------------------

function expand(m: LyMusic, variables: Map<string, LyMusic>, stack: string[]): LyMusic {
  if (m.kind === 'variable') {
    const value = variables.get(m.name);
    if (!value) return fail(m.pos, `\\${m.name} (undefined variable)`);
    if (stack.includes(m.name)) return fail(m.pos, `\\${m.name} refers to itself`);
    return expand(value, variables, [...stack, m.name]);
  }
  const copy = structuredClone(m);
  if (copy.kind === 'seq') copy.items = copy.items.map((x) => expand(x, variables, stack));
  else if (copy.kind === 'sim') copy.branches = copy.branches.map((x) => expand(x, variables, stack));
  else if (copy.kind === 'repeat') {
    copy.body = expand(copy.body, variables, stack);
    copy.alternatives = copy.alternatives.map((x) => expand(x, variables, stack));
  } else if ('body' in copy) copy.body = expand(copy.body, variables, stack);
  return copy;
}

// ---- 2. octaves --------------------------------------------------------------------------------------------------

/** Resolves every pitch's absolute octave in source order, as LilyPond's \relative does. */
function resolveOctaves(root: LyMusic): void {
  let relative = false;
  let ref = { letter: 0, octave: 4 };
  const absolute = (p: LyPitch): number => 3 + p.marks; // LilyPond's c is C3
  const resolve = (p: LyPitch): void => {
    if (p.check !== undefined) p.octave = 3 + p.check;
    else if (!relative) p.octave = absolute(p);
    else {
      const from = ref.octave * 7 + ref.letter;
      let d = ref.octave * 7 + p.letter;
      while (d - from > 3) d -= 7;
      while (from - d > 3) d += 7;
      p.octave = Math.floor((d + 7 * p.marks) / 7);
    }
    ref = { letter: p.letter, octave: p.octave };
  };
  const walk = (m: LyMusic): void => {
    switch (m.kind) {
      case 'note':
        resolve(m.pitch);
        return;
      case 'rest':
        if (m.pitch) resolve(m.pitch);
        return;
      case 'chord': {
        for (const n of m.notes) resolve(n.pitch);
        const first = (m.notes[0] as { pitch: LyPitch }).pitch;
        ref = { letter: first.letter, octave: first.octave as number };
        return;
      }
      case 'relative': {
        const saved = { relative, ref };
        relative = true;
        ref = { letter: m.ref.letter, octave: absolute(m.ref) };
        walk(m.body);
        ({ relative, ref } = saved);
        return;
      }
      case 'transpose': {
        // \relative does not look inside \transpose (Notation Reference, "Relative octave entry"): supported only
        // outside \relative, where the body is read as written and then moved.
        if (relative) fail(m.pos, '\\transpose inside \\relative');
        m.from.octave = absolute(m.from);
        m.to.octave = absolute(m.to);
        walk(m.body);
        transposeAll(m.body, m.from, m.to, m.pos);
        return;
      }
      case 'seq':
        m.items.forEach(walk);
        return;
      case 'sim':
        m.branches.forEach(walk);
        return;
      case 'repeat':
        walk(m.body);
        m.alternatives.forEach(walk);
        return;
      default:
        if ('body' in m) walk(m.body);
    }
  };
  walk(root);
}

const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const pitchMidi = (p: { letter: number; alter: number; octave: number }) =>
  (p.octave + 1) * 12 + (STEP_SEMITONES[p.letter] as number) + p.alter;

/** Moves every pitch (and key tonic) in `body` by the interval from -> to, keeping the spelling a musician would write. */
function transposeAll(body: LyMusic, from: LyPitch, to: LyPitch, pos: Pos): void {
  const f = { letter: from.letter, alter: from.alter, octave: from.octave as number };
  const t = { letter: to.letter, alter: to.alter, octave: to.octave as number };
  const steps = t.octave * 7 + t.letter - (f.octave * 7 + f.letter);
  const semitones = pitchMidi(t) - pitchMidi(f);
  const move = (p: LyPitch, octave: number): void => {
    const index = octave * 7 + p.letter + steps;
    const letter = ((index % 7) + 7) % 7;
    const newOctave = Math.floor(index / 7);
    const alter =
      pitchMidi({ letter: p.letter, alter: p.alter, octave }) +
      semitones -
      pitchMidi({ letter, alter: 0, octave: newOctave });
    if (alter < -2 || alter > 2) fail(pos, 'a transposition that needs a triple accidental');
    p.letter = letter;
    p.alter = alter as LyPitch['alter'];
    p.octave = newOctave;
  };
  const walk = (m: LyMusic): void => {
    if (m.kind === 'note') move(m.pitch, m.pitch.octave as number);
    else if (m.kind === 'chord') for (const n of m.notes) move(n.pitch, n.pitch.octave as number);
    else if (m.kind === 'key') move(m.tonic, 4);
    else if (m.kind === 'seq') m.items.forEach(walk);
    else if (m.kind === 'sim') m.branches.forEach(walk);
    else if (m.kind === 'repeat') {
      walk(m.body);
      m.alternatives.forEach(walk);
    } else if ('body' in m) walk(m.body);
  };
  walk(body);
}

// ---- 3. staves ---------------------------------------------------------------------------------------------------

interface Staves {
  byNode: Map<LyMusic, number>;
  byName: Map<string, number>;
  count: number;
}

/** Staff numbers in source order (1 = the first staff, the upper staff of a piano score). */
function numberStaves(root: LyMusic): Staves {
  const staves: Staves = { byNode: new Map(), byName: new Map(), count: 0 };
  let count = 0;
  const walk = (m: LyMusic, currentStaff?: number): void => {
    if (m.kind === 'context' && m.type === 'Staff') {
      const known = m.name !== undefined ? staves.byName.get(m.name) : undefined;
      const n = known ?? currentStaff ?? ++count;
      staves.byNode.set(m, n);
      if (m.name !== undefined) staves.byName.set(m.name, n);

      const saved = currentStaff;
      currentStaff = n;
      if (m.body) walk(m.body, currentStaff);
      currentStaff = saved;
      return;
    }
    if (m.kind === 'seq') for (const x of m.items) walk(x, currentStaff);
    else if (m.kind === 'sim') for (const x of m.branches) walk(x, currentStaff);
    else if (m.kind === 'repeat') {
      walk(m.body, currentStaff);
      for (const x of m.alternatives) walk(x, currentStaff);
    } else if ('body' in m) walk(m.body, currentStaff);
  };
  walk(root);
  staves.count = count;
  return staves;
}

// ---- 4. time -----------------------------------------------------------------------------------------------------

interface Repeat {
  start: QuarterTime;
  bodyEnd: QuarterTime;
  alternatives: { start: QuarterTime; end: QuarterTime }[];
  times: number;
  pos: Pos;
}

interface Layout {
  notes: { note: ReferenceNote; pos: Pos }[];
  graces: { grace: ReferenceGraceNote; pos: Pos }[];
  barChecks: { t: QuarterTime; pos: Pos }[];
  barNumberChecks: { t: QuarterTime; n: number; pos: Pos }[];
  times: { t: QuarterTime; num: number; den: number; pos: Pos }[];
  /** \set Timing.measurePosition, in quarter notes (negative = that long before the next bar line). */
  resets: { t: QuarterTime; position: QuarterTime; pos: Pos }[];
  /** \bar "..." events; "" hides the bar line at that point. */
  barLines: { t: QuarterTime; style: string }[];
  /** Printed start-repeat bar lines (\bar ".|:"); each must be where a \repeat volta starts. */
  repeatBars: { t: QuarterTime; pos: Pos }[];
  partial?: QuarterTime;
  repeats: Repeat[];
  end: QuarterTime;
  /** The written events for the converter. */
  events: LyEvent[];
}

function layOut(root: LyMusic, staves: Staves): Layout {
  const out: Layout = {
    notes: [],
    graces: [],
    barChecks: [],
    barNumberChecks: [],
    times: [],
    resets: [],
    barLines: [],
    repeatBars: [],
    repeats: [],
    end: q(0),
    events: [],
  };
  let cursor = q(0);
  let staff = 1;
  let voice = 'v';
  let factor = q(1);
  let grace = false;
  let unfold = false;
  let inDynamics = false;
  let anonymousVoices = 0;
  let graceCommand = '';
  let tuplet: WrittenBase['tuplet'];
  let tupletGroups = 0;
  const written = (value: LyDuration, length: QuarterTime, marks: LyMark[], pos: Pos) => ({
    t: cursor,
    staff,
    voice,
    base: value.base,
    dots: value.dots,
    length,
    factor: value.factor,
    ...(tuplet ? { tuplet } : {}),
    marks,
    pos,
  });
  const openTies = new Map<string, ReferenceNote>(); // voice|midi -> note whose tie is still open

  const advance = (length: QuarterTime): void => {
    cursor = add(cursor, length);
    if (cmp(cursor, out.end) > 0) out.end = cursor;
  };
  const sound = (pitch: LyPitch, length: QuarterTime, tie: boolean, articulated: boolean, pos: Pos): void => {
    if (inDynamics) fail(pos, 'a note in a Dynamics context');
    const spelling = spell(pitch);
    const midi = spellingMidi(spelling);
    if (grace) {
      out.graces.push({ grace: { bar: -1, before: cursor, midi, spelling }, pos });
      return;
    }
    const key = `${voice}|${midi}`;
    const open = openTies.get(key);
    openTies.delete(key);
    if (open && cmp(add(open.onset, open.duration), cursor) === 0) {
      open.duration = add(open.duration, length);
      if (articulated) open.articulated = true;
      if (tie) openTies.set(key, open);
      return;
    }
    const note: ReferenceNote = { bar: -1, onset: cursor, duration: length, midi, spelling, staff, voice };
    if (articulated) note.articulated = true;
    out.notes.push({ note, pos });
    if (tie) openTies.set(key, note);
  };
  const alternativeFor = (pass: number, times: number, count: number): number => Math.max(0, pass - (times - count));

  const walk = (m: LyMusic): void => {
    switch (m.kind) {
      case 'seq':
        m.items.forEach(walk);
        return;
      case 'sim': {
        const start = cursor;
        let end = cursor;
        const saved = { staff, voice };
        m.branches.forEach((branch, i) => {
          cursor = start;
          if (m.voices) voice = `${saved.voice}.${i + 1}`;
          walk(branch);
          if (cmp(cursor, end) > 0) end = cursor;
          ({ staff, voice } = saved);
        });
        cursor = end;
        return;
      }
      case 'note': {
        const length = mul(m.duration.length, factor.num, factor.den);
        out.events.push({
          kind: 'note',
          ...written(m.duration, grace ? q(0) : length, m.marks, m.pos),
          pitches: [{ spelling: spell(m.pitch), tie: m.tie, marks: [] }],
          chord: false,
          ...(grace ? { grace: graceCommand } : {}),
        });
        sound(m.pitch, length, m.tie, m.post.includes('articulation'), m.pos);
        if (!grace) advance(length);
        return;
      }
      case 'chord': {
        const length = mul(m.duration.length, factor.num, factor.den);
        out.events.push({
          kind: 'note',
          ...written(m.duration, grace ? q(0) : length, m.marks, m.pos),
          pitches: m.notes.map((n) => ({ spelling: spell(n.pitch), tie: m.tie || n.tie, marks: n.marks })),
          chord: true,
          ...(grace ? { grace: graceCommand } : {}),
        });
        const articulated = m.post.includes('articulation');
        for (const n of m.notes)
          sound(n.pitch, length, m.tie || n.tie, articulated || n.post.includes('articulation'), m.pos);
        if (!grace) advance(length);
        return;
      }
      case 'rest': {
        if (grace) return;
        const length = mul(m.duration.length, factor.num, factor.den);
        out.events.push({ kind: 'rest', ...written(m.duration, length, m.marks, m.pos), rest: m.rest, inDynamics });
        advance(length);
        return;
      }
      case 'barCheck':
        if (!grace) out.barChecks.push({ t: cursor, pos: m.pos });
        return;
      case 'barNumberCheck':
        if (!grace) out.barNumberChecks.push({ t: cursor, n: m.n, pos: m.pos });
        return;
      case 'unsupported':
        throw new LyUnsupportedError(m.pos.line, m.pos.column, m.construct);
      case 'relative':
      case 'transpose':
      case 'articulate':
        walk(m.body);
        return;
      case 'tuplet': {
        const saved = { factor, tuplet };
        factor = mul(factor, m.factor.num, m.factor.den);
        // \tuplet 3/2 has factor 2/3: three notes (actual) in the time of two (normal).
        tuplet = { group: ++tupletGroups, actual: m.factor.den, normal: m.factor.num, nested: tuplet !== undefined };
        walk(m.body);
        ({ factor, tuplet } = saved);
        return;
      }
      case 'grace': {
        const saved = { grace, graceCommand };
        grace = true;
        graceCommand = m.command;
        walk(m.body);
        ({ grace, graceCommand } = saved);
        return;
      }
      case 'unfoldRepeats': {
        const saved = unfold;
        unfold = true;
        walk(m.body);
        unfold = saved;
        return;
      }
      case 'repeat': {
        const count = m.alternatives.length;
        if (m.times < 2) fail(m.pos, `\\repeat ${m.mode} ${m.times}`);
        if (count > m.times) fail(m.pos, `${count} alternatives for ${m.times} passes`);
        if (m.mode === 'unfold' || unfold) {
          for (let pass = 0; pass < m.times; pass++) {
            walk(m.body);
            if (count > 0) walk(m.alternatives[alternativeFor(pass, m.times, count)] as LyMusic);
          }
          return;
        }
        if (count > 0 && m.times > 2) fail(m.pos, `\\repeat volta ${m.times} with \\alternative`);
        const repeat: Repeat = { start: cursor, bodyEnd: cursor, alternatives: [], times: m.times, pos: m.pos };
        walk(m.body);
        repeat.bodyEnd = cursor;
        for (const alt of m.alternatives) {
          const start = cursor;
          walk(alt);
          repeat.alternatives.push({ start, end: cursor });
        }
        out.repeats.push(repeat);
        return;
      }
      case 'context': {
        const saved = { staff, voice, inDynamics };
        if (m.type === 'Staff') {
          staff = staves.byNode.get(m) as number;
          voice = `staff${staff}`;
        } else if (m.type === 'Voice')
          // A named context is found only among the children of the current one, so the same name in another
          // staff is another voice (Burgmüller 203 names both hands VoiceI).
          voice = m.name !== undefined ? `staff${staff}:voice:${m.name}` : `${voice}/${++anonymousVoices}`;
        else if (m.type === 'Dynamics') inDynamics = true;
        walk(m.body);
        ({ staff, voice, inDynamics } = saved);
        return;
      }
      case 'changeStaff': {
        const n = staves.byName.get(m.name);
        if (n === undefined) fail(m.pos, `\\change Staff = "${m.name}" (no such staff)`);
        staff = n as number;
        return;
      }
      case 'time':
        out.times.push({ t: cursor, num: m.num, den: m.den, pos: m.pos });
        out.events.push({ kind: 'time', t: cursor, num: m.num, den: m.den, pos: m.pos });
        return;
      case 'partial':
        if (cmp(cursor, q(0)) !== 0) fail(m.pos, '\\partial after the start of the piece');
        out.partial = m.duration.length;
        return;
      case 'variable':
        fail(m.pos, `\\${m.name} (unexpanded variable)`);
        return;
      case 'measurePosition':
        if (!grace) out.resets.push({ t: cursor, position: m.position, pos: m.pos });
        return;
      case 'bar':
        if (grace) return;
        if (START_REPEAT_BARS.has(m.style)) out.repeatBars.push({ t: cursor, pos: m.pos });
        else out.barLines.push({ t: cursor, style: m.style });
        out.events.push({ kind: 'bar', t: cursor, style: m.style, pos: m.pos });
        return;
      // Display only for the reading; the converter prints them. \ottava only moves the staff position: the entered
      // pitch is the sounding pitch (contract §3.1).
      case 'key':
        out.events.push({ kind: 'key', t: cursor, staff, tonic: m.tonic, mode: m.mode, pos: m.pos });
        return;
      case 'clef':
        out.events.push({ kind: 'clef', t: cursor, staff, name: m.name, pos: m.pos });
        return;
      case 'ottava':
        out.events.push({ kind: 'ottava', t: cursor, staff, octaves: m.octaves, pos: m.pos });
        return;
      case 'tempo': {
        const { text, beat, bpm } = m;
        out.events.push({
          kind: 'tempo',
          t: cursor,
          staff,
          ...(text !== undefined ? { text } : {}),
          ...(beat !== undefined ? { beat } : {}),
          ...(bpm !== undefined ? { bpm } : {}),
          pos: m.pos,
        });
        return;
      }
      case 'mark':
        out.events.push({ kind: 'mark', t: cursor, staff, voice, name: m.name, inDynamics, pos: m.pos });
        return;
    }
  };
  walk(root);
  return out;
}

// ---- 5. bars -----------------------------------------------------------------------------------------------------

/**
 * Written bars follow the printed page (research R17):
 * - LilyPond's own measures come from \partial, \time and \set Timing.measurePosition; bar checks must fall on them
 *   (§3.2), exactly as LilyPond checks them;
 * - a bar line hidden with \bar "" is not a bar line of the written music, and a visible \bar adds one;
 * - repeat and volta boundaries are always bar lines: a repeat sign is printed as one even inside a measure
 *   (LilyPond Notation Reference, "Long repeats"), so a first ending that completes a pickup bar is its own bar.
 * Bars are numbered in order, from 0 when the piece starts with a \partial pickup.
 */
function buildBars(layout: Layout): ReferenceBar[] {
  const { end } = layout;
  const times = [...layout.times].sort((a, b) => cmp(a.t, b.t));
  const meterAt = (t: QuarterTime): QuarterTime => {
    let meter = q(4);
    for (const s of times) if (cmp(s.t, t) <= 0) meter = q(4 * s.num, s.den);
    return meter;
  };
  const origin = { line: 1, column: 1 };
  if (cmp(end, q(0)) === 0) fail(origin, 'a score without notes');

  // LilyPond's measures.
  const timing: QuarterTime[] = [q(0)];
  const pending = [...layout.resets].sort((a, b) => cmp(a.t, b.t));
  let start = q(0);
  let next = layout.partial ?? meterAt(q(0));
  if (layout.partial && cmp(layout.partial, meterAt(q(0))) >= 0)
    fail(times[0]?.pos ?? origin, '\\partial as long as a bar');
  for (;;) {
    const reset = pending.find((r) => cmp(r.t, start) >= 0 && cmp(r.t, next) < 0);
    if (reset) {
      pending.splice(pending.indexOf(reset), 1);
      // Negative: the next bar line is that far ahead. Otherwise the bar began `position` ago.
      next =
        cmp(reset.position, q(0)) < 0
          ? sub(reset.t, reset.position)
          : add(sub(reset.t, reset.position), meterAt(reset.t));
      if (cmp(next, start) <= 0) fail(reset.pos, 'measurePosition before the start of the bar');
      continue;
    }
    const inside = times.find((s) => cmp(s.t, start) > 0 && cmp(s.t, next) < 0);
    if (inside) fail(inside.pos, `\\time ${inside.num}/${inside.den} inside a bar (at ${show(inside.t)})`);
    if (cmp(next, end) >= 0) break;
    timing.push(next);
    start = next;
    next = add(start, meterAt(start));
  }
  const onTiming = (t: QuarterTime) => cmp(t, end) === 0 || timing.some((x) => cmp(x, t) === 0);
  for (const check of layout.barChecks)
    if (!onTiming(check.t)) fail(check.pos, `bar check at ${show(check.t)}, not on a bar line`);
  // LilyPond counts its own measures from 1; after a \partial pickup, the first full measure is 1.
  for (const check of layout.barNumberChecks) {
    let index = 0;
    timing.forEach((x, i) => {
      if (cmp(x, check.t) <= 0) index = i;
    });
    const measure = index + (layout.partial ? 0 : 1);
    if (measure !== check.n)
      fail(check.pos, `bar number check #${check.n} at ${show(check.t)}: LilyPond measure ${measure}`);
  }

  // The written bar lines.
  const boundaries = layout.repeats.flatMap((r) => [
    r.start,
    r.bodyEnd,
    ...r.alternatives.flatMap((a) => [a.start, a.end]),
  ]);
  const hidden = layout.barLines.filter((b) => b.style === '').map((b) => b.t);
  const visible = layout.barLines.filter((b) => b.style !== '').map((b) => b.t);
  const has = (list: QuarterTime[], t: QuarterTime) => list.some((x) => cmp(x, t) === 0);
  const lines = [...timing.filter((t) => !has(hidden, t) || has(boundaries, t)), ...visible, ...boundaries]
    .filter((t) => cmp(t, q(0)) >= 0 && cmp(t, end) < 0)
    .sort(cmp)
    .filter((t, i, all) => i === 0 || cmp(t, all[i - 1] as QuarterTime) !== 0);
  const first = layout.partial ? 0 : 1;
  return lines.map((t, i) => ({
    index: i,
    number: String(i + first),
    start: t,
    length: sub(lines[i + 1] ?? end, t),
    repeatStart: false,
    repeatEnd: false,
    endings: [],
  }));
}

function markRepeats(bars: ReferenceBar[], repeats: Repeat[], repeatBars: { t: QuarterTime; pos: Pos }[]): void {
  const starting = (t: QuarterTime, pos: Pos): ReferenceBar =>
    bars.find((b) => cmp(b.start, t) === 0) ?? fail(pos, `no bar starts at ${show(t)}`);
  const ending = (t: QuarterTime, pos: Pos): ReferenceBar =>
    bars.find((b) => cmp(add(b.start, b.length), t) === 0) ?? fail(pos, `no bar ends at ${show(t)}`);
  const seen = new Set<string>();
  for (const r of repeats) {
    // Every staff (and a Dynamics line) repeats the same structure; mark it once.
    const key = [r.start, r.bodyEnd, ...r.alternatives.flatMap((a) => [a.start, a.end])].map(show).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    // LilyPond prints no start-repeat bar line at the beginning of a piece ("Long repeats").
    if (cmp(r.start, q(0)) > 0) starting(r.start, r.pos).repeatStart = true;
    const setTimes = (b: ReferenceBar) => {
      b.repeatEnd = true;
      if (r.times !== 2) b.repeatTimes = r.times;
    };
    if (r.alternatives.length === 0) {
      setTimes(ending(r.bodyEnd, r.pos));
      continue;
    }
    const count = r.alternatives.length;
    r.alternatives.forEach((alt, j) => {
      const numbers = j === 0 ? range(1, r.times - count + 1) : [r.times - count + 1 + j];
      const first = starting(alt.start, r.pos).index;
      const last = ending(alt.end, r.pos).index;
      for (let i = first; i <= last; i++) (bars[i] as ReferenceBar).endings = numbers;
      if (j < count - 1) setTimes(bars[last] as ReferenceBar);
    });
  }
  // A start-repeat bar line printed by hand (\bar ".|:"), for example at the very beginning where LilyPond prints
  // none by itself: it must stand where a \repeat volta starts, and the page then shows the repeat sign there.
  for (const b of repeatBars) {
    if (!repeats.some((r) => cmp(r.start, b.t) === 0))
      fail(b.pos, 'a start-repeat bar line where no \\repeat volta starts');
    starting(b.t, b.pos).repeatStart = true;
  }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
