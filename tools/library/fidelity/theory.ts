// The independent exercise theory check (FR-013, data-model.md §5, research R8).
//
// It answers one question: does the exercise contain the chords its title says, spelled the way music theory spells
// them? It shares nothing with the exercise generator: it does not import it and does not read the exercise
// definitions the generator is fed (an architecture test asserts both). It reads the finished MusicXML with the app's
// `readXml` and derives every expected tone by LETTER ARITHMETIC (a chord tone's letter is counted from the root's
// letter, its alteration follows from the semitone distance). The generator spells from the key signature and its own
// degree tables; this uses the scale's semitone pattern, so one shared mistake cannot pass both.
import { XmlElement, type XmlNode } from '@rgrove/parse-xml';
import type { Level } from '../../../src/core/library/types';
import { readXml } from '../../../src/core/musicxml/read';
import { add, cmp, type QuarterTime, q } from './time';

export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Hand = 'left' | 'right';
export type Mode = 'major' | 'minor';
export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';
export type Inversion = 0 | 1 | 2;

export interface KeyClaim {
  tonicLetter: Letter;
  tonicAlter: -1 | 0 | 1;
  mode: Mode;
}

export interface ChordClaim {
  /** "I", "ii", "V", "i", "iv", "vii": upper case says major or augmented, lower case minor or diminished. */
  roman: string;
  quality: Quality;
  inversion: Inversion;
  /** The hands that play the whole triad. */
  hands: Hand[];
  /** Where the hands play different shapes: this hand's inversion, instead of `inversion`. */
  handInversions?: Partial<Record<Hand, Inversion>>;
  /** Hands that play the root alone, in one or more octaves (the closing chord of the scale item). */
  rootOnly?: Hand[];
  /** When both hands play the same shape: how many octaves the left hand lies below the right (default 1; the pattern steps
   *  put the right hand's chords at T+12 and the left hand's at T-12, so 2). */
  octavesApart?: number;
}

/** A run of single notes in one hand: scale degrees counted up from the tonic (1 = the tonic in `tonicOctave`, 8 = the
 *  tonic an octave higher). */
export interface ScaleClaim {
  hand: Hand;
  tonicOctave: number;
  degrees: number[];
}

export type ScaleForm = 'harmonic' | 'melodic';
export type Voicing = 'triad' | 'broken' | 'root-fifth';

/** One chord a hand plays in a section (rule set exercise-theory-v2). A `triad` is simultaneous and is also listed, once, in
 *  the claim's `chords`; `broken` is root-third-fifth-third and `root-fifth` root then fifth, as single notes. */
export interface SectionChord {
  roman: string;
  quality: Quality;
  inversion: Inversion;
  voicing: Voicing;
}

/** What one hand plays in a section: a scale (`degrees` counted up from the tonic in `tonicOctave`; a major key ignores
 *  the form, melodic minor raises the 6th and 7th going up and restores them going down), chords, a melody (rule set
 *  exercise-theory-v3: not compared note by note here - `checkMelodyRules` checks it against its level's Difficulty
 *  ladder), or nothing. */
export type SectionHand =
  | { kind: 'scale'; form: ScaleForm; tonicOctave: number; degrees: number[] }
  | { kind: 'chords'; chords: SectionChord[] }
  | { kind: 'melody'; level: Level }
  | { kind: 'rest' };

/** A run of printed bars (`firstBar` to `lastBar`, inclusive) in one key, with what each hand plays. */
export interface SectionClaim {
  firstBar: number;
  lastBar: number;
  key: KeyClaim;
  right: SectionHand;
  left: SectionHand;
}

/** A run of printed bars (`firstBar` to `lastBar`, inclusive) in one key: the key claim per bar range of a key change. */
export interface KeySegment {
  firstBar: number;
  lastBar: number;
  key: KeyClaim;
}

export interface ExerciseClaim {
  itemId: string;
  /** The key of the first bar (and of the whole file when there are no `segments`). */
  key: KeyClaim;
  /** In written order, one per sounded chord event (a moment at which some hand plays two or more notes). */
  chords: ChordClaim[];
  scales?: ScaleClaim[];
  /** exercise-theory-v2: the scale and single-note voicings of each hand, bar range by bar range. */
  sections?: SectionClaim[];
  /** exercise-theory-v2 key change: the key of each bar range in written order. Every chord is spelled in the key of the
   *  segment its bar lies in; from the second segment on the file must show the change (new signature when the fifths
   *  differ, and the key named in a words direction at the segment's first bar). */
  segments?: KeySegment[];
}

export type TheoryRule =
  | 'key'
  | 'mode'
  | 'chordCount'
  | 'hands'
  | 'spelling'
  | 'pitch'
  | 'completeness'
  | 'inversion'
  | 'label'
  | 'scale'
  | 'voicing'
  | 'octave'
  | 'overlap'
  | 'chordSet'
  | 'changeRate';

export interface TheoryDifference {
  kind: 'theory';
  /** 0-based index into `claim.chords`; -1 when the difference is not about one chord (the key, a scale note). */
  chordIndex: number;
  /** 0-based position in a scale run (rule 'scale' only). */
  scaleNote?: number;
  /** The printed measure number. */
  bar: string;
  hand: Hand | 'both';
  expected: string;
  found: string;
  rule: TheoryRule;
}

export interface Tone {
  step: Letter;
  alter: number;
}

// ---- the theory tables -------------------------------------------------------------------------------------------

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SEMITONES_PER_OCTAVE = 12;
const LETTERS_PER_OCTAVE = 7;
/** Semitones between successive scale degrees. */
const SCALE_STEPS: Record<Mode, readonly number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  minor: [2, 1, 2, 2, 1, 2, 2],
};
/** Third and fifth above the root, in semitones. */
const TRIAD_SEMITONES: Record<Quality, readonly [number, number]> = {
  major: [4, 7],
  minor: [3, 7],
  diminished: [3, 6],
  augmented: [4, 8],
};
const ROMAN_DEGREES: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };
/** Key signature (sharps positive) of each natural major key; an alteration moves it by seven (a full circle). */
const MAJOR_FIFTHS: Record<Letter, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1 };
const FIFTHS_PER_ALTERATION = 7;
/** A minor key has the signature of the major key a minor third above its tonic: three fewer sharps. */
const MINOR_FIFTHS_OFFSET = -3;
const LEADING_TONE_RAISE = 1;
const HAND_OF_STAFF: Record<number, Hand> = { 1: 'right', 2: 'left' };
const HANDS_ORDER: readonly Hand[] = ['right', 'left'];
const SUFFIX: Record<Quality, string> = { major: '', minor: 'm', diminished: '°', augmented: '+' };
const SUPERSCRIPT_FIGURE = ['', '⁶', '⁶⁴'];
const LABEL_SEPARATOR = ' · ';
const CHORD_NAME = /^([A-G])([♯♭#b]?)(m|°|\+)?$/;
const ROMAN_FIGURE = /^([ivIV]+)(°?)((?:⁶⁴|⁶)?)$/;
/** A triad in close position lies within an octave (its bass and its top note are less than this many semitones apart). */
const CLOSE_POSITION_SPAN = SEMITONES_PER_OCTAVE;
const MISSING = '(missing)';
const NONE = '(none)';

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const letterIndex = (l: Letter): number => LETTERS.indexOf(l);

/** Sounding pitch from the written spelling: C-flat 4 is 59, B-sharp 3 is 60, F-double-sharp 4 is 67. */
export function soundingMidi(step: Letter, alter: number, octave: number): number {
  return (octave + 1) * SEMITONES_PER_OCTAVE + NATURAL_SEMITONES[step] + alter;
}

/** The alteration that gives `letter` the pitch class `pc`, the shortest way round (never more than a tritone). */
function alterFor(letter: Letter, pc: number): number {
  const d = mod(pc - NATURAL_SEMITONES[letter], SEMITONES_PER_OCTAVE);
  return d > SEMITONES_PER_OCTAVE / 2 ? d - SEMITONES_PER_OCTAVE : d;
}

const tonicPc = (key: KeyClaim): number =>
  mod(NATURAL_SEMITONES[key.tonicLetter] + key.tonicAlter, SEMITONES_PER_OCTAVE);

/** The key signature of the named key, from the circle of fifths (sharps positive, flats negative). */
export function expectedFifths(key: KeyClaim): number {
  const major = MAJOR_FIFTHS[key.tonicLetter] + FIFTHS_PER_ALTERATION * key.tonicAlter;
  return key.mode === 'major' ? major : major + MINOR_FIFTHS_OFFSET;
}

const accidental = (alter: number): string => (alter < 0 ? 'b'.repeat(-alter) : '#'.repeat(alter));
/** "F##", "Cb", "D": the spelling of a tone, ASCII accidentals. */
export function describeTheoryTone(t: Tone): string {
  return `${t.step}${accidental(t.alter)}`;
}
const describeNote = (n: { step: Letter; alter: number; octave: number }): string =>
  `${describeTheoryTone(n)}${n.octave}`;

/** One scale degree above the tonic: its letter counted from the tonic's, its alteration from the semitone pattern. */
function scaleToneAt(key: KeyClaim, degreeIndex: number): Tone & { semitones: number; letters: number } {
  const steps = SCALE_STEPS[key.mode];
  let semitones = 0;
  for (let i = 0; i < degreeIndex; i++) semitones += steps[mod(i, steps.length)] as number;
  const letter = LETTERS[mod(letterIndex(key.tonicLetter) + degreeIndex, LETTERS_PER_OCTAVE)] as Letter;
  return { step: letter, alter: alterFor(letter, tonicPc(key) + semitones), semitones, letters: degreeIndex };
}

/** The three tones of a triad on `root`, root first: the third and fifth by letter arithmetic from the root's letter. */
export function triadTones(root: Tone, quality: Quality): [Tone, Tone, Tone] {
  const rootPc = mod(NATURAL_SEMITONES[root.step] + root.alter, SEMITONES_PER_OCTAVE);
  const [third, fifth] = TRIAD_SEMITONES[quality];
  const thirdLetter = LETTERS[mod(letterIndex(root.step) + 2, LETTERS_PER_OCTAVE)] as Letter;
  const fifthLetter = LETTERS[mod(letterIndex(root.step) + 4, LETTERS_PER_OCTAVE)] as Letter;
  return [
    root,
    { step: thirdLetter, alter: alterFor(thirdLetter, rootPc + third) },
    { step: fifthLetter, alter: alterFor(fifthLetter, rootPc + fifth) },
  ];
}

/** The three tones of the claimed triad, root first: the root from the scale, the third and fifth by letter arithmetic. */
export function expectedChordTones(key: KeyClaim, chord: ChordClaim): [Tone, Tone, Tone] {
  const degree = ROMAN_DEGREES[chord.roman.toLowerCase()];
  if (degree === undefined) throw new Error(`unknown Roman numeral "${chord.roman}"`);
  const rootScale = scaleToneAt(key, degree - 1);
  let rootPc = mod(tonicPc(key) + rootScale.semitones, SEMITONES_PER_OCTAVE);
  // The leading-tone chord of a minor key stands on the raised seventh (harmonic minor).
  if (key.mode === 'minor' && degree === 7 && chord.quality === 'diminished') rootPc += LEADING_TONE_RAISE;
  const rootLetter = rootScale.step;
  const [third, fifth] = TRIAD_SEMITONES[chord.quality];
  const thirdLetter = LETTERS[mod(letterIndex(rootLetter) + 2, LETTERS_PER_OCTAVE)] as Letter;
  const fifthLetter = LETTERS[mod(letterIndex(rootLetter) + 4, LETTERS_PER_OCTAVE)] as Letter;
  return [
    { step: rootLetter, alter: alterFor(rootLetter, rootPc) },
    { step: thirdLetter, alter: alterFor(thirdLetter, rootPc + third) },
    { step: fifthLetter, alter: alterFor(fifthLetter, rootPc + fifth) },
  ];
}

/** Scale tone `degree` (1 = the tonic in `tonicOctave`), with its written octave. */
function scaleNote(key: KeyClaim, tonicOctave: number, degree: number): Tone & { octave: number } {
  const tone = scaleToneAt(key, degree - 1);
  const octave = tonicOctave + Math.floor((letterIndex(key.tonicLetter) + degree - 1) / LETTERS_PER_OCTAVE);
  return { step: tone.step, alter: tone.alter, octave };
}

// ---- reading the file --------------------------------------------------------------------------------------------

export interface WrittenNote {
  hand: Hand;
  bar: string;
  onset: QuarterTime;
  step: Letter;
  alter: number;
  octave: number;
  midi: number;
  /** Where the written note stops sounding. */
  end: QuarterTime;
  /** The note continues a tie from the note before (`<tie type="stop"/>`): it is not a new attack. */
  tiedFromPrevious: boolean;
  /** The finger written on the note (`<technical><fingering>`), when there is one. */
  finger?: number;
}
export interface Words {
  bar: number;
  onset: QuarterTime;
  text: string;
  /** The hand whose staff the direction sits on, when the file says. */
  hand?: Hand;
}
/** One `<key>` element of the file, with the printed bar it stands in. */
interface WrittenKey {
  bar: number;
  fifths: string;
  mode?: string;
}
export interface Reading {
  fifths?: string;
  mode?: string;
  /** Every `<key>` in written order (the first is also `fifths`/`mode`). */
  keys: WrittenKey[];
  firstBar: string;
  notes: WrittenNote[];
  words: Words[];
  /** Where each printed bar starts, in written order. */
  barStarts: { bar: number; start: QuarterTime }[];
  /** The first `<time>` of the file, when it has one. */
  metre?: { beats: number; beatType: number };
}

const child = (el: XmlElement, name: string): XmlElement | undefined =>
  el.children.find((c): c is XmlElement => c instanceof XmlElement && c.name === name);
const text = (el: XmlElement | undefined): string => el?.text.trim() ?? '';
const elements = (nodes: readonly XmlNode[], name: string): XmlElement[] =>
  nodes.filter((c): c is XmlElement => c instanceof XmlElement && c.name === name);

export function readScore(xml: string): Reading {
  const { doc } = readXml(xml);
  const root = doc.children.find((c): c is XmlElement => c instanceof XmlElement);
  if (root?.name !== 'score-partwise') throw new Error('the theory check reads score-partwise files');
  const reading: Reading = { firstBar: '1', keys: [], notes: [], words: [], barStarts: [] };
  let first = true;
  for (const part of elements(root.children, 'part')) {
    let measureStart = q(0);
    let divisions = 1;
    elements(part.children, 'measure').forEach((measure, index) => {
      const bar = measure.attributes.number ?? String(index + 1);
      reading.barStarts.push({ bar: Number(bar), start: measureStart });
      if (first) reading.firstBar = bar;
      first = false;
      let position = 0;
      let furthest = 0;
      let lastOnset = measureStart;
      const timeOf = (ticks: number): QuarterTime => add(measureStart, q(ticks, divisions));
      for (const node of measure.children) {
        if (!(node instanceof XmlElement)) continue;
        if (node.name === 'attributes') {
          const d = child(node, 'divisions');
          if (d) divisions = Number(text(d));
          const time = child(node, 'time');
          if (time && reading.metre === undefined)
            reading.metre = {
              beats: Number(text(child(time, 'beats'))),
              beatType: Number(text(child(time, 'beat-type'))),
            };
          const key = child(node, 'key');
          if (key) {
            const fifths = text(child(key, 'fifths'));
            const mode = text(child(key, 'mode'));
            reading.keys.push({ bar: Number(bar), fifths, ...(mode !== '' ? { mode } : {}) });
            if (reading.fifths === undefined) {
              reading.fifths = fifths;
              if (mode !== '') reading.mode = mode;
            }
          }
        } else if (node.name === 'direction') {
          for (const type of elements(node.children, 'direction-type'))
            for (const words of elements(type.children, 'words')) {
              const staff = text(child(node, 'staff'));
              const hand = staff === '' ? undefined : HAND_OF_STAFF[Number(staff)];
              reading.words.push({
                bar: Number(bar),
                onset: timeOf(position),
                text: text(words),
                ...(hand ? { hand } : {}),
              });
            }
        } else if (node.name === 'backup') {
          position -= Number(text(child(node, 'duration')));
        } else if (node.name === 'forward') {
          position += Number(text(child(node, 'duration')));
          furthest = Math.max(furthest, position);
        } else if (node.name === 'note') {
          if (child(node, 'grace') || child(node, 'cue')) continue;
          const chord = child(node, 'chord') !== undefined;
          const onset = chord ? lastOnset : timeOf(position);
          const duration = Number(text(child(node, 'duration')));
          if (!chord) {
            lastOnset = onset;
            position += duration;
            furthest = Math.max(furthest, position);
          }
          const pitch = child(node, 'pitch');
          if (!pitch) continue;
          const staff = Number(text(child(node, 'staff')) || '1');
          const hand = HAND_OF_STAFF[staff];
          if (!hand) throw new Error(`the theory check reads two staves, found staff ${staff}`);
          const step = text(child(pitch, 'step')) as Letter;
          const alter = Number(text(child(pitch, 'alter')) || '0');
          const octave = Number(text(child(pitch, 'octave')));
          if (!LETTERS.includes(step) || !Number.isInteger(alter) || !Number.isInteger(octave))
            throw new Error(`unreadable <pitch> in bar ${bar}`);
          const notations = child(node, 'notations');
          const technical = notations && child(notations, 'technical');
          const fingering = text(technical && child(technical, 'fingering'));
          reading.notes.push({
            ...(fingering !== '' ? { finger: Number(fingering) } : {}),
            hand,
            bar,
            onset,
            end: add(onset, q(duration, divisions)),
            tiedFromPrevious: elements(node.children, 'tie').some((t) => t.attributes.type === 'stop'),
            step,
            alter,
            octave,
            midi: soundingMidi(step, alter, octave),
          });
        }
      }
      measureStart = add(measureStart, q(Math.max(furthest, position), divisions));
    });
  }
  return reading;
}

interface ChordEvent {
  onset: QuarterTime;
  bar: string;
  groups: Map<Hand, WrittenNote[]>;
}

/** Notes sharing a hand and an onset are one group: two or more are a chord, one is a melody or scale note. */
function group(notes: readonly WrittenNote[]): { events: ChordEvent[]; singles: Map<Hand, WrittenNote[]> } {
  const groups = new Map<string, WrittenNote[]>();
  for (const n of notes) {
    const key = `${n.hand}|${n.onset.num}/${n.onset.den}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const events = new Map<string, ChordEvent>();
  const singles = new Map<Hand, WrittenNote[]>();
  for (const g of groups.values()) {
    const first = g[0] as WrittenNote;
    if (g.length === 1) {
      singles.set(first.hand, [...(singles.get(first.hand) ?? []), first]);
      continue;
    }
    const at = `${first.onset.num}/${first.onset.den}`;
    const event = events.get(at) ?? { onset: first.onset, bar: first.bar, groups: new Map<Hand, WrittenNote[]>() };
    event.groups.set(first.hand, g);
    events.set(at, event);
  }
  for (const list of singles.values()) list.sort((a, b) => cmp(a.onset, b.onset));
  return { events: [...events.values()].sort((a, b) => cmp(a.onset, b.onset)), singles };
}

// ---- the check ---------------------------------------------------------------------------------------------------

export function checkExercise(xml: string, claim: ExerciseClaim): TheoryDifference[] {
  const reading = readScore(xml);
  const out: TheoryDifference[] = [];
  const { events, singles } = group(reading.notes);

  const wholeFile = (rule: TheoryRule, expected: string, found: string): TheoryDifference => ({
    kind: 'theory',
    chordIndex: -1,
    bar: reading.firstBar,
    hand: 'both',
    rule,
    expected,
    found,
  });
  const fifths = String(expectedFifths(claim.key));
  if (reading.fifths !== fifths) out.push(wholeFile('key', fifths, reading.fifths ?? NONE));
  if (reading.mode !== undefined && reading.mode !== claim.key.mode)
    out.push(wholeFile('mode', claim.key.mode, reading.mode));

  const keyAt = (bar: string): KeyClaim =>
    claim.segments?.find((s) => Number(bar) >= s.firstBar && Number(bar) <= s.lastBar)?.key ?? claim.key;
  if (claim.segments) out.push(...checkKeySegments(claim.segments, reading));

  const compared = Math.min(claim.chords.length, events.length);
  for (let i = 0; i < compared; i++) {
    const event = events[i] as ChordEvent;
    out.push(...checkChord(keyAt(event.bar), i, claim.chords[i] as ChordClaim, event, reading.words));
  }
  if (claim.chords.length !== events.length) {
    const at = events[Math.min(compared, events.length - 1)];
    out.push({
      kind: 'theory',
      chordIndex: compared,
      bar: at?.bar ?? reading.firstBar,
      hand: 'both',
      rule: 'chordCount',
      expected: `${claim.chords.length} chords`,
      found: `${events.length} chords`,
    });
  }

  out.push(...checkOverlap(reading.notes));
  for (const scale of claim.scales ?? [])
    out.push(...checkScale(claim.key, scale, singles.get(scale.hand) ?? [], reading));
  if (claim.sections) out.push(...checkSections(claim.sections, singles, reading));
  return out;
}

/** A key name in a words direction: "A minor", "F♯ minor", "B♭ major" (ASCII # and b are read too). */
const KEY_NAME = /^([A-G])([♯♭#b]?) (major|minor)$/;

/** The key change itself, from the second segment on: the signature in force at the segment's first bar has the fifths of the
 *  claimed key (a relative change keeps the signature, so nothing new is written), a `<key>` written at that bar has the
 *  claimed mode, and a words direction at that bar names the claimed key (the only sign of a relative change). */
function checkKeySegments(segments: readonly KeySegment[], reading: Reading): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  segments.forEach((segment, index) => {
    if (index === 0) return;
    const bar = String(segment.firstBar);
    const at = { kind: 'theory' as const, chordIndex: -1, bar, hand: 'both' as const };
    const fifths = String(expectedFifths(segment.key));
    const inForce = reading.keys.filter((k) => k.bar <= segment.firstBar).pop();
    if (inForce?.fifths !== fifths) out.push({ ...at, rule: 'key', expected: fifths, found: inForce?.fifths ?? NONE });
    const written = reading.keys.find((k) => k.bar === segment.firstBar);
    if (written?.mode !== undefined && written.mode !== segment.key.mode)
      out.push({ ...at, rule: 'mode', expected: segment.key.mode, found: written.mode });

    const names = reading.words.filter((w) => w.bar === segment.firstBar && KEY_NAME.test(w.text.trim()));
    const named = names.some((w) => {
      const m = KEY_NAME.exec(w.text.trim()) as RegExpExecArray;
      const alter = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
      return m[1] === segment.key.tonicLetter && alter === segment.key.tonicAlter && m[3] === segment.key.mode;
    });
    if (!named)
      out.push({
        ...at,
        rule: 'key',
        expected: `${describeTheoryTone({ step: segment.key.tonicLetter, alter: segment.key.tonicAlter })} ${segment.key.mode} named in a direction`,
        found: names[0]?.text.trim() ?? NONE,
      });
  });
  return out;
}

function checkChord(
  key: KeyClaim,
  chordIndex: number,
  claimed: ChordClaim,
  event: ChordEvent,
  words: readonly Words[],
): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  const base = { kind: 'theory' as const, chordIndex, bar: event.bar };
  const tones = expectedChordTones(key, claimed);
  const claimedHands = HANDS_ORDER.filter((h) => claimed.hands.includes(h) || claimed.rootOnly?.includes(h));
  const foundHands = HANDS_ORDER.filter((h) => event.groups.has(h));
  const inOrder = (hands: readonly Hand[]) => [...hands].sort().join(', ');
  if (claimedHands.join() !== foundHands.join())
    out.push({ ...base, hand: 'both', rule: 'hands', expected: inOrder(claimedHands), found: inOrder(foundHands) });

  for (const hand of claimedHands) {
    const notes = event.groups.get(hand);
    if (!notes) continue;
    const rootOnly = claimed.rootOnly?.includes(hand) ?? false;
    const inversion = claimed.handInversions?.[hand] ?? claimed.inversion;
    out.push(
      ...checkHand(base, hand, rootOnly ? notes.map(() => tones[0]) : tones, rootOnly ? undefined : inversion, notes),
    );
  }

  // Voicing rules only make sense once every tone is right, so a wrong tone is reported once, not again as a voicing.
  if (out.length === 0) out.push(...checkVoicing(base, claimed, event));
  // A direction on one staff names the chord of that hand: the other hand may play something else at the same moment.
  const labels = words.filter(
    (w) => cmp(w.onset, event.onset) === 0 && (w.hand === undefined || claimed.hands.includes(w.hand)),
  );
  for (const label of labels) {
    for (const part of label.text.split(LABEL_SEPARATOR).map((p) => p.trim())) {
      const found = checkLabel(part, tones[0], claimed);
      if (found) out.push({ ...base, hand: 'both', rule: 'label', ...found });
    }
  }
  return out;
}

/** A label part is a chord name ("Dm", "F#", "B°"), a Roman numeral with its figure ("ii", "V⁶"), or free text (ignored). */
function checkLabel(part: string, root: Tone, claimed: ChordClaim): { expected: string; found: string } | undefined {
  const name = CHORD_NAME.exec(part);
  if (name) {
    const alter = name[2] === '♯' || name[2] === '#' ? 1 : name[2] === '♭' || name[2] === 'b' ? -1 : 0;
    const suffix = name[3] ?? '';
    if (name[1] === root.step && alter === root.alter && suffix === SUFFIX[claimed.quality]) return undefined;
    return { expected: `${describeTheoryTone(root)}${SUFFIX[claimed.quality]}`, found: part };
  }
  const roman = ROMAN_FIGURE.exec(part);
  if (roman) {
    const sign = claimed.quality === 'diminished' ? '°' : '';
    const figure = SUPERSCRIPT_FIGURE[claimed.inversion];
    if (roman[1] === claimed.roman && roman[2] === sign && roman[3] === figure) return undefined;
    return { expected: `${claimed.roman}${sign}${figure}`, found: part };
  }
  return undefined;
}

export type Base = { kind: 'theory'; chordIndex: number; bar: string };

/** Close position within each hand, and - where both hands play the same shape - the left hand an octave below the right. */
function checkVoicing(base: Base, claimed: ChordClaim, event: ChordEvent): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  const midis = (hand: Hand): number[] => (event.groups.get(hand) ?? []).map((n) => n.midi).sort((a, b) => a - b);
  for (const hand of HANDS_ORDER) {
    if (!claimed.hands.includes(hand)) continue;
    const notes = [...(event.groups.get(hand) ?? [])].sort((a, b) => a.midi - b.midi);
    const low = notes[0];
    const high = notes[notes.length - 1];
    if (low && high && high.midi - low.midi >= CLOSE_POSITION_SPAN)
      out.push({
        ...base,
        hand,
        rule: 'voicing',
        expected: 'close position (within an octave)',
        found: `${describeNote(low)} to ${describeNote(high)}`,
      });
  }
  const sameShape = claimed.hands.length === 2 && claimed.handInversions === undefined;
  if (sameShape) {
    const right = midis('right');
    const left = midis('left');
    const apart = SEMITONES_PER_OCTAVE * (claimed.octavesApart ?? 1);
    if (right.some((m, i) => m - (left[i] ?? Number.NaN) !== apart))
      out.push({
        ...base,
        hand: 'both',
        rule: 'octave',
        expected:
          (claimed.octavesApart ?? 1) === 1
            ? 'the left hand an octave below the right'
            : `the left hand ${claimed.octavesApart} octaves below the right`,
        found: `left ${left.join(' ')}, right ${right.join(' ')} (MIDI)`,
      });
  }
  return out;
}

/** A key struck by both hands while the other still holds it cannot be played (two note-ons on one key). */
function checkOverlap(notes: readonly WrittenNote[]): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  const right = notes.filter((n) => n.hand === 'right');
  for (const l of notes.filter((n) => n.hand === 'left'))
    for (const r of right)
      if (l.midi === r.midi && cmp(l.onset, r.end) < 0 && cmp(r.onset, l.end) < 0)
        out.push({
          kind: 'theory',
          chordIndex: -1,
          bar: cmp(l.onset, r.onset) > 0 ? l.bar : r.bar,
          hand: 'both',
          rule: 'overlap',
          expected: 'each key played by one hand at a time',
          found: describeNote(l),
        });
  return out;
}

/** One hand's notes at one chord against its expected tones: each wrong tone is one difference, naming the tone. */
export function checkHand(
  base: Base,
  hand: Hand,
  expected: readonly Tone[],
  inversion: Inversion | undefined,
  notes: readonly WrittenNote[],
): TheoryDifference[] {
  const pairs = pair(expected, notes);
  const out: TheoryDifference[] = [];
  const at = { ...base, hand };
  for (const p of pairs.paired) {
    if (p.rule === undefined) continue;
    out.push({
      ...at,
      rule: p.rule,
      expected: describeTheoryTone(expected[p.tone] as Tone),
      found: describeNote(notes[p.note] as WrittenNote),
    });
  }
  for (const i of pairs.missing)
    out.push({ ...at, rule: 'completeness', expected: describeTheoryTone(expected[i] as Tone), found: MISSING });
  for (const i of pairs.extra)
    out.push({ ...at, rule: 'completeness', expected: NONE, found: describeNote(notes[i] as WrittenNote) });

  if (inversion !== undefined) {
    // The chord's inversion is the role of its lowest sounding note (by MIDI number, not by written letter).
    const lowest = notes.reduce((a, b) => (b.midi < a.midi ? b : a));
    const role = pairs.paired.find((p) => notes[p.note] === lowest)?.tone;
    if (role !== undefined && role !== inversion)
      out.push({
        ...at,
        rule: 'inversion',
        expected: `${describeTheoryTone(expected[inversion] as Tone)} in the bass`,
        found: describeNote(lowest),
      });
  }
  return out;
}

interface Pairing {
  paired: { tone: number; note: number; rule?: 'spelling' | 'pitch' }[];
  missing: number[];
  extra: number[];
}

/** Matches written notes to expected tones: an exact spelling first, then the same letter with another alteration (a
 *  wrong pitch), then the same sounding pitch class under another letter (a wrong spelling), then whatever is left,
 *  lowest first (a wrong pitch) - but only when as many tones as notes are left, so that a chord with a tone missing
 *  is reported as missing and extra, not as a wrong pitch. What remains on either side is missing or extra. */
function pair(expected: readonly Tone[], notes: readonly WrittenNote[]): Pairing {
  const paired: Pairing['paired'] = [];
  const freeTones = new Set(expected.map((_, i) => i));
  const freeNotes = new Set(notes.map((_, i) => i));
  const take = (test: (t: Tone, n: WrittenNote) => boolean, rule?: 'spelling' | 'pitch'): void => {
    for (const t of [...freeTones]) {
      const n = [...freeNotes].find((i) => test(expected[t] as Tone, notes[i] as WrittenNote));
      if (n === undefined) continue;
      paired.push(rule ? { tone: t, note: n, rule } : { tone: t, note: n });
      freeTones.delete(t);
      freeNotes.delete(n);
    }
  };
  take((t, n) => t.step === n.step && t.alter === n.alter);
  take((t, n) => t.step === n.step, 'pitch');
  take(
    (t, n) => mod(soundingMidi(t.step, t.alter, 0), SEMITONES_PER_OCTAVE) === mod(n.midi, SEMITONES_PER_OCTAVE),
    'spelling',
  );
  if (freeTones.size === freeNotes.size) {
    const rest = [...freeNotes].sort((a, b) => (notes[a] as WrittenNote).midi - (notes[b] as WrittenNote).midi);
    for (const t of [...freeTones]) {
      const n = rest.shift() as number;
      paired.push({ tone: t, note: n, rule: 'pitch' });
      freeTones.delete(t);
      freeNotes.delete(n);
    }
  }
  paired.sort((a, b) => a.tone - b.tone);
  return { paired, missing: [...freeTones], extra: [...freeNotes] };
}

function checkScale(
  key: KeyClaim,
  scale: ScaleClaim,
  found: readonly WrittenNote[],
  reading: Reading,
): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  const expected = scale.degrees.map((d) => scaleNote(key, scale.tonicOctave, d));
  const base = { kind: 'theory' as const, chordIndex: -1, hand: scale.hand, rule: 'scale' as const };
  const compared = Math.min(expected.length, found.length);
  for (let i = 0; i < compared; i++) {
    const e = expected[i] as Tone & { octave: number };
    const f = found[i] as WrittenNote;
    if (e.step !== f.step || e.alter !== f.alter || e.octave !== f.octave)
      out.push({ ...base, scaleNote: i, bar: f.bar, expected: describeNote(e), found: describeNote(f) });
  }
  if (expected.length !== found.length)
    out.push({
      ...base,
      scaleNote: compared,
      bar: found[compared]?.bar ?? found[found.length - 1]?.bar ?? reading.firstBar,
      expected: `${expected.length} notes`,
      found: `${found.length} notes`,
    });
  return out;
}

// ---- exercise-theory-v2: sections ---------------------------------------------------------------------------------------
// A section is a run of bars in one key. Each hand's single notes in those bars are checked against what the claim says the
// hand plays: a scale (spelled by letter arithmetic, the melodic minor's direction rule included), the single notes of a broken
// or root-fifth chord, or nothing. Simultaneous chords are compared through `claim.chords` as before.

/** One scale degree with the alteration the form asks for, going up or down. */
function formScaleNote(
  key: KeyClaim,
  tonicOctave: number,
  form: ScaleForm,
  degree: number,
  ascending: boolean,
): Tone & { octave: number } {
  const base = scaleToneAt(key, degree - 1);
  const octave = tonicOctave + Math.floor((letterIndex(key.tonicLetter) + degree - 1) / LETTERS_PER_OCTAVE);
  let raise = 0;
  if (key.mode === 'minor') {
    if (degree === 7 && (form === 'harmonic' || ascending)) raise = LEADING_TONE_RAISE;
    if (degree === 6 && form === 'melodic' && ascending) raise = LEADING_TONE_RAISE;
  }
  return { step: base.step, alter: alterFor(base.step, tonicPc(key) + base.semitones + raise), octave };
}

function checkSections(
  sections: readonly SectionClaim[],
  singles: ReadonlyMap<Hand, WrittenNote[]>,
  reading: Reading,
): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  let chordIndex = 0;
  for (const section of sections) {
    const inSection = (n: WrittenNote): boolean => {
      const bar = Number(n.bar);
      return bar >= section.firstBar && bar <= section.lastBar;
    };
    for (const hand of HANDS_ORDER) {
      const part = section[hand];
      const found = (singles.get(hand) ?? []).filter(inSection);
      const firstBar = String(section.firstBar);
      if (part.kind === 'rest') {
        const stray = found[0];
        if (stray)
          out.push({
            kind: 'theory',
            chordIndex: -1,
            bar: stray.bar,
            hand,
            rule: 'hands',
            expected: 'no notes',
            found: describeNote(stray),
          });
      } else if (part.kind === 'scale') {
        out.push(...checkSectionScale(section.key, hand, part, found, firstBar));
      } else if (part.kind === 'melody') {
        // exercise-theory-v3: the melody check (melody-rules.ts) judges these notes, run from the audit record.
      } else {
        const expected: Tone[] = [];
        for (const chord of part.chords) {
          if (chord.voicing === 'triad') continue;
          const tones = expectedChordTones(section.key, { ...chord, hands: [hand] });
          const pattern = chord.voicing === 'broken' ? [0, 1, 2, 1] : [0, 2];
          for (const i of pattern) expected.push(tones[i] as Tone);
        }
        out.push(...checkSectionVoicing(hand, expected, found, firstBar, chordIndex, reading));
      }
      chordIndex += part.kind === 'chords' ? part.chords.length : 0;
    }
  }
  return out;
}

function checkSectionScale(
  key: KeyClaim,
  hand: Hand,
  claimed: Extract<SectionHand, { kind: 'scale' }>,
  found: readonly WrittenNote[],
  firstBar: string,
): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  let ascending = true;
  let previous = 0;
  const expected = claimed.degrees.map((degree) => {
    if (previous !== 0 && degree < previous) ascending = false;
    else if (previous !== 0 && degree > previous) ascending = true;
    previous = degree;
    return formScaleNote(key, claimed.tonicOctave, claimed.form, degree, ascending);
  });
  const base = { kind: 'theory' as const, chordIndex: -1, hand, rule: 'scale' as const };
  const compared = Math.min(expected.length, found.length);
  for (let i = 0; i < compared; i++) {
    const e = expected[i] as Tone & { octave: number };
    const f = found[i] as WrittenNote;
    if (e.step !== f.step || e.alter !== f.alter || e.octave !== f.octave)
      out.push({ ...base, scaleNote: i, bar: f.bar, expected: describeNote(e), found: describeNote(f) });
  }
  if (expected.length !== found.length)
    out.push({
      ...base,
      scaleNote: compared,
      bar: found[compared]?.bar ?? found[found.length - 1]?.bar ?? firstBar,
      expected: `${expected.length} notes`,
      found: `${found.length} notes`,
    });
  return out;
}

/** The single notes of broken and root-fifth chords, one expected tone each, in order. */
function checkSectionVoicing(
  hand: Hand,
  expected: readonly Tone[],
  found: readonly WrittenNote[],
  firstBar: string,
  chordIndex: number,
  reading: Reading,
): TheoryDifference[] {
  const out: TheoryDifference[] = [];
  const compared = Math.min(expected.length, found.length);
  for (let i = 0; i < compared; i++) {
    const note = found[i] as WrittenNote;
    out.push(
      ...checkHand({ kind: 'theory', chordIndex, bar: note.bar }, hand, [expected[i] as Tone], undefined, [note]),
    );
  }
  if (expected.length !== found.length)
    out.push({
      kind: 'theory',
      chordIndex,
      bar: found[compared]?.bar ?? found[found.length - 1]?.bar ?? (firstBar || reading.firstBar),
      hand,
      rule: 'voicing',
      expected: `${expected.length} single notes`,
      found: `${found.length} single notes`,
    });
  return out;
}
