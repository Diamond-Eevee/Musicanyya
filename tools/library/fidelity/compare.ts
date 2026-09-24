// The comparator (data-model.md §4). Exact rational equality is the only match; there are no tolerances. Bars are
// paired by printed bar number through the alignment the record declares, never searched for, so a missing bar is
// reported once. Differences name the bar and the position in it (quarter notes after the bar line), sorted by bar,
// then position, so a re-run gives identical output.
import {
  type Alter,
  noteName,
  type ReferenceBar,
  type ReferenceGraceNote,
  type ReferenceNote,
  type ReferenceScore,
  type Spelling,
  type Step,
  spellingMidi,
  spellingName,
} from './reference';
import { add, cmp, type QuarterTime, q, show, sub } from './time';

export interface NoteRef {
  at: QuarterTime;
  midi: number;
  name: string;
}

export type Difference =
  | { kind: 'missing'; bar: string; note: NoteRef }
  | { kind: 'extra'; bar: string; note: NoteRef }
  | { kind: 'pitch'; bar: string; at: QuarterTime; item: number; source: number }
  | { kind: 'duration'; bar: string; at: QuarterTime; midi: number; item: QuarterTime; source: QuarterTime }
  | { kind: 'spelling'; bar: string; at: QuarterTime; item: string; source: string }
  | { kind: 'barCount'; item: number; source: number }
  | { kind: 'barLength'; bar: string; item: QuarterTime; source: QuarterTime }
  | { kind: 'repeat'; bar: string; item: string; source: string }
  | { kind: 'playedOrder'; position: number; item: string; source: string }
  | { kind: 'grace'; bar: string; detail: string }
  | { kind: 'melody'; bar: string; index: number; item: string; source: string }
  | { kind: 'melodyRhythm'; bar: string; index: number; note: string; item: string; source: string };

export type Aspect =
  | 'barCount'
  | 'barLengths'
  | 'repeats'
  | 'playedOrder'
  | 'pitch'
  | 'onset'
  | 'duration'
  | 'spelling'
  | 'graceNotes'
  | 'melody';

export interface Alignment {
  /** "all", "N" or "N-M" in printed bar numbers; both ranges have the same length. */
  itemBars: string;
  sourceBars: string;
  staff?: number;
  voice?: string;
  sourceStaff?: number;
  sourceVoice?: string;
  transpose?: string;
}

/** How the sound file relates to its notation (source manifest, research R5). */
export interface SoundOptions {
  order: 'written' | 'played';
  articulate: boolean;
}

export interface SoundResult {
  differences: Difference[];
  /** "notation only" for an \articulate source: the MIDI step could not check durations (analyze A6). */
  durations: 'compared' | 'notation only';
}

// ---- sorting -------------------------------------------------------------------------------------------------------

interface Keyed {
  order: number;
  at: QuarterTime;
  diff: Difference;
}
function sorted(list: Keyed[]): Difference[] {
  return list
    .map((k, i) => ({ ...k, i }))
    .sort((a, b) => a.order - b.order || cmp(a.at, b.at) || a.i - b.i)
    .map((k) => k.diff);
}

// ---- bar pairing ---------------------------------------------------------------------------------------------------

interface BarPair {
  /** Sort position of the pair. */
  order: number;
  /** The bar number shown in differences (item numbering). */
  label: string;
  item?: ReferenceBar;
  source?: ReferenceBar;
}

function parseRange(range: string): [number, number] | 'all' {
  if (range === 'all') return 'all';
  const m = /^(\d+)(?:-(\d+))?$/.exec(range);
  if (!m) throw new Error(`alignment range "${range}" is not "all", "N" or "N-M"`);
  return [Number(m[1]), Number(m[2] ?? m[1])];
}

function pairBars(item: ReferenceScore, source: ReferenceScore, alignment: Alignment): BarPair[] {
  const itemRange = parseRange(alignment.itemBars);
  const sourceRange = parseRange(alignment.sourceBars);
  if ((itemRange === 'all') !== (sourceRange === 'all'))
    throw new Error(`alignment ${alignment.itemBars} -> ${alignment.sourceBars}: both ranges must be "all" or numbers`);
  let offset = 0;
  const inRange = (range: [number, number] | 'all', bar: ReferenceBar) =>
    range === 'all' || (Number(bar.number) >= range[0] && Number(bar.number) <= range[1]);
  if (itemRange !== 'all' && sourceRange !== 'all') {
    if (itemRange[1] - itemRange[0] !== sourceRange[1] - sourceRange[0])
      throw new Error(`alignment ${alignment.itemBars} -> ${alignment.sourceBars}: the ranges differ in length`);
    offset = sourceRange[0] - itemRange[0];
  }
  // Key = printed number in item numbering, plus the occurrence for a number printed twice (a split bar).
  const keyed = (bars: ReferenceBar[], range: [number, number] | 'all', shift: number) => {
    const seen = new Map<string, number>();
    const out = new Map<string, ReferenceBar>();
    for (const bar of bars) {
      if (!inRange(range, bar)) continue;
      let label = bar.number;
      if (shift !== 0) {
        if (!/^\d+$/.test(label)) throw new Error(`bar "${label}" cannot be shifted by the alignment`);
        label = String(Number(label) - shift);
      }
      const k = seen.get(label) ?? 0;
      seen.set(label, k + 1);
      out.set(`${label}#${k}`, bar);
    }
    return out;
  };
  const items = keyed(item.bars, itemRange, 0);
  const sources = keyed(source.bars, sourceRange, offset);
  const pairs: BarPair[] = [];
  for (const [key, bar] of items)
    pairs.push({ order: 0, label: bar.number, item: bar, ...optional('source', sources.get(key)) });
  // A source-only bar goes after the pair that holds the source bar before it.
  let at = -1;
  for (const [key, bar] of sources) {
    const found = pairs.findIndex((p) => p.source === bar);
    if (found >= 0) at = found;
    else pairs.splice(++at, 0, { order: 0, label: key.slice(0, key.indexOf('#')), source: bar });
  }
  pairs.forEach((p, i) => {
    p.order = i + 1;
  });
  return pairs;
}

function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

// ---- compare -------------------------------------------------------------------------------------------------------

export function compare(
  item: ReferenceScore,
  source: ReferenceScore,
  aspects: Aspect[],
  alignment: Alignment,
): Difference[] {
  const want = new Set(aspects);
  const pairs = pairBars(item, source, alignment);
  const out: Keyed[] = [];

  if (want.has('barCount')) {
    const itemCount = pairs.filter((p) => p.item).length;
    const sourceCount = pairs.filter((p) => p.source).length;
    if (itemCount !== sourceCount)
      out.push({ order: 0, at: q(0), diff: { kind: 'barCount', item: itemCount, source: sourceCount } });
  }
  if (want.has('playedOrder')) {
    const d = comparePlayedOrder(item, source, pairs);
    if (d) out.push({ order: 0, at: q(0), diff: d });
  }
  const noteAspects = want.has('pitch') || want.has('onset') || want.has('duration') || want.has('spelling');
  for (const pair of pairs) {
    const { item: ib, source: sb, label, order } = pair;
    if (ib && sb && want.has('barLengths') && cmp(ib.length, sb.length) !== 0)
      out.push({ order, at: q(0), diff: { kind: 'barLength', bar: label, item: ib.length, source: sb.length } });
    if (ib && sb && want.has('repeats'))
      for (const [i, s] of repeatViews(ib, sb))
        out.push({ order, at: q(0), diff: { kind: 'repeat', bar: label, item: i, source: s } });
    if (noteAspects) {
      const itemNotes = ib ? inBar(item.notes, ib) : [];
      const sourceNotes = sb ? inBar(source.notes, sb) : [];
      for (const d of compareBarNotes(itemNotes, sourceNotes, label, want, noRule)) out.push({ order, ...d });
    }
    if (want.has('graceNotes')) {
      const ig = ib ? gracesInBar(item.graceNotes, ib) : [];
      const sg = sb ? gracesInBar(source.graceNotes, sb) : [];
      for (const d of compareGraces(ig, sg, label)) out.push({ order, ...d });
    }
  }
  return sorted(out);
}

function repeatViews(item: ReferenceBar, source: ReferenceBar): [string, string][] {
  const out: [string, string][] = [];
  if (item.repeatStart !== source.repeatStart)
    out.push([
      item.repeatStart ? 'repeat start' : 'no repeat start',
      source.repeatStart ? 'repeat start' : 'no repeat start',
    ]);
  const end = (b: ReferenceBar) =>
    b.repeatEnd ? `repeat end${b.repeatTimes ? ` x${b.repeatTimes}` : ''}` : 'no repeat end';
  if (end(item) !== end(source)) out.push([end(item), end(source)]);
  const ending = (b: ReferenceBar) => (b.endings.length ? `ending ${b.endings.join(', ')}` : 'no ending');
  if (ending(item) !== ending(source)) out.push([ending(item), ending(source)]);
  return out;
}

function comparePlayedOrder(item: ReferenceScore, source: ReferenceScore, pairs: BarPair[]): Difference | undefined {
  if (!item.playedOrder || !source.playedOrder) throw new Error('playedOrder needs the played order on both sides');
  const labelOf = new Map<ReferenceBar, string>();
  for (const p of pairs) {
    if (p.item) labelOf.set(p.item, p.label);
    if (p.source) labelOf.set(p.source, p.label);
  }
  const seq = (s: ReferenceScore, order: number[]) =>
    order.map((i) => labelOf.get(s.bars[i] as ReferenceBar)).filter((l): l is string => l !== undefined);
  const a = seq(item, item.playedOrder);
  const b = seq(source, source.playedOrder);
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return { kind: 'playedOrder', position: i, item: a[i] ?? 'end', source: b[i] ?? 'end' };
  return undefined;
}

// ---- notes in one bar ----------------------------------------------------------------------------------------------

interface BarNote {
  at: QuarterTime;
  note: ReferenceNote;
}

function inBar(notes: ReferenceNote[], bar: ReferenceBar): BarNote[] {
  return notes.filter((n) => n.bar === bar.index).map((note) => ({ at: sub(note.onset, bar.start), note }));
}

/** Which duration differences the MIDI step may accept (research R5); `noRule` accepts none. */
type DurationRule = (item: BarNote, source: BarNote) => boolean;
const noRule: DurationRule = () => false;

function compareBarNotes(
  items: BarNote[],
  sources: BarNote[],
  bar: string,
  want: Set<Aspect>,
  acceptDuration: DurationRule,
  acceptMissingItem: (n: BarNote) => boolean = () => false,
): { at: QuarterTime; diff: Difference }[] {
  const out: { at: QuarterTime; diff: Difference }[] = [];
  const freeSources = [...sources];
  const unmatched: BarNote[] = [];
  const take = (pred: (s: BarNote) => boolean): BarNote | undefined => {
    const i = freeSources.findIndex(pred);
    return i < 0 ? undefined : (freeSources.splice(i, 1)[0] as BarNote);
  };
  // 1. exact matches on (position, pitch), preferring the same staff
  for (const it of items) {
    const same = (s: BarNote) => cmp(s.at, it.at) === 0 && s.note.midi === it.note.midi;
    const match = take((s) => same(s) && s.note.staff === it.note.staff) ?? take(same);
    if (!match) {
      unmatched.push(it);
      continue;
    }
    if (want.has('duration') && cmp(it.note.duration, match.note.duration) !== 0 && !acceptDuration(it, match))
      out.push({
        at: it.at,
        diff: {
          kind: 'duration',
          bar,
          at: it.at,
          midi: it.note.midi,
          item: it.note.duration,
          source: match.note.duration,
        },
      });
    if (want.has('spelling') && it.note.spelling && match.note.spelling) {
      const a = spellingName(it.note.spelling);
      const b = spellingName(match.note.spelling);
      if (a !== b) out.push({ at: it.at, diff: { kind: 'spelling', bar, at: it.at, item: a, source: b } });
    }
  }
  // 2. a remaining note at the same position and staff as a remaining source note is one wrong pitch
  const extras: BarNote[] = [];
  for (const it of unmatched) {
    const sameStaff = (s: BarNote) =>
      s.note.staff === undefined || it.note.staff === undefined || s.note.staff === it.note.staff;
    const other = take((s) => cmp(s.at, it.at) === 0 && sameStaff(s));
    if (other) {
      if (want.has('pitch'))
        out.push({ at: it.at, diff: { kind: 'pitch', bar, at: it.at, item: it.note.midi, source: other.note.midi } });
    } else extras.push(it);
  }
  // 3. the rest is extra (in the item only) or missing (in the source only)
  if (want.has('pitch') || want.has('onset')) {
    for (const it of extras)
      if (!acceptMissingItem(it)) out.push({ at: it.at, diff: { kind: 'extra', bar, note: ref(it) } });
    for (const s of freeSources) out.push({ at: s.at, diff: { kind: 'missing', bar, note: ref(s) } });
  }
  return out;
}

const ref = (n: BarNote): NoteRef => ({ at: n.at, midi: n.note.midi, name: noteName(n.note) });

// ---- grace notes ---------------------------------------------------------------------------------------------------

interface BarGrace {
  at: QuarterTime;
  grace: ReferenceGraceNote;
}
function gracesInBar(graces: ReferenceGraceNote[], bar: ReferenceBar): BarGrace[] {
  return graces.filter((g) => g.bar === bar.index).map((grace) => ({ at: sub(grace.before, bar.start), grace }));
}

/** Grace notes as notation: pitch, the note they precede, and their order (research R5 rule 4). */
function compareGraces(items: BarGrace[], sources: BarGrace[], bar: string): { at: QuarterTime; diff: Difference }[] {
  const out: { at: QuarterTime; diff: Difference }[] = [];
  const groups = new Map<string, { at: QuarterTime; item: BarGrace[]; source: BarGrace[] }>();
  const group = (g: BarGrace) => {
    const k = show(g.at);
    const found = groups.get(k) ?? { at: g.at, item: [], source: [] };
    groups.set(k, found);
    return found;
  };
  for (const g of items) group(g).item.push(g);
  for (const g of sources) group(g).source.push(g);
  const name = (g: BarGrace) => noteName(g.grace);
  for (const { at, item, source } of [...groups.values()].sort((a, b) => cmp(a.at, b.at))) {
    const beat = `beat ${show(at)}`;
    for (let i = 0; i < Math.max(item.length, source.length); i++) {
      const a = item[i];
      const b = source[i];
      let detail: string | undefined;
      if (a && !b) detail = `extra grace note ${name(a)} before ${beat}`;
      else if (!a && b) detail = `missing grace note ${name(b)} before ${beat}`;
      else if (a && b && name(a) !== name(b)) detail = `grace note ${name(a)} before ${beat}, source has ${name(b)}`;
      if (detail) out.push({ at, diff: { kind: 'grace', bar, detail } });
    }
  }
  return out;
}

// ---- the MIDI step (data-model.md §4.1a step 2) --------------------------------------------------------------------

/**
 * Compares a notation reading with the MIDI LilyPond made from the same file: pitch, onset and duration of every
 * non-grace note, bar by bar, with bars taken from the notation reading (in played order when the MIDI unfolds the
 * repeats). A MIDI note shorter than written is accepted only where the notation shows why (research R5): a following
 * grace group (whose MIDI notes are set aside), an articulation, or a unison with another voice.
 */
export function compareSound(notation: ReferenceScore, sound: ReferenceScore, options: SoundOptions): SoundResult {
  const want = new Set<Aspect>(options.articulate ? ['pitch', 'onset'] : ['pitch', 'onset', 'duration']);
  // The notation laid out on the MIDI's timeline: written order, or one entry per pass in played order.
  const order = options.order === 'played' ? notation.playedOrder : notation.bars.map((b) => b.index);
  if (!order) throw new Error("compareSound: played order needs the notation reading's playedOrder");
  const passes: { bar: ReferenceBar; start: QuarterTime }[] = [];
  let t = q(0);
  for (const i of order) {
    const bar = notation.bars[i] as ReferenceBar;
    passes.push({ bar, start: t });
    t = add(t, bar.length);
  }
  const passOf = (onset: QuarterTime) => {
    for (let i = passes.length - 1; i >= 0; i--) if (cmp((passes[i] as (typeof passes)[0]).start, onset) <= 0) return i;
    return -1;
  };

  // Grace notes sound in the MIDI before their principal note; set those MIDI notes aside first.
  const midiNotes = sound.notes.map((note) => ({ note, grace: false }));
  const graceStart = new Map<string, QuarterTime>(); // played onset of a principal note -> start of its grace group
  const out: Keyed[] = [];
  passes.forEach((pass) => {
    const graces = notation.graceNotes.filter((g) => g.bar === pass.bar.index);
    const byPrincipal = new Map<string, ReferenceGraceNote[]>();
    for (const g of graces) {
      const k = show(g.before);
      byPrincipal.set(k, [...(byPrincipal.get(k) ?? []), g]);
    }
    for (const group of byPrincipal.values()) {
      const principal = add(pass.start, sub((group[0] as ReferenceGraceNote).before, pass.bar.start));
      let earliest = principal;
      for (const g of [...group].reverse()) {
        const candidates = midiNotes.filter(
          (m) => !m.grace && m.note.midi === g.midi && cmp(m.note.onset, principal) < 0,
        );
        const last = candidates.sort((a, b) => cmp(b.note.onset, a.note.onset))[0];
        if (!last) continue; // reported below: the principal note or grace is then unexplained
        last.grace = true;
        if (cmp(last.note.onset, earliest) < 0) earliest = last.note.onset;
      }
      graceStart.set(show(principal), earliest);
    }
  });

  // Unisons: notation notes of one pitch that overlap in time (two voices on one key).
  const notationNotes = passes.flatMap((pass) =>
    inBar(notation.notes, pass.bar).map((n) => ({ ...n, played: add(pass.start, n.at), pass })),
  );
  const endOf = (n: { played: QuarterTime; note: ReferenceNote }) => add(n.played, n.note.duration);
  const unisonWith = (n: (typeof notationNotes)[0]) =>
    notationNotes.filter(
      (o) => o !== n && o.note.midi === n.note.midi && cmp(o.played, endOf(n)) < 0 && cmp(n.played, endOf(o)) < 0,
    );
  /** Every note linked to `n` through overlapping notes on the same key (a held note under repeated strikes). */
  const unisonChain = (n: (typeof notationNotes)[0]) => {
    const chain = new Set([n]);
    const queue = [n];
    for (let x = queue.shift(); x; x = queue.shift())
      for (const o of unisonWith(x))
        if (!chain.has(o)) {
          chain.add(o);
          queue.push(o);
        }
    chain.delete(n);
    return [...chain];
  };

  passes.forEach((pass, p) => {
    const items = notationNotes.filter((n) => n.pass === pass);
    const sources: BarNote[] = midiNotes
      .filter((m) => !m.grace && passOf(m.note.onset) === p)
      .map((m) => ({ at: sub(m.note.onset, pass.start), note: m.note }));
    const played = (n: BarNote) => add(pass.start, n.at);
    const acceptDuration: DurationRule = (it, s) => {
      if (cmp(s.note.duration, it.note.duration) < 0) {
        if (it.note.articulated) return true;
        const writtenEnd = add(played(it), it.note.duration);
        const start = graceStart.get(show(writtenEnd));
        if (start && cmp(add(played(s), s.note.duration), start) === 0) return true;
      }
      const self = items.find((x) => x.note === it.note);
      const unison = self ? unisonChain(self) : [];
      if (unison.length === 0) return false;
      // One MIDI channel has one state per key: merged (sounds to the end of an overlapping note) or cut (ends where
      // the next note on that key starts), anywhere along the chain of overlapping notes on that key.
      const ends = [endOf(self as (typeof items)[0]), ...unison.map(endOf), ...unison.map((u) => u.played)];
      const soundEnd = add(played(s), s.note.duration);
      return ends.some((e) => cmp(e, soundEnd) === 0);
    };
    const acceptMissingItem = (n: BarNote) => {
      const self = items.find((x) => x.note === n.note);
      // A note merged into an overlapping unison note has no MIDI note of its own.
      return (
        self !== undefined &&
        unisonWith(self).some(
          (u) => cmp(u.played, self.played) < 0 || (cmp(u.played, self.played) === 0 && u.note !== self.note),
        )
      );
    };
    for (const d of compareBarNotes(items, sources, pass.bar.number, want, acceptDuration, acceptMissingItem))
      out.push({ order: p + 1, ...d });
  });
  const leftover = midiNotes.filter((m) => !m.grace && passOf(m.note.onset) < 0);
  for (const m of leftover)
    out.push({
      order: 0,
      at: m.note.onset,
      diff: {
        kind: 'missing',
        bar: 'before bar 1',
        note: { at: m.note.onset, midi: m.note.midi, name: noteName(m.note) },
      },
    });
  return { differences: sorted(out), durations: options.articulate ? 'notation only' : 'compared' };
}

// ---- the melody quote (data-model.md §4.4, research R7) -----------------------------------------------------------

export interface MelodyOptions {
  /** The item's `departures` name a rhythmic change over these bars: rhythm differences are listed, not counted. */
  allowRhythm: boolean;
  /** Compare the spelling of same-sounding notes too (the record lists the `spelling` aspect). */
  spelling: boolean;
}

export interface MelodyResult {
  /** Counted differences. */
  differences: Difference[];
  /** Rhythm differences the record allows (`allowRhythm`); listed in the report, never counted. */
  allowed: Difference[];
}

const LETTERS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const PERFECT: Record<number, number> = { 1: 0, 4: 5, 5: 7, 8: 12 };
const MAJOR: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 };

interface Interval {
  letters: number;
  semitones: number;
}

/** "-M2", "+P4" ... (contract audit-record.md) as signed letter steps and semitones. */
function parseInterval(text: string): Interval {
  const m = /^([+-])([PMmAd])([1-8])$/.exec(text);
  const degree = Number(m?.[3]);
  const perfect = PERFECT[degree];
  const major = MAJOR[degree];
  const quality = m?.[2];
  let semitones: number | undefined;
  if (perfect !== undefined)
    semitones = quality === 'P' ? perfect : quality === 'A' ? perfect + 1 : quality === 'd' ? perfect - 1 : undefined;
  else if (major !== undefined)
    semitones =
      quality === 'M'
        ? major
        : quality === 'm'
          ? major - 1
          : quality === 'A'
            ? major + 1
            : quality === 'd'
              ? major - 2
              : undefined;
  if (!m || semitones === undefined) throw new Error(`alignment transpose "${text}" is not an interval like "-M2"`);
  const sign = m[1] === '-' ? -1 : 1;
  return { letters: sign * (degree - 1), semitones: sign * semitones };
}

/** Letter arithmetic: move the letter, then take the alteration from the semitone distance. */
function transposeSpelling(s: Spelling, interval: Interval): Spelling {
  const from = LETTERS.indexOf(s.step) + 7 * s.octave;
  const to = from + interval.letters;
  const step = LETTERS[((to % 7) + 7) % 7] as Step;
  const octave = Math.floor(to / 7);
  const alter = spellingMidi(s) + interval.semitones - spellingMidi({ step, alter: 0, octave });
  if (alter < -2 || alter > 2) throw new Error(`transposing ${spellingName(s)} needs more than a double accidental`);
  return { step, alter: alter as Alter, octave };
}

function transposeNote(note: ReferenceNote, interval: Interval | undefined): ReferenceNote {
  if (!interval) return note;
  const moved: ReferenceNote = { ...note, midi: note.midi + interval.semitones };
  if (note.spelling) moved.spelling = transposeSpelling(note.spelling, interval);
  return moved;
}

interface MelodyNote {
  note: ReferenceNote;
  bar: ReferenceBar;
  /** Quarter notes after the start of the declared range. */
  offset: QuarterTime;
}

/** The highest note at each onset of one staff (and voice, if named) over a bar range; ties are merged by the readers. */
function melodyLine(s: ReferenceScore, range: string, staff: number, voice: string | undefined): MelodyNote[] {
  const r = parseRange(range);
  const bars = s.bars.filter((b) => r === 'all' || (Number(b.number) >= r[0] && Number(b.number) <= r[1]));
  const first = bars[0];
  if (!first) throw new Error(`alignment range "${range}" holds no bar`);
  const inRange = new Set(bars.map((b) => b.index));
  const top = new Map<string, ReferenceNote>();
  for (const n of s.notes) {
    if (!inRange.has(n.bar) || (n.staff ?? 1) !== staff || (voice !== undefined && n.voice !== voice)) continue;
    const key = show(n.onset);
    const held = top.get(key);
    if (!held || n.midi > held.midi) top.set(key, n);
  }
  return [...top.values()]
    .sort((a, b) => cmp(a.onset, b.onset))
    .map((note) => ({ note, bar: s.bars[note.bar] as ReferenceBar, offset: sub(note.onset, first.start) }));
}

/**
 * The melody quote check: the item's melody line against the source's, note by note in order. A different sounding
 * pitch (after `transpose`) is a `melody` difference; a different onset or duration is a `melodyRhythm` difference,
 * counted unless `allowRhythm`. Order must match exactly (research R7 rejects fuzzy alignment), so a note left out
 * shifts every later pair.
 */
export function compareMelody(
  item: ReferenceScore,
  source: ReferenceScore,
  alignment: Alignment,
  options: MelodyOptions,
): MelodyResult {
  const interval = alignment.transpose === undefined ? undefined : parseInterval(alignment.transpose);
  const items = melodyLine(item, alignment.itemBars, alignment.staff ?? 1, alignment.voice);
  const sources = melodyLine(source, alignment.sourceBars, alignment.sourceStaff ?? 1, alignment.sourceVoice);
  const itemRange = parseRange(alignment.itemBars);
  const sourceRange = parseRange(alignment.sourceBars);
  const shift = itemRange === 'all' || sourceRange === 'all' ? 0 : itemRange[0] - sourceRange[0];
  /** A source bar in item numbering, for a note the item lacks. */
  const itemBar = (b: ReferenceBar) => (shift === 0 ? b.number : String(Number(b.number) + shift));
  const differences: Difference[] = [];
  const allowed: Difference[] = [];
  const rhythm = (m: MelodyNote) =>
    `${show(m.note.duration)} at bar ${m.bar.number} beat ${show(sub(m.note.onset, m.bar.start))}`;
  for (let index = 0; index < Math.max(items.length, sources.length); index++) {
    const it = items[index];
    const src = sources[index];
    const moved = src && transposeNote(src.note, interval);
    if (!it || !moved) {
      const bar = it?.bar.number ?? (src ? itemBar(src.bar) : '');
      differences.push({
        kind: 'melody',
        bar,
        index,
        item: it ? noteName(it.note) : 'missing',
        source: moved ? noteName(moved) : 'missing',
      });
      continue;
    }
    const bar = it.bar.number;
    if (it.note.midi !== moved.midi) {
      differences.push({ kind: 'melody', bar, index, item: noteName(it.note), source: noteName(moved) });
      continue;
    }
    if (options.spelling && it.note.spelling && moved.spelling) {
      const a = spellingName(it.note.spelling);
      const b = spellingName(moved.spelling);
      const at = sub(it.note.onset, it.bar.start);
      if (a !== b) differences.push({ kind: 'spelling', bar, at, item: a, source: b });
    }
    if (cmp(it.offset, src.offset) !== 0 || cmp(it.note.duration, src.note.duration) !== 0)
      (options.allowRhythm ? allowed : differences).push({
        kind: 'melodyRhythm',
        bar,
        index,
        note: noteName(it.note),
        item: rhythm(it),
        source: rhythm(src),
      });
  }
  return { differences, allowed };
}

// ---- wording -------------------------------------------------------------------------------------------------------

const midiName = (midi: number) => noteName({ midi });

/** One line a musician can read: "bar 12, beat 1 1/2: pitch F4, source E4". Beats count from 0 at the bar line. */
export function describeDifference(d: Difference): string {
  const at = (bar: string, t?: QuarterTime) => `bar ${bar}${t ? `, beat ${show(t)}` : ''}`;
  switch (d.kind) {
    case 'missing':
      return `${at(d.bar, d.note.at)}: ${d.note.name} is in the source but not in the item`;
    case 'extra':
      return `${at(d.bar, d.note.at)}: ${d.note.name} is in the item but not in the source`;
    case 'pitch':
      return `${at(d.bar, d.at)}: pitch ${midiName(d.item)}, source ${midiName(d.source)}`;
    case 'duration':
      return `${at(d.bar, d.at)}: ${midiName(d.midi)} lasts ${show(d.item)} quarters, source ${show(d.source)}`;
    case 'spelling':
      return `${at(d.bar, d.at)}: written ${d.item}, source ${d.source}`;
    case 'barCount':
      return `${d.item} bars, source ${d.source}`;
    case 'barLength':
      return `${at(d.bar)}: ${show(d.item)} quarters long, source ${show(d.source)}`;
    case 'repeat':
      return `${at(d.bar)}: ${d.item}, source ${d.source}`;
    case 'playedOrder':
      return `played order differs at position ${d.position + 1}: bar ${d.item}, source bar ${d.source}`;
    case 'grace':
      return `${at(d.bar)}: ${d.detail}`;
    case 'melody':
      return `${at(d.bar)}: melody note ${d.index + 1} is ${d.item}, source ${d.source}`;
    case 'melodyRhythm':
      return `${at(d.bar)}: melody note ${d.index + 1} (${d.note}): ${d.item}, source ${d.source}`;
  }
}
