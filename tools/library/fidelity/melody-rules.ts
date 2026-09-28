// The melody rule check (feature 014, FR-014; data-model.md §4-§5, research R3-R8, contract audit-record 1.3 §3).
//
// It reads a finished two-staff MusicXML file - the right hand a single-note melody, the left hand block chords - and
// says, rule by rule, where the melody breaks the harmony rules or its level's Difficulty ladder row (`MELODY_LADDER`).
// Like the theory check, it shares nothing with the exercise generator: it imports nothing from
// `src/core/library/exercise/` (test-enforced) and reads no definition. The sounding chord at any instant is the left
// hand's notes at that instant; scale degrees come from letter arithmetic against the key in force.
//
// Readings that the research notes leave open, decided here (research.md R4/R6 notes of 2026-09-28):
// - Metre: the downbeat is strong, and so is the half bar in a metre of four (or six, eight...) beats; every other
//   position is weak.
// - A non-chord tone may stand where its level or a lower one allows it (the spec's "a level may use anything allowed
//   at a lower level"): introduction from the half bar on, beginner also on any later beat, intermediate and advanced
//   anywhere after the downbeat. A note sounding when a chord starts is judged by `chord-tone` alone.
// - Clash: the leading tone moving up by step to the tonic is exempt. FR-005 requires the raised 7th leading to the
//   tonic, and over a tonic chord it always stands a major seventh from the root; without the exemption a minor key
//   could never sound its leading tone over i, and a relative key change into minor could not be heard (FR-007).
//   A diatonic passing tone on a strong beat that is not a chord start is exempt too (T060): at introduction a
//   non-chord tone can only stand on the half bar, and without it no melody could move 5-4-3 over I.
// - Fingering is what a learner reads: a written finger sets the hand's position (thumb = the note `finger - 1` steps
//   below), an unwritten finger continues the position. A position change is a thumb-under or finger-over (a step,
//   fingers 2-4 to 1 going up, 1 to 2-4 going down), or else a shift; below intermediate, where the ladder allows no
//   thumb-under, a thumb crossing counts as a shift too. A shift is "at a section start" when it is the first note of
//   a key segment or follows a rest; introduction and beginner allow their one shift only there (T068). A leap that
//   moves the hand follows it unless it is at a chord start after at least a quarter (T066, `leapFingeringFault`).
// - Key change: the new key must be heard within two bars through a pitch class of its characteristic scale (major,
//   or harmonic minor) that the old key's characteristic scale lacks (C to A minor: G♯; A minor to C: G natural).
//   A note of the old key only (its full scale, both forms of a minor 6th/7th, minus the new key's) after the change
//   is reported as `key-change`, not `key`.
// - The left hand's chord changes per bar (`lhAttacksPerBar`) are reported under `value`, the ladder's rhythm rule.
import {
  MELODY_LADDER,
  MELODY_MIN_CLEARANCE_SEMITONES,
  MELODY_REGISTER_MIDI,
  type MelodyLadderRow,
} from '../../../src/core/defaults';
import type { Level } from '../../../src/core/library/types';
import { type KeyClaim, type Letter, readScore, type WrittenNote } from './theory';
import type { QuarterTime } from './time';

export type MelodyRule =
  | 'key'
  | 'chord-tone'
  | 'non-chord-tone'
  | 'minor-degree'
  | 'augmented-second'
  | 'cross-relation'
  | 'clash'
  | 'parallel-octaves'
  | 'register'
  | 'hand-gap'
  | 'leap'
  | 'range'
  | 'value'
  | 'shift'
  | 'fingering'
  | 'ending'
  | 'key-change'
  | 'variation'
  | 'static'
  | 'doubled';

export interface MelodyFinding {
  itemId: string;
  /** The printed bar number. */
  bar: number;
  /** 1-based, in quarter beats (2.5 = the eighth after beat 2). */
  beat: number;
  rule: MelodyRule;
  /** One sentence naming the notes and the chord. */
  message: string;
}

export interface MelodyCheckInput {
  itemId: string;
  /** The generated MusicXML. */
  xml: string;
  level: Level;
  /** The key per bar range, from the claim table or the title: each entry holds from `firstBar` to the next entry. */
  keys: { firstBar: number; key: KeyClaim }[];
}

// ---- tables ------------------------------------------------------------------------------------------------------

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SCALE_STEPS: Record<KeyClaim['mode'], readonly number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  minor: [2, 1, 2, 2, 1, 2, 2],
};
const OCTAVE = 12;
const LETTERS_PER_OCTAVE = 7;
const SIXTH = 6;
const SEVENTH = 7;
const FIFTH = 5;
const TONIC = 1;
/** Pitch classes of the black keys. */
const BLACK_KEYS: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);
/** Minor second, major seventh, minor ninth (and their compounds): the clash intervals, mod 12. */
const CLASH_INTERVALS: ReadonlySet<number> = new Set([1, 11]);
/** Thirds and fifths above a triad's root, in semitones. */
const THIRDS: ReadonlySet<number> = new Set([3, 4]);
const FIFTHS: ReadonlySet<number> = new Set([6, 7, 8]);
const MAJOR_THIRD = 4;
const MINOR_THIRD = 3;
const PERFECT_FIFTH = 7;
const THUMB = 1;
const CROSSING_FINGERS: ReadonlySet<number> = new Set([2, 3, 4]);
const FINGERS = 5;
/** Widest leap a thumb crossing may span: a third, in diatonic steps (T066, research R6 amendment). */
const CROSSING_LEAP_MAX_STEPS = 2;
/** Widest span from the thumb to finger 2 on a leap: a fourth, in diatonic steps (T066). */
const THUMB_TO_SECOND_MAX_STEPS = 3;
/** The shortest note after which the hand may lift to a new position at a chord start (T066), in quarters. */
const SHIFT_MIN_QUARTERS = 1;
/** Bars within which a key change must be heard (FR-007, research R8). */
const KEY_CHANGE_AUDIBLE_BARS = 2;
/** A pitch held or repeated for more than this many bars is static (FR-008). */
const STATIC_BARS_MAX = 2;
const EIGHTH_BEATS = 0.5;
const QUARTER_NOTES_PER_WHOLE = 4;
const DEFAULT_METRE = { beats: 4, beatType: 4 };
const RULE_ORDER: readonly MelodyRule[] = [
  'doubled',
  'key',
  'key-change',
  'chord-tone',
  'non-chord-tone',
  'minor-degree',
  'augmented-second',
  'cross-relation',
  'clash',
  'parallel-octaves',
  'register',
  'hand-gap',
  'leap',
  'range',
  'value',
  'shift',
  'fingering',
  'static',
  'ending',
  'variation',
];

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const letterIndex = (l: Letter): number => LETTERS.indexOf(l);
const beatsOf = (t: QuarterTime): number => t.num / t.den;

// ---- keys and degrees --------------------------------------------------------------------------------------------

const tonicPc = (key: KeyClaim): number => mod(NATURAL_SEMITONES[key.tonicLetter] + key.tonicAlter, OCTAVE);

/** 1-7: the scale degree of a letter, counted from the tonic's letter. */
const degreeOf = (key: KeyClaim, letter: Letter): number =>
  mod(letterIndex(letter) - letterIndex(key.tonicLetter), LETTERS_PER_OCTAVE) + 1;

/** The pitch class of scale degree `degree` in the key's natural scale (major, or natural minor). */
function naturalPc(key: KeyClaim, degree: number): number {
  const steps = SCALE_STEPS[key.mode];
  let semitones = 0;
  for (let i = 0; i < degree - 1; i++) semitones += steps[i] as number;
  return mod(tonicPc(key) + semitones, OCTAVE);
}

/** Every pitch class the key uses: its natural scale, plus the raised 6th and 7th of a minor key. */
function fullScale(key: KeyClaim): Set<number> {
  const pcs = new Set<number>();
  for (let d = 1; d <= LETTERS_PER_OCTAVE; d++) pcs.add(naturalPc(key, d));
  if (key.mode === 'minor') {
    pcs.add(mod(naturalPc(key, SIXTH) + 1, OCTAVE));
    pcs.add(mod(naturalPc(key, SEVENTH) + 1, OCTAVE));
  }
  return pcs;
}

/** The scale that names the key by ear: major, or harmonic minor (natural 6th, raised 7th). */
function characteristicScale(key: KeyClaim): Set<number> {
  const pcs = new Set<number>();
  for (let d = 1; d <= LETTERS_PER_OCTAVE; d++) {
    const raise = key.mode === 'minor' && d === SEVENTH ? 1 : 0;
    pcs.add(mod(naturalPc(key, d) + raise, OCTAVE));
  }
  return pcs;
}

const tonicTriad = (key: KeyClaim): Set<number> => {
  const t = tonicPc(key);
  return new Set([
    t,
    mod(t + (key.mode === 'major' ? MAJOR_THIRD : MINOR_THIRD), OCTAVE),
    mod(t + PERFECT_FIFTH, OCTAVE),
  ]);
};

const parallel = (key: KeyClaim): KeyClaim => ({ ...key, mode: key.mode === 'major' ? 'minor' : 'major' });

// ---- the notes ---------------------------------------------------------------------------------------------------

interface Note {
  step: Letter;
  alter: number;
  octave: number;
  midi: number;
  pc: number;
  /** Letter position across octaves: C4 is 28, D4 29, C5 35 (a step is 1, a third 2). */
  diat: number;
  onset: number;
  end: number;
  /** The written duration of the first note of a tie chain. */
  written: number;
  bar: number;
  finger?: number;
  tied: boolean;
}

const toNote = (w: WrittenNote): Note => ({
  step: w.step,
  alter: w.alter,
  octave: w.octave,
  midi: w.midi,
  pc: mod(w.midi, OCTAVE),
  diat: w.octave * LETTERS_PER_OCTAVE + letterIndex(w.step),
  onset: beatsOf(w.onset),
  end: beatsOf(w.end),
  written: beatsOf(w.end) - beatsOf(w.onset),
  bar: Number(w.bar),
  ...(w.finger !== undefined ? { finger: w.finger } : {}),
  tied: w.tiedFromPrevious,
});

const accidental = (alter: number): string => (alter < 0 ? '♭'.repeat(-alter) : '♯'.repeat(alter));
const name = (n: Note): string => `${n.step}${accidental(n.alter)}${n.octave}`;
const names = (ns: readonly Note[]): string =>
  [...ns]
    .sort((a, b) => a.midi - b.midi)
    .map(name)
    .join(' ');

/** Two or more left-hand notes form a triad on the note whose third and fifth are both in the set. */
function triadRoot(chord: readonly Note[]): Note | undefined {
  const pcs = [...new Set(chord.map((n) => n.pc))];
  if (pcs.length !== 3) return undefined;
  return chord.find((r) => {
    const above = pcs.filter((pc) => pc !== r.pc).map((pc) => mod(pc - r.pc, OCTAVE));
    return above.some((i) => THIRDS.has(i)) && above.some((i) => FIFTHS.has(i));
  });
}

// ---- the check ---------------------------------------------------------------------------------------------------

export function checkMelodyRules(input: MelodyCheckInput): MelodyFinding[] {
  const reading = readScore(input.xml);
  const ladder: MelodyLadderRow = MELODY_LADDER[input.level];
  const register = MELODY_REGISTER_MIDI[input.level];
  const metre = reading.metre ?? DEFAULT_METRE;
  const barLength = (metre.beats * QUARTER_NOTES_PER_WHOLE) / metre.beatType;
  const barStart = new Map(reading.barStarts.map((b) => [b.bar, beatsOf(b.start)]));
  const startOf = (bar: number): number => barStart.get(bar) ?? (bar - 1) * barLength;
  const barAt = (t: number): number =>
    reading.barStarts.filter((b) => beatsOf(b.start) <= t).pop()?.bar ?? Number(reading.firstBar);
  const positionIn = (t: number): number => t - startOf(barAt(t));

  const segments = [...input.keys].sort((a, b) => a.firstBar - b.firstBar);
  if (segments.length === 0) throw new Error(`${input.itemId}: the melody check needs the key of the first bar`);
  const segmentIndexAt = (bar: number): number => {
    let index = 0;
    segments.forEach((s, i) => {
      if (s.firstBar <= bar) index = i;
    });
    return index;
  };
  const keyAt = (bar: number): KeyClaim => (segments[segmentIndexAt(bar)] as (typeof segments)[number]).key;

  // The left hand, and the right hand's melody: its top note at every onset, tie chains joined.
  const left = reading.notes.filter((w) => w.hand === 'left').map(toNote);
  const rightAll = reading.notes.filter((w) => w.hand === 'right').map(toNote);
  const rightGroups = new Map<number, Note[]>();
  for (const r of rightAll) if (!r.tied) rightGroups.set(r.onset, [...(rightGroups.get(r.onset) ?? []), r]);
  const melody: Note[] = [];
  for (const r of [...rightAll].sort((a, b) => a.onset - b.onset || b.midi - a.midi)) {
    const last = melody[melody.length - 1];
    if (r.tied && last && last.midi === r.midi && last.end === r.onset) {
      last.end = r.end;
      continue;
    }
    if (last && last.onset === r.onset) continue;
    melody.push({ ...r });
  }

  const out: MelodyFinding[] = [];
  const report = (rule: MelodyRule, t: number, message: string): void => {
    const bar = barAt(t);
    out.push({ itemId: input.itemId, bar, beat: 1 + t - startOf(bar), rule, message });
  };

  const sounding = (notes: readonly Note[], t: number): Note[] => notes.filter((n) => n.onset <= t && t < n.end);
  const chordStarts = [...new Set(left.filter((l) => !l.tied).map((l) => l.onset))].sort((a, b) => a - b);
  const isChordStart = (t: number): boolean => chordStarts.includes(t);
  /** The left hand's chord at `t`: what sounds, or - in a left-hand rest - the chord last struck. */
  const chordAt = (t: number): Note[] => {
    const now = sounding(left, t);
    if (now.length > 0) return now;
    const last = chordStarts.filter((s) => s <= t).pop();
    return last === undefined ? [] : sounding(left, last);
  };
  const melodyAt = (t: number): Note | undefined => melody.find((m) => m.onset <= t && t < m.end);
  const hasPc = (chord: readonly Note[], pc: number): boolean => chord.some((c) => c.pc === pc);
  const isStrong = (t: number): boolean => {
    const pos = positionIn(t);
    const halfBarStrong = metre.beats >= 4 && metre.beats % 2 === 0;
    return pos === 0 || (halfBarStrong && pos === barLength / 2);
  };
  const next = (i: number): Note | undefined => melody[i + 1];
  const prev = (i: number): Note | undefined => melody[i - 1];
  const leadsToTonic = (m: Note, following: Note | undefined): boolean => {
    const key = keyAt(m.bar);
    return (
      m.pc === mod(tonicPc(key) - 1, OCTAVE) &&
      following !== undefined &&
      following.pc === tonicPc(key) &&
      following.diat === m.diat + 1
    );
  };

  // doubled: both hands strike the same block chord at one onset (FR-001); a single closing tonic chord is allowed.
  const lastRightOnset = Math.max(...rightAll.map((r) => r.onset));
  const lastLeftStart = chordStarts[chordStarts.length - 1];
  for (const [t, group] of rightGroups) {
    if (group.length < 2) continue;
    const struck = left.filter((l) => !l.tied && l.onset === t);
    if (struck.length < 2) continue;
    const rightPcs = new Set(group.map((g) => g.pc));
    const leftPcs = new Set(struck.map((l) => l.pc));
    if (rightPcs.size !== leftPcs.size || [...rightPcs].some((pc) => !leftPcs.has(pc))) continue;
    const key = keyAt(barAt(t));
    const tonic = tonicTriad(key);
    const closing =
      t === lastRightOnset &&
      t === lastLeftStart &&
      leftPcs.size === tonic.size &&
      [...leftPcs].every((pc) => tonic.has(pc));
    if (!closing) report('doubled', t, `both hands strike ${names(struck)} together`);
  }

  // key and key-change (old-key notes after a change).
  melody.forEach((m) => {
    const segment = segmentIndexAt(m.bar);
    const key = keyAt(m.bar);
    if (fullScale(key).has(m.pc)) return;
    if (segment > 0) {
      const old = (segments[segment - 1] as (typeof segments)[number]).key;
      const newScale = fullScale(key);
      if (fullScale(old).has(m.pc) && !newScale.has(m.pc)) {
        report('key-change', m.onset, `${name(m)} belongs to the old key only, after the change`);
        return;
      }
    }
    // A chord borrowed from the parallel mode (a same-tonic drill) lends its mode to the melody over it.
    const chord = chordAt(m.onset);
    const borrowed = chord.some((c) => !fullScale(key).has(c.pc));
    if (borrowed && fullScale(parallel(key)).has(m.pc)) return;
    report('key', m.onset, `${name(m)} is not in the key`);
  });

  // key-change: the first note after a change, audibility within two bars, old-key notes held across it.
  segments.forEach((segment, index) => {
    if (index === 0) return;
    const old = (segments[index - 1] as (typeof segments)[number]).key;
    const key = segment.key;
    const start = startOf(segment.firstBar);
    const first = melodyAt(start) ?? melody.find((m) => m.onset >= start);
    if (first && !tonicTriad(key).has(first.pc))
      report('key-change', Math.max(start, first.onset), `${name(first)} is not in the new tonic chord`);
    const oldCharacteristic = characteristicScale(old);
    const heard = [...characteristicScale(key)].filter((pc) => !oldCharacteristic.has(pc));
    const until = startOf(segment.firstBar + KEY_CHANGE_AUDIBLE_BARS);
    const audible =
      heard.length === 0 || melody.some((m) => m.onset >= start && m.onset < until && heard.includes(m.pc));
    if (!audible)
      report(
        'key-change',
        start,
        `no melody note of the new key only in the ${KEY_CHANGE_AUDIBLE_BARS} bars after the change`,
      );
    const oldOnly = [...fullScale(old)].filter((pc) => !fullScale(key).has(pc));
    for (const m of melody)
      if (m.onset < start && m.end > start && oldOnly.includes(m.pc))
        report('key-change', start, `${name(m)} of the old key is held across the change`);
  });

  // chord-tone: the melody note sounding when a chord starts is a note of that chord (FR-006).
  for (const t of chordStarts) {
    const m = melodyAt(t);
    const chord = sounding(left, t);
    if (m && !hasPc(chord, m.pc)) report('chord-tone', t, `${name(m)} is not in the chord ${names(chord)}`);
  }

  // non-chord-tone: passing or neighbour tones only, approached and left by step, where the level allows, in short runs.
  const isNct = (m: Note): boolean => !isChordStart(m.onset) && !hasPc(chordAt(m.onset), m.pc);
  const allowedAt = (t: number): boolean => {
    const pos = positionIn(t);
    if (pos <= 0) return false;
    if (input.level === 'introduction') return pos >= barLength / 2;
    if (input.level === 'beginner') return pos >= barLength / 2 || Number.isInteger(pos);
    return true;
  };
  let run: number[] = [];
  melody.forEach((m, i) => {
    if (!isNct(m)) {
      run = [];
      return;
    }
    run.push(i);
    const before = prev(i);
    const after = next(i);
    const chord = names(chordAt(m.onset));
    const joined = (a: Note | undefined, b: Note | undefined): boolean =>
      a !== undefined && b !== undefined && a.end === b.onset && Math.abs(a.diat - b.diat) === 1;
    // A run of two or more is a passing run: from the chord note before it to the one after, all one way.
    const line = [prev(run[0] as number), ...run.map((r) => melody[r] as Note), after];
    const moves = line.slice(1).map((n, k) => Math.sign((n?.diat ?? 0) - (line[k]?.diat ?? 0)));
    const oneDirection = run.length < 2 || moves.every((d) => d !== 0 && d === moves[0]);
    if (!after) report('non-chord-tone', m.onset, `${name(m)} is not in the chord ${chord} and ends the melody`);
    else if (!joined(before, m) || !joined(m, after))
      report(
        'non-chord-tone',
        m.onset,
        `${name(m)} is not in the chord ${chord} and is not approached and left by step`,
      );
    else if (!allowedAt(m.onset))
      report(
        'non-chord-tone',
        m.onset,
        `${name(m)} is not in the chord ${chord} and stands where ${input.level} allows only chord notes`,
      );
    else if (run.length > ladder.nctRun)
      report(
        'non-chord-tone',
        m.onset,
        `${name(m)} is the ${run.length}th non-chord tone in a row (at most ${ladder.nctRun})`,
      );
    else if (!oneDirection)
      report('non-chord-tone', m.onset, `${name(m)} ends a run of non-chord tones that changes direction`);
  });

  // minor-degree: melodic-minor practice for the 6th and 7th (FR-005, research R3).
  melody.forEach((m, i) => {
    const key = keyAt(m.bar);
    if (key.mode !== 'minor') return;
    const degree = degreeOf(key, m.step);
    if (degree !== SIXTH && degree !== SEVENTH) return;
    const natural = naturalPc(key, degree);
    const raised = m.pc === mod(natural + 1, OCTAVE);
    const chord = chordAt(m.onset);
    const naturalSixth = naturalPc(key, SIXTH);
    const raisedSeventh = mod(naturalPc(key, SEVENTH) + 1, OCTAVE);
    const after = next(i);
    const before = prev(i);
    const chordNames = names(chord);
    if (degree === SEVENTH && raised) {
      if (hasPc(chord, naturalSixth))
        report('minor-degree', m.onset, `the raised 7th ${name(m)} over ${chordNames}, which holds the natural 6th`);
      else if (!hasPc(chord, raisedSeventh) && !leadsToTonic(m, after))
        report(
          'minor-degree',
          m.onset,
          `the raised 7th ${name(m)} neither belongs to ${chordNames} nor rises to the tonic`,
        );
      else if (
        after &&
        isChordStart(after.onset) &&
        triadRoot(sounding(left, after.onset))?.pc === tonicPc(key) &&
        after.pc !== tonicPc(key)
      )
        report('minor-degree', m.onset, `the raised 7th ${name(m)} does not resolve to the tonic over i`);
    } else if (degree === SEVENTH) {
      const fallsToSixth = after !== undefined && degreeOf(key, after.step) === SIXTH && after.diat === m.diat - 1;
      if (!hasPc(chord, m.pc) && !fallsToSixth)
        report(
          'minor-degree',
          m.onset,
          `the natural 7th ${name(m)} over ${chordNames} should be raised, or fall to the 6th`,
        );
    } else if (raised) {
      const root = triadRoot(chord);
      const rootDegree = root ? degreeOf(key, root.step) : undefined;
      const inFigure =
        before !== undefined &&
        after !== undefined &&
        degreeOf(key, before.step) === FIFTH &&
        before.diat === m.diat - 1 &&
        after.pc === raisedSeventh &&
        after.diat === m.diat + 1 &&
        (rootDegree === TONIC || rootDegree === FIFTH) &&
        !hasPc(chord, naturalSixth);
      if (!inFigure)
        report(
          'minor-degree',
          m.onset,
          `the raised 6th ${name(m)} stands outside the rising figure 5-♯6-♯7-1 over i or V`,
        );
    }
  });

  // augmented-second: a step by letter that spans three semitones.
  melody.forEach((m, i) => {
    const before = prev(i);
    if (before && Math.abs(m.diat - before.diat) === 1 && Math.abs(m.midi - before.midi) === MINOR_THIRD)
      report('augmented-second', m.onset, `${name(before)} to ${name(m)} is an augmented second`);
  });

  // cross-relation: the melody and a sounding left-hand note share a letter but not its accidental.
  for (const m of melody) {
    const other = left.find((l) => l.onset < m.end && m.onset < l.end && l.step === m.step && l.alter !== m.alter);
    if (other)
      report('cross-relation', Math.max(m.onset, other.onset), `${name(m)} against ${name(other)} in the left hand`);
  }

  // clash: no minor second, major seventh or minor ninth against the left hand when a chord starts or on a strong beat.
  // A diatonic passing tone on a strong beat that is not a chord start - from a chord tone to a chord tone, by step,
  // one way - is exempt (second-species practice; research R4 amendment, T060); a neighbour tone is not.
  const diatonicStep = (a: Note, b: Note): boolean =>
    a.end === b.onset && Math.abs(a.diat - b.diat) === 1 && [1, 2].includes(Math.abs(a.midi - b.midi));
  const isPassing = (m: Note, i: number): boolean => {
    const before = prev(i);
    const after = next(i);
    return (
      before !== undefined &&
      after !== undefined &&
      !isChordStart(m.onset) &&
      fullScale(keyAt(m.bar)).has(m.pc) &&
      diatonicStep(before, m) &&
      diatonicStep(m, after) &&
      Math.sign(m.diat - before.diat) === Math.sign(after.diat - m.diat) &&
      hasPc(chordAt(before.onset), before.pc) &&
      hasPc(chordAt(after.onset), after.pc)
    );
  };
  const instants = [...new Set([...chordStarts, ...melody.map((m) => m.onset).filter(isStrong)])].sort((a, b) => a - b);
  for (const t of instants) {
    const m = melodyAt(t);
    if (!m) continue;
    const index = melody.indexOf(m);
    if (leadsToTonic(m, next(index))) continue;
    if (m.onset === t && isPassing(m, index)) continue;
    const against = sounding(left, t).find((l) => CLASH_INTERVALS.has(mod(m.midi - l.midi, OCTAVE)));
    if (against) report('clash', t, `${name(m)} clashes with ${name(against)} in the left hand`);
  }

  // parallel-octaves: melody and bass an octave apart into a chord start, moving the same way - from the melody note
  // at the previous chord start, or from its last note before this one (a weak beat, T067).
  if (!ladder.parallelOctaves) {
    for (let i = 1; i < chordStarts.length; i++) {
      const [t1, t2] = [chordStarts[i - 1] as number, chordStarts[i] as number];
      const m2 = melodyAt(t2);
      const b1 = [...sounding(left, t1)].sort((a, b) => a.midi - b.midi)[0];
      const b2 = [...sounding(left, t2)].sort((a, b) => a.midi - b.midi)[0];
      if (!m2 || !b1 || !b2 || m2.pc !== b2.pc || b1.midi === b2.midi) continue;
      const lastBefore = melody.filter((m) => m.onset >= t1 && m.onset < t2).pop();
      const m1 = [melodyAt(t1), lastBefore].find(
        (m) =>
          m !== undefined &&
          m.pc === b1.pc &&
          m.midi !== m2.midi &&
          Math.sign(m2.midi - m.midi) === Math.sign(b2.midi - b1.midi),
      );
      if (m1)
        report(
          'parallel-octaves',
          t2,
          `${name(m1)}-${name(m2)} moves in octaves with the bass ${name(b1)}-${name(b2)}`,
        );
    }
  }

  // register and hand-gap (research R5).
  for (const m of melody)
    if (m.midi < register.min || m.midi > register.max)
      report(
        'register',
        m.onset,
        `${name(m)} lies outside the ${input.level} register (MIDI ${register.min}-${register.max})`,
      );
  for (const r of rightAll.filter((n) => !n.tied)) {
    const close = left.find(
      (l) => l.onset < r.end && r.onset < l.end && r.midi - l.midi < MELODY_MIN_CLEARANCE_SEMITONES,
    );
    if (close)
      report(
        'hand-gap',
        Math.max(r.onset, close.onset),
        `${name(r)} is closer than ${MELODY_MIN_CLEARANCE_SEMITONES} semitones to the left hand's ${name(close)}`,
      );
  }

  // leap: at most the ladder's steps between consecutive melody notes (a repeated note is 0).
  melody.forEach((m, i) => {
    const before = prev(i);
    if (before && Math.abs(m.diat - before.diat) > ladder.maxLeapSteps)
      report(
        'leap',
        m.onset,
        `${name(before)} to ${name(m)} leaps ${Math.abs(m.diat - before.diat)} steps (at most ${ladder.maxLeapSteps})`,
      );
  });

  // range: per key segment, the melody's span.
  segments.forEach((_, index) => {
    let low = Infinity;
    let high = -Infinity;
    for (const m of melody.filter((n) => segmentIndexAt(n.bar) === index)) {
      low = Math.min(low, m.midi);
      high = Math.max(high, m.midi);
      if (high - low > ladder.rangeSemitones) {
        report(
          'range',
          m.onset,
          `${name(m)} widens the melody to ${high - low} semitones (at most ${ladder.rangeSemitones})`,
        );
        break;
      }
    }
  });

  // value: shortest note, dotted values, eighth pairs, the left hand's chord changes per bar.
  melody.forEach((m, i) => {
    const pos = positionIn(m.onset);
    const dotted = !Number.isInteger(Math.log2(m.written));
    if (m.written < ladder.shortestValueBeats)
      report('value', m.onset, `${name(m)} is shorter than the ${input.level} shortest value`);
    else if (dotted && input.level !== 'advanced') report('value', m.onset, `${name(m)} is dotted (advanced only)`);
    else if (input.level === 'intermediate' && m.written === EIGHTH_BEATS) {
      const partner = Number.isInteger(pos) ? next(i) : prev(i);
      const paired =
        partner !== undefined &&
        partner.written === EIGHTH_BEATS &&
        Number.isInteger(positionIn(Math.min(m.onset, partner.onset))) &&
        Math.abs(partner.onset - m.onset) === EIGHTH_BEATS;
      const withLeft = left.some((l) => !l.tied && l.onset === m.onset && l.written === EIGHTH_BEATS);
      if (!paired) report('value', m.onset, `${name(m)} is an eighth outside a pair on the beat`);
      else if (withLeft) report('value', m.onset, `${name(m)} is an eighth together with a left-hand eighth`);
    }
  });
  const attacksPerBar = new Map<number, number[]>();
  for (const t of chordStarts) attacksPerBar.set(barAt(t), [...(attacksPerBar.get(barAt(t)) ?? []), t]);
  for (const attacks of attacksPerBar.values())
    if (attacks.length > ladder.lhAttacksPerBar)
      report(
        'value',
        attacks[ladder.lhAttacksPerBar] as number,
        `the left hand changes chord ${attacks.length} times in the bar (at most ${ladder.lhAttacksPerBar})`,
      );

  checkFingering(
    melody,
    input.level,
    ladder,
    segments.map((s) => startOf(s.firstBar)),
    chordStarts,
    report,
  );

  // static: one pitch held or repeated for more than two bars (FR-008); the closing note is exempt.
  for (let i = 0; i < melody.length; ) {
    let j = i;
    while (j + 1 < melody.length && (melody[j + 1] as Note).midi === (melody[i] as Note).midi) j++;
    const last = j === melody.length - 1 && j > i ? j - 1 : j;
    const first = melody[i] as Note;
    if ((melody[last] as Note).end - first.onset > STATIC_BARS_MAX * barLength && !(j === melody.length - 1 && i === j))
      report('static', first.onset, `${name(first)} is held or repeated for more than ${STATIC_BARS_MAX} bars`);
    i = j + 1;
  }

  // ending: the melody ends on the tonic, over the tonic chord (FR-007).
  const final = melody[melody.length - 1];
  if (final) {
    const key = keyAt(final.bar);
    const chord = chordAt(final.onset);
    if (final.pc !== tonicPc(key)) report('ending', final.onset, `the melody ends on ${name(final)}, not the tonic`);
    else if (triadRoot(chord)?.pc !== tonicPc(key))
      report('ending', final.onset, `the left hand ends on ${names(chord)}, not the tonic chord`);
  }

  return out.sort(
    (a, b) =>
      startOf(a.bar) + a.beat - (startOf(b.bar) + b.beat) || RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule),
  );
}

/** Fingers as the learner reads them, the shifts they make, and the crossings (research R6, FR-009). */
function checkFingering(
  melody: readonly Note[],
  level: Level,
  ladder: MelodyLadderRow,
  segmentStarts: readonly number[],
  chordStarts: readonly number[],
  report: (rule: MelodyRule, t: number, message: string) => void,
): void {
  const first = melody[0];
  if (!first) return;
  if (first.finger === undefined)
    report('fingering', first.onset, `the first note ${name(first)} has no finger written`);
  let thumb = first.diat - ((first.finger ?? THUMB) - 1);
  let shifts = 0;
  const crossingIsShift = level === 'introduction' || level === 'beginner';
  for (let i = 1; i < melody.length; i++) {
    const m = melody[i] as Note;
    const before = melody[i - 1] as Note;
    const previousFinger = before.diat - thumb + 1;
    if (m.finger === undefined) {
      const finger = m.diat - thumb + 1;
      if (finger < THUMB || finger > FINGERS)
        report('fingering', m.onset, `${name(m)} lies outside the hand's position and has no finger written`);
      continue;
    }
    const newThumb = m.diat - (m.finger - 1);
    if (newThumb === thumb) continue;
    thumb = newThumb;
    const step = m.diat - before.diat;
    let shift = false;
    if (Math.abs(step) === 1) {
      const thumbUnder = step > 0 && CROSSING_FINGERS.has(previousFinger) && m.finger === THUMB;
      const fingerOver = step < 0 && previousFinger === THUMB && CROSSING_FINGERS.has(m.finger);
      if (!thumbUnder && !fingerOver) {
        report(
          'fingering',
          m.onset,
          `${name(before)} to ${name(m)} steps from finger ${previousFinger} to ${m.finger}`,
        );
        continue;
      }
      const thumbNote = thumbUnder ? m : before;
      if (BLACK_KEYS.has(thumbNote.pc)) {
        report('fingering', m.onset, `the thumb crosses onto the black key ${name(thumbNote)}`);
        continue;
      }
      shift = crossingIsShift;
    } else {
      const fault = leapFingeringFault(before, m, previousFinger, step, chordStarts);
      if (fault) {
        report('fingering', m.onset, fault);
        continue;
      }
      shift = true;
    }
    if (!shift) continue;
    shifts++;
    const sectionStart = segmentStarts.includes(m.onset) || before.end < m.onset;
    if (shifts > ladder.shiftsMax)
      report('shift', m.onset, `${name(m)} moves the hand (shift ${shifts}; at most ${ladder.shiftsMax} at ${level})`);
    else if ((level === 'introduction' || level === 'beginner') && !sectionStart)
      report('shift', m.onset, `${name(m)} moves the hand in the middle of a section`);
  }
}

/** A leap that moves the hand (T066, research R6 amendment): at a chord start after at least a quarter the hand
 *  lifts to a new position (a shift, any fingers). Elsewhere it follows the hand: going up, a lower finger is only
 *  the thumb passing under; coming down, a higher finger only passes over the thumb; a crossing spans at most a
 *  third, onto or from a white-key thumb; the same finger never moves to a new pitch; and thumb to finger 2 spans at
 *  most a fourth. Returns the finding's message, or undefined. */
function leapFingeringFault(
  before: Note,
  m: Note,
  previousFinger: number,
  step: number,
  chordStarts: readonly number[],
): string | undefined {
  // A repeated note with a new finger moves the hand without a leap (a shift, counted by the caller).
  if (step === 0) return undefined;
  // The hand lifts and takes a new position at a chord start after at least a quarter: a shift, any fingers.
  if (chordStarts.includes(m.onset) && before.end - before.onset >= SHIFT_MIN_QUARTERS) return undefined;
  const finger = m.finger as number;
  const span = Math.abs(step);
  const what = `${name(before)} to ${name(m)} leaps from finger ${previousFinger} to ${finger}`;
  if (finger === previousFinger) return `${what}: the same finger moves in the middle of the music`;
  const crossing = step > 0 ? finger < previousFinger : finger > previousFinger;
  if (crossing) {
    const thumbNote = step > 0 ? m : before;
    const thumbCrosses = step > 0 ? finger === THUMB : previousFinger === THUMB;
    if (!thumbCrosses) return `${what}: the fingers cross without the thumb`;
    if (span > CROSSING_LEAP_MAX_STEPS) return `${what}: a thumb crossing wider than a third`;
    if (BLACK_KEYS.has(thumbNote.pc)) return `${what}: the thumb crosses onto the black key ${name(thumbNote)}`;
    return undefined;
  }
  const pair = new Set([previousFinger, finger]);
  if (pair.has(THUMB) && pair.has(2) && span > THUMB_TO_SECOND_MAX_STEPS)
    return `${what}: thumb to finger 2 wider than a fourth`;
  return undefined;
}

/** The melody's degree sequence, for `checkMelodyVariation`: each note's scale degree in the key in force, with its
 *  accidental against the natural scale ("♯7"), key segments separated by " | ". */
export function melodyDegrees(input: Omit<MelodyCheckInput, 'level'>): string {
  const reading = readScore(input.xml);
  const segments = [...input.keys].sort((a, b) => a.firstBar - b.firstBar);
  const segmentIndexAt = (bar: number): number => segments.filter((s) => s.firstBar <= bar).length - 1;
  const onsets = new Map<number, Note>();
  for (const w of reading.notes.filter((n) => n.hand === 'right' && !n.tiedFromPrevious)) {
    const note = toNote(w);
    const held = onsets.get(note.onset);
    if (!held || held.midi < note.midi) onsets.set(note.onset, note);
  }
  const parts: string[][] = segments.map(() => []);
  for (const m of [...onsets.values()].sort((a, b) => a.onset - b.onset)) {
    const index = Math.max(0, segmentIndexAt(m.bar));
    const key = (segments[index] as (typeof segments)[number]).key;
    const degree = degreeOf(key, m.step);
    const alter = mod(m.pc - naturalPc(key, degree) + OCTAVE / 2, OCTAVE) - OCTAVE / 2;
    parts[index]?.push(`${accidental(alter)}${degree}`);
  }
  return parts.map((p) => p.join(' ')).join(' | ');
}

/** FR-008 across a family: a `variation` finding when every item of one level and group has the same degree sequence. */
export function checkMelodyVariation(items: readonly { itemId: string; degrees: string }[]): MelodyFinding[] {
  if (items.length < 2 || new Set(items.map((i) => i.degrees)).size > 1) return [];
  return [
    {
      itemId: (items[0] as (typeof items)[number]).itemId,
      bar: 1,
      beat: 1,
      rule: 'variation',
      message: `all ${items.length} items share one melody degree sequence (${(items[0] as (typeof items)[number]).degrees})`,
    },
  ];
}
