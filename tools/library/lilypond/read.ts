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
  type Step,
  spellingMidi,
  validateReference,
} from '../fidelity/reference';
import { add, cmp, mul, type QuarterTime, q, show, sub } from '../fidelity/time';
import { LyUnsupportedError } from './errors';
import type { LyMusic, LyPitch, LyScore, Pos } from './parse';
import { parseLilyPond } from './parse';

export type { LyScore } from './parse';

const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function readLilyPond(source: string): LyScore {
  return parseLilyPond(source);
}

export function fromLilyPond(score: LyScore): ReferenceScore {
  const music = expand(score.music, score.variables, []);
  resolveOctaves(music);
  const layout = layOut(music, numberStaves(music));
  const bars = buildBars(layout);
  markRepeats(bars, layout.repeats);

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
  return validateReference({ origin: 'lilypond', bars, notes, graceNotes, playedOrder: playedOrder(bars) });
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

// ---- 3. staves ---------------------------------------------------------------------------------------------------

interface Staves {
  byNode: Map<LyMusic, number>;
  byName: Map<string, number>;
}

/** Staff numbers in source order (1 = the first staff, the upper staff of a piano score). */
function numberStaves(root: LyMusic): Staves {
  const staves: Staves = { byNode: new Map(), byName: new Map() };
  let count = 0;
  const walk = (m: LyMusic): void => {
    if (m.kind === 'context' && m.type === 'Staff') {
      const known = m.name !== undefined ? staves.byName.get(m.name) : undefined;
      const n = known ?? ++count;
      staves.byNode.set(m, n);
      if (m.name !== undefined) staves.byName.set(m.name, n);
    }
    if (m.kind === 'seq') m.items.forEach(walk);
    else if (m.kind === 'sim') m.branches.forEach(walk);
    else if (m.kind === 'repeat') {
      walk(m.body);
      m.alternatives.forEach(walk);
    } else if ('body' in m) walk(m.body);
  };
  walk(root);
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
  times: { t: QuarterTime; num: number; den: number; pos: Pos }[];
  partial?: QuarterTime;
  repeats: Repeat[];
  end: QuarterTime;
}

function layOut(root: LyMusic, staves: Staves): Layout {
  const out: Layout = { notes: [], graces: [], barChecks: [], times: [], repeats: [], end: q(0) };
  let cursor = q(0);
  let staff = 1;
  let voice = 'v';
  let factor = q(1);
  let grace = false;
  let unfold = false;
  let inDynamics = false;
  let anonymousVoices = 0;
  const openTies = new Map<string, ReferenceNote>(); // voice|midi -> note whose tie is still open

  const advance = (length: QuarterTime): void => {
    cursor = add(cursor, length);
    if (cmp(cursor, out.end) > 0) out.end = cursor;
  };
  const sound = (pitch: LyPitch, length: QuarterTime, tie: boolean, articulated: boolean, pos: Pos): void => {
    if (inDynamics) fail(pos, 'a note in a Dynamics context');
    const spelling = { step: STEPS[pitch.letter] as Step, alter: pitch.alter as Alter, octave: pitch.octave as number };
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
        sound(m.pitch, length, m.tie, m.post.includes('articulation'), m.pos);
        if (!grace) advance(length);
        return;
      }
      case 'chord': {
        const length = mul(m.duration.length, factor.num, factor.den);
        const articulated = m.post.includes('articulation');
        for (const n of m.notes)
          sound(n.pitch, length, m.tie || n.tie, articulated || n.post.includes('articulation'), m.pos);
        if (!grace) advance(length);
        return;
      }
      case 'rest':
        if (!grace) advance(mul(m.duration.length, factor.num, factor.den));
        return;
      case 'barCheck':
        if (!grace) out.barChecks.push({ t: cursor, pos: m.pos });
        return;
      case 'relative':
      case 'articulate':
        walk(m.body);
        return;
      case 'tuplet': {
        const saved = factor;
        factor = mul(factor, m.factor.num, m.factor.den);
        walk(m.body);
        factor = saved;
        return;
      }
      case 'grace': {
        const saved = grace;
        grace = true;
        walk(m.body);
        grace = saved;
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
          voice = m.name !== undefined ? `voice:${m.name}` : `${voice}/${++anonymousVoices}`;
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
        return;
      case 'partial':
        if (cmp(cursor, q(0)) !== 0) fail(m.pos, '\\partial after the start of the piece');
        out.partial = m.duration.length;
        return;
      case 'variable':
        fail(m.pos, `\\${m.name} (unexpanded variable)`);
        return;
      case 'key':
      case 'clef':
      case 'ottava': // display only: the entered pitch is the sounding pitch (contract §3.1)
      case 'bar':
      case 'tempo':
      case 'mark':
        return;
    }
  };
  walk(root);
  return out;
}

// ---- 5. bars -----------------------------------------------------------------------------------------------------

function buildBars(layout: Layout): ReferenceBar[] {
  const { end } = layout;
  const times = [...layout.times].sort((a, b) => cmp(a.t, b.t));
  const meterAt = (t: QuarterTime): QuarterTime => {
    let meter = q(4);
    for (const s of times) if (cmp(s.t, t) <= 0) meter = q(4 * s.num, s.den);
    return meter;
  };
  const bars: ReferenceBar[] = [];
  const push = (start: QuarterTime, length: QuarterTime) =>
    bars.push({ index: bars.length, number: '', start, length, repeatStart: false, repeatEnd: false, endings: [] });

  let start = q(0);
  if (layout.partial) {
    if (cmp(layout.partial, meterAt(q(0))) >= 0)
      fail(times[0]?.pos ?? { line: 1, column: 1 }, '\\partial as long as a bar');
    push(start, layout.partial);
    start = layout.partial;
  }
  while (cmp(start, end) < 0) {
    const meter = meterAt(start);
    const next = add(start, meter);
    const inside = times.find((s) => cmp(s.t, start) > 0 && cmp(s.t, next) < 0);
    if (inside) fail(inside.pos, `\\time ${inside.num}/${inside.den} inside a bar (at ${show(inside.t)})`);
    push(start, cmp(next, end) <= 0 ? meter : sub(end, start));
    start = next;
  }
  if (bars.length === 0) fail({ line: 1, column: 1 }, 'a score without notes');
  const first = layout.partial ? 0 : 1;
  bars.forEach((b, i) => {
    b.number = String(i + first);
  });

  const isBarLine = (t: QuarterTime) => cmp(t, end) === 0 || bars.some((b) => cmp(b.start, t) === 0);
  for (const check of layout.barChecks)
    if (!isBarLine(check.t)) fail(check.pos, `bar check at ${show(check.t)}, not on a bar line`);
  return bars;
}

function markRepeats(bars: ReferenceBar[], repeats: Repeat[]): void {
  const starting = (t: QuarterTime, pos: Pos): ReferenceBar => {
    const bar = bars.find((b) => cmp(b.start, t) === 0);
    return bar ?? fail(pos, `repeat boundary at ${show(t)} inside a bar`);
  };
  const ending = (t: QuarterTime, pos: Pos): ReferenceBar => {
    const bar = bars.find((b) => cmp(add(b.start, b.length), t) === 0);
    return bar ?? fail(pos, `repeat boundary at ${show(t)} inside a bar`);
  };
  for (const r of repeats) {
    starting(r.start, r.pos).repeatStart = true;
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
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
