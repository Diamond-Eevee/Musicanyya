// pnpm library:songs [--song <id>] (contract song-definition 1.0.0 §2): builds a song item from an approved public-domain
// source. The right hand is the source's melody, taken with the 007 LilyPond reader and cross-checked against the source's own
// MIDI before anything is written; the left hand is our own block chords from the definition's chord plan, with the chord
// names printed above staff 1. Nothing is written when the source is unapproved, the MIDI disagrees, or the plan leaves a
// full bar without a chord.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chordTones, impliedQuality, pitchClassOfTone, rawOffset } from '../../src/core/library/exercise/degrees.js';
import type { ExerciseKey, Quality } from '../../src/core/library/exercise/types.js';
import { applyInserts, planEngraving } from '../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../src/core/musicxml/read.js';
import {
  type WriteDirection,
  type WriteDuration,
  type WriteEvent,
  type WriteMeasure,
  type WriteNote,
  type WritePitch,
  writeScoreXml,
} from '../../src/core/musicxml/write.js';
import { compareSound, describeDifference, parseInterval, transposeSpelling } from './fidelity/compare.js';
import { fromMidi, readMidi } from './fidelity/midi.js';
import { type ReferenceBar, type ReferenceNote, type Spelling, spellingMidi } from './fidelity/reference.js';
import { loadSources, type SourceManifest, sourceFile } from './fidelity/sources.js';
import { add, cmp, type QuarterTime, q, show, sub } from './fidelity/time.js';
import { readLilyPond, readWritten } from './lilypond/read.js';
import { type SongChordEntry, type SongDefinition, validateSongDefinition } from './songs/definition.js';

export interface BuildSongOptions {
  /** The approved sources (`loadSources`), by id. */
  sources: ReadonlyMap<string, SourceManifest>;
  sourcesRoot: string;
  generatedOn: string;
  /** `stepOrder` of the item: 10 x its position in its folder (`buildSongs`). */
  stepOrder: number;
}

export interface BuiltSong {
  id: string;
  xml: string;
  sidecar: Record<string, unknown>;
}

const LEFT_HAND_DEPARTURE = 'Left-hand block chords are our own (CC0).';
const ARRANGER = 'Musicanyya practice material';
/** The library guard (FR-007) wants the word "arrangement" in the title or subtitle of an arrangement. */
const SUBTITLE = 'Arrangement: the tune with left-hand block chords';
/** The root of a chord lies in C3-B3 (MIDI 48-59); a triad whose top would pass E4 is written an octave lower. */
const ROOT_FLOOR_MIDI = 48;
const TOP_CEILING_MIDI = 64;
const OCTAVE = 12;
const MELODY_VOICE = '1';
const CHORD_VOICE = '5';
const LEFT_HAND_FINGERS: readonly [number, number, number] = [5, 3, 1];
const LEFT_HAND_SECOND_INVERSION_FINGERS: readonly [number, number, number] = [5, 2, 1];

/** Every value a note or rest may be written as, longest first, in quarter notes: whole to 32nd, single dots included. */
const VALUES: { length: QuarterTime; type: WriteDuration; dot: boolean }[] = [
  { length: q(4), type: 'whole', dot: false },
  { length: q(3), type: 'half', dot: true },
  { length: q(2), type: 'half', dot: false },
  { length: q(3, 2), type: 'quarter', dot: true },
  { length: q(1), type: 'quarter', dot: false },
  { length: q(3, 4), type: 'eighth', dot: true },
  { length: q(1, 2), type: 'eighth', dot: false },
  { length: q(3, 8), type: '16th', dot: true },
  { length: q(1, 4), type: '16th', dot: false },
  { length: q(3, 16), type: '32nd', dot: true },
  { length: q(1, 8), type: '32nd', dot: false },
];

interface ItemBar {
  number: string;
  /** Start in the item's own timeline (the selected bars laid end to end). */
  start: QuarterTime;
  length: QuarterTime;
  source: ReferenceBar;
}

/** A note or rest as written: one value of `VALUES`, tied to its neighbours when the sounding note was longer. */
interface Atom {
  start: QuarterTime;
  length: QuarterTime;
  type: WriteDuration;
  dot: boolean;
  pitches?: { pitch: WritePitch; finger?: number }[];
  tieStart: boolean;
  tieStop: boolean;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** The ordered values that add up to `length`, longest first; throws when the length is not a sum of `VALUES`. */
function decompose(length: QuarterTime, where: string): (typeof VALUES)[number][] {
  const out: (typeof VALUES)[number][] = [];
  let rest = length;
  while (rest.num > 0) {
    const value = VALUES.find((v) => cmp(v.length, rest) <= 0);
    if (!value) throw new Error(`${where}: ${show(rest)} quarter notes cannot be written as a note value`);
    out.push(value);
    rest = sub(rest, value.length);
  }
  return out;
}

/** Splits [from, to) at every cut point inside it. */
function segments(from: QuarterTime, to: QuarterTime, cuts: readonly QuarterTime[]): [QuarterTime, QuarterTime][] {
  const points = [from, ...cuts.filter((c) => cmp(c, from) > 0 && cmp(c, to) < 0), to];
  const out: [QuarterTime, QuarterTime][] = [];
  for (let i = 0; i + 1 < points.length; i++) out.push([points[i] as QuarterTime, points[i + 1] as QuarterTime]);
  return out;
}

/** The atoms of one span of time: cut at `cuts`, each cut piece written as standard values; a sounding note is tied through
 *  all its atoms, a rest is not. */
function atomsFor(
  from: QuarterTime,
  to: QuarterTime,
  cuts: readonly QuarterTime[],
  pitches: Atom['pitches'] | undefined,
  where: string,
): Atom[] {
  const out: Atom[] = [];
  for (const [a, b] of segments(from, to, cuts)) {
    let start = a;
    for (const value of decompose(sub(b, a), where)) {
      out.push({
        start,
        length: value.length,
        type: value.type,
        dot: value.dot,
        ...(pitches ? { pitches } : {}),
        tieStart: false,
        tieStop: false,
      });
      start = add(start, value.length);
    }
  }
  if (pitches)
    out.forEach((atom, i) => {
      atom.tieStart = i < out.length - 1;
      atom.tieStop = i > 0;
    });
  return out;
}

const intervalOf = (definition: SongDefinition) =>
  definition.melody.transpose === undefined ? undefined : parseInterval(definition.melody.transpose);

const pitchOf = (s: Spelling): WritePitch => ({
  step: s.step,
  ...(s.alter !== 0 ? { alter: s.alter } : {}),
  octave: s.octave,
});

/** Beat length in quarter notes: a quarter in x/4, a dotted quarter in compound x/8 time, an eighth in other x/8. */
function beatLength(num: number, den: number, id: string): QuarterTime {
  if (den === 4) return q(1);
  if (den === 2) return q(2);
  if (den === 8) return num % 3 === 0 && num > 3 ? q(3, 2) : q(1, 2);
  throw new Error(`${id}: metre ${num}/${den} is not supported`);
}

/** One chord of the plan: where it starts and stops in the item's timeline and what it is. */
interface PlannedChord {
  entry: SongChordEntry;
  start: QuarterTime;
  end: QuarterTime;
}

/** One way of playing a chord: its printed name and its notes, lowest first. */
interface Voicing {
  name: string;
  notes: { pitch: WritePitch; midi: number; finger: number }[];
}

/** A triad in close position for `inversion`, the root in C3-B3 and the whole triad an octave lower when its top would pass
 *  E4; `lower` moves it a further octave down. */
function voiceChord(key: ExerciseKey, entry: SongChordEntry, inversion: 0 | 1 | 2, lower: boolean): Voicing {
  const tones = chordTones(key, entry.degree, entry.quality);
  const [root, third, fifth] = tones as [(typeof tones)[number], (typeof tones)[number], (typeof tones)[number]];
  const rootPc = pitchClassOfTone(root);
  const above = (tone: typeof root): number =>
    ROOT_FLOOR_MIDI + rootPc + ((((pitchClassOfTone(tone) - rootPc) % OCTAVE) + OCTAVE) % OCTAVE);
  const stacked = [
    { tone: root, midi: above(root) },
    { tone: third, midi: above(third) },
    { tone: fifth, midi: above(fifth) },
  ];
  const ordered =
    inversion === 0
      ? stacked
      : inversion === 1
        ? [stacked[1], stacked[2], { tone: root, midi: (stacked[0] as { midi: number }).midi + OCTAVE }]
        : [
            stacked[2],
            { tone: root, midi: (stacked[0] as { midi: number }).midi + OCTAVE },
            { tone: third, midi: (stacked[1] as { midi: number }).midi + OCTAVE },
          ];
  const notes = ordered as { tone: typeof root; midi: number }[];
  const drop = (Math.max(...notes.map((n) => n.midi)) > TOP_CEILING_MIDI ? OCTAVE : 0) + (lower ? OCTAVE : 0);
  const fingers = inversion === 2 ? LEFT_HAND_SECOND_INVERSION_FINGERS : LEFT_HAND_FINGERS;
  const quality: Quality = entry.quality ?? impliedQuality(entry.degree);
  const suffix = quality === 'minor' ? 'm' : quality === 'diminished' ? '°' : quality === 'augmented' ? '+' : '';
  const accidental = root.alter > 0 ? '♯'.repeat(root.alter) : root.alter < 0 ? '♭'.repeat(-root.alter) : '';
  return {
    name: `${root.step}${accidental}${suffix}`,
    notes: notes.map((n, i) => {
      const midi = n.midi - drop;
      const pitch: WritePitch = {
        step: n.tone.step,
        ...(n.tone.alter !== 0 ? { alter: n.tone.alter } : {}),
        octave: (midi - rawOffset(n.tone)) / OCTAVE - 1,
      };
      return { pitch, midi, finger: fingers[i] as number };
    }),
  };
}

/** The voicing of a chord that one pianist can play under the melody: with an inversion in the plan only that inversion is
 *  tried, otherwise all three, each also an octave lower. Preferred is one that lies wholly below the melody sounding over
 *  the chord (the hands never cross), then one that at least never shares a key with it; among these the one nearest the
 *  previous chord's register, root position first. `undefined` when every voicing shares a key with the melody. */
function chooseVoicing(
  key: ExerciseKey,
  entry: SongChordEntry,
  melodyMidis: readonly number[],
  previousMean: number | undefined,
): Voicing | undefined {
  // the plan's own voicing (root position unless it names an inversion) stands wherever it stays clear of the melody
  const planned = voiceChord(key, entry, entry.inversion ?? 0, false);
  if (melodyMidis.every((m) => m > Math.max(...planned.notes.map((n) => n.midi)))) return planned;
  const inversions: (0 | 1 | 2)[] = entry.inversion === undefined ? [0, 1, 2] : [entry.inversion];
  const all = inversions.flatMap((inversion) => [false, true].map((lower) => voiceChord(key, entry, inversion, lower)));
  const mean = (v: Voicing) => v.notes.reduce((sum, n) => sum + n.midi, 0) / v.notes.length;
  const top = (v: Voicing) => Math.max(...v.notes.map((n) => n.midi));
  const sharesKey = (v: Voicing) => v.notes.some((n) => melodyMidis.includes(n.midi));
  const below = all.filter((v) => melodyMidis.every((m) => m > top(v)));
  const pool = below.length > 0 ? below : all.filter((v) => !sharesKey(v));
  if (pool.length === 0) return undefined;
  if (previousMean === undefined) return pool[0];
  return pool.reduce((best, v) => (Math.abs(mean(v) - previousMean) < Math.abs(mean(best) - previousMean) ? v : best));
}

export function buildSong(definition: SongDefinition, options: BuildSongOptions): BuiltSong {
  const id = definition.id;
  const manifest = options.sources.get(definition.source);
  if (!manifest)
    throw new Error(`${id}: source ${definition.source} is not an approved source under content/library/sources`);
  const notation = sourceFile(options.sourcesRoot, manifest, 'notation');
  if (notation?.file.format !== 'lilypond')
    throw new Error(`${id}: source ${manifest.id} has no LilyPond notation file`);
  const lily = readLilyPond(
    new TextDecoder().decode(notation.bytes),
    notation.file.score !== undefined ? { score: notation.file.score } : {},
  );
  const { reading, events } = readWritten(lily);

  // the source's own MIDI must agree with our reading of its notation (contract §2 step 2)
  const sound = sourceFile(options.sourcesRoot, manifest, 'sound');
  if (!sound) throw new Error(`${id}: source ${manifest.id} has no sound file: the melody cannot be cross-checked`);
  const cross = compareSound(reading, fromMidi(readMidi(sound.bytes), sound.file.midiNoteTracks ?? []), {
    order: sound.file.midiOrder ?? 'written',
    articulate: sound.file.midiArticulate ?? false,
  });
  if (cross.differences.length > 0)
    throw new Error(
      `${id}: the source MIDI does not agree with the reading of its notation:\n${cross.differences.map((d) => `  ${describeDifference(d)}`).join('\n')}`,
    );

  // the metre and the bars of the item: the selected source bars laid end to end
  const times = events.filter((e): e is Extract<typeof e, { kind: 'time' }> => e.kind === 'time');
  const first = times[0];
  if (!first) throw new Error(`${id}: the source names no time signature`);
  if (times.some((t) => t.num !== first.num || t.den !== first.den))
    throw new Error(`${id}: the source changes metre; songs keep one metre`);
  const fullBar = q(4 * first.num, first.den);
  const beat = beatLength(first.num, first.den, id);
  const range = definition.melody.bars === 'all' ? undefined : definition.melody.bars.split('-').map(Number);
  const selected = reading.bars.filter(
    (b) =>
      range === undefined || (Number(b.number) >= (range[0] as number) && Number(b.number) <= (range[1] as number)),
  );
  const firstBar = selected[0];
  if (!firstBar) throw new Error(`${id}: melody.bars "${definition.melody.bars}" holds no bar of the source`);
  const firstNumber = Number(firstBar.number);
  const bars: ItemBar[] = [];
  let cursor = q(0);
  selected.forEach((source, i) => {
    const irregular = cmp(source.length, fullBar) !== 0;
    // only a pickup (first bar) and its matching short last bar may be shorter than the metre
    if (cmp(source.length, fullBar) > 0 || (irregular && i > 0 && i < selected.length - 1))
      throw new Error(`${id}: source bar ${source.number} is not a full bar`);
    const number = firstNumber === 0 ? Number(source.number) : Number(source.number) - firstNumber + 1;
    bars.push({ number: String(number), start: cursor, length: source.length, source });
    cursor = add(cursor, source.length);
  });
  const end = cursor;

  // the chord plan in the item's timeline, and the check that every full bar has a chord
  const chords: PlannedChord[] = definition.chords.map((entry, i) => {
    const bar = bars.find((b) => b.number === String(entry.bar));
    if (!bar) throw new Error(`${id}: chords[${i}] names bar ${entry.bar}, which the item does not have`);
    return { entry, start: add(bar.start, timesBeat(entry.beat ?? 1, beat)), end };
  });
  chords.forEach((chord, i) => {
    const next = chords[i + 1];
    const until = chord.entry.until;
    let stop = next ? next.start : end;
    if (until !== undefined) {
      const [untilBar, untilBeat] = until.split(':') as [string, string];
      const bar = bars.find((b) => b.number === untilBar);
      if (!bar) throw new Error(`${id}: chords[${i}].until names bar ${untilBar}, which the item does not have`);
      stop = add(bar.start, timesBeat(Number(untilBeat), beat));
    }
    if (cmp(stop, chord.start) <= 0) throw new Error(`${id}: chords[${i}] ends before it starts`);
    chord.end = stop;
  });
  for (const bar of bars) {
    if (cmp(bar.length, fullBar) !== 0) continue;
    const barEnd = add(bar.start, bar.length);
    let covered = bar.start;
    for (const c of chords) if (cmp(c.start, covered) <= 0 && cmp(c.end, covered) > 0) covered = c.end;
    if (cmp(covered, barEnd) < 0) throw new Error(`${id}: the chord plan leaves bar ${bar.number} without a chord`);
  }

  // the melody: the named voice, one note per onset (with topVoice the highest note of each chord in that voice)
  const interval = intervalOf(definition);
  const inSelection = new Map(selected.map((b, i) => [b.index, bars[i] as ItemBar]));
  const byOnset = new Map<string, { note: ReferenceNote; bar: ItemBar }[]>();
  for (const note of reading.notes) {
    const bar = inSelection.get(note.bar);
    if (!bar || (note.staff ?? 1) !== definition.melody.staff || note.voice !== definition.melody.voice) continue;
    const key = show(note.onset);
    byOnset.set(key, [...(byOnset.get(key) ?? []), { note, bar }]);
  }
  const melody = [...byOnset.values()]
    .map((group) => {
      if (!definition.melody.topVoice && group.length > 1)
        throw new Error(`${id}: the melody voice has a chord at bar ${group[0]?.bar.number}; use topVoice`);
      return group.reduce((a, b) => (b.note.midi > a.note.midi ? b : a));
    })
    .map(({ note, bar }) => {
      if (!note.spelling) throw new Error(`${id}: a melody note has no spelling`);
      const spelling = interval ? transposeSpelling(note.spelling, interval) : note.spelling;
      return { start: add(bar.start, sub(note.onset, bar.source.start)), length: note.duration, spelling };
    })
    .sort((a, b) => cmp(a.start, b.start));
  melody.forEach((m, i) => {
    const next = melody[i + 1];
    const stop = add(m.start, m.length);
    const limit = next ? next.start : end;
    m.length = sub(cmp(stop, limit) > 0 ? limit : stop, m.start);
  });
  if (melody.length === 0)
    throw new Error(`${id}: the melody staff ${definition.melody.staff} holds no note in the selected bars`);

  // atoms of both hands
  const barCuts = bars.map((b) => b.start);
  const chordCuts = chords.map((c) => c.start);
  const rightAtoms: Atom[] = [];
  let at = q(0);
  for (const m of melody) {
    if (cmp(m.start, at) > 0) rightAtoms.push(...atomsFor(at, m.start, barCuts, undefined, `${id}: a rest`));
    rightAtoms.push(
      ...atomsFor(
        m.start,
        add(m.start, m.length),
        [...barCuts, ...chordCuts],
        [{ pitch: pitchOf(m.spelling) }],
        `${id}: a melody note`,
      ),
    );
    at = add(m.start, m.length);
  }
  if (cmp(at, end) < 0) rightAtoms.push(...atomsFor(at, end, barCuts, undefined, `${id}: a rest`));

  const key: ExerciseKey = { tonic: definition.key.tonic, mode: definition.key.mode, fifths: definition.key.fifths };
  const leftAtoms: Atom[] = [];
  const names = new Map<string, string>();
  let previousMean: number | undefined;
  at = q(0);
  for (const c of chords) {
    if (cmp(c.start, at) > 0) leftAtoms.push(...atomsFor(at, c.start, barCuts, undefined, `${id}: a left-hand rest`));
    const sounding = melody
      .filter((m) => cmp(m.start, c.end) < 0 && cmp(add(m.start, m.length), c.start) > 0)
      .map((m) => spellingMidi(m.spelling));
    const voiced = chooseVoicing(key, c.entry, sounding, previousMean);
    if (!voiced)
      throw new Error(`${id}: no voicing of the chord at bar ${c.entry.bar} keeps the left hand off the melody's keys`);
    previousMean = voiced.notes.reduce((sum, n) => sum + n.midi, 0) / voiced.notes.length;
    names.set(show(c.start), voiced.name);
    leftAtoms.push(...atomsFor(c.start, c.end, barCuts, voiced.notes, `${id}: a chord`));
    at = c.end;
  }
  if (cmp(at, end) < 0) leftAtoms.push(...atomsFor(at, end, barCuts, undefined, `${id}: a left-hand rest`));

  // ticks
  let divisions = 1;
  for (const a of [...rightAtoms, ...leftAtoms]) {
    divisions = (divisions * a.length.den) / gcd(divisions, a.length.den);
    divisions = (divisions * a.start.den) / gcd(divisions, a.start.den);
  }
  const ticks = (t: QuarterTime): number => (t.num * divisions) / t.den;

  const noteOf = (atom: Atom, staff: number, voice: string): WriteNote[] => {
    const base = {
      duration: ticks(atom.length),
      voice,
      type: atom.type,
      ...(atom.dot ? { dot: true } : {}),
      staff,
    };
    if (!atom.pitches) return [{ ...base, rest: true }];
    return atom.pitches.map((p, i) => ({
      ...base,
      pitch: p.pitch,
      ...(i > 0 ? { chord: true } : {}),
      ...(p.finger !== undefined ? { fingering: p.finger } : {}),
      ...(atom.tieStart || atom.tieStop
        ? { tie: { ...(atom.tieStart ? { start: true } : {}), ...(atom.tieStop ? { stop: true } : {}) } }
        : {}),
    }));
  };

  const measures: WriteMeasure[] = bars.map((bar, index) => {
    const barEnd = add(bar.start, bar.length);
    const within = (a: Atom) => cmp(a.start, bar.start) >= 0 && cmp(a.start, barEnd) < 0;
    const events: WriteEvent[] = [];
    if (bar.source.repeatStart)
      events.push({ kind: 'barline', location: 'left', barStyle: 'heavy-light', repeat: { direction: 'forward' } });
    if (index === 0)
      events.push({
        kind: 'direction',
        metronome: { beatUnit: 'quarter', perMinute: definition.tempoBpm },
        tempo: definition.tempoBpm,
        staff: 1,
        placement: 'above',
      } satisfies WriteDirection & { kind: 'direction' });
    for (const atom of rightAtoms.filter(within)) {
      const name = names.get(show(atom.start));
      if (name !== undefined) events.push({ kind: 'direction', words: name, staff: 1, placement: 'above' });
      const single = rightAtoms.filter(within).length === 1 && !atom.pitches;
      if (single)
        events.push({
          kind: 'note',
          note: {
            rest: true,
            measureRest: true,
            duration: ticks(bar.length),
            voice: MELODY_VOICE,
            type: 'whole',
            staff: 1,
          },
        });
      else for (const note of noteOf(atom, 1, MELODY_VOICE)) events.push({ kind: 'note', note });
    }
    events.push({ kind: 'backup', duration: ticks(bar.length) });
    for (const atom of leftAtoms.filter(within))
      for (const note of noteOf(atom, 2, CHORD_VOICE)) events.push({ kind: 'note', note });
    const last = index === bars.length - 1;
    if (last || bar.source.repeatEnd)
      events.push({
        kind: 'barline',
        location: 'right',
        barStyle: 'light-heavy',
        ...(bar.source.repeatEnd
          ? {
              repeat: {
                direction: 'backward' as const,
                ...(bar.source.repeatTimes ? { times: bar.source.repeatTimes } : {}),
              },
            }
          : {}),
      });
    return {
      number: bar.number,
      // a pickup, and the short last bar that completes it, are not full measures (MusicXML implicit)
      ...(cmp(bar.length, fullBar) !== 0 ? { implicit: true } : {}),
      ...(index === 0
        ? {
            attributes: {
              divisions,
              key: { fifths: definition.key.fifths, mode: definition.key.mode },
              time: { beats: String(first.num), beatType: first.den },
              staves: 2,
              clefs: [
                { number: 1, sign: 'G', line: 2 },
                { number: 2, sign: 'F', line: 4 },
              ],
            },
          }
        : {}),
      events,
    };
  });

  const raw = writeScoreXml({
    title: definition.title,
    composer: definition.meta.composer ?? 'Traditional',
    rights: `Melody: public domain (${manifest.work}, ${manifest.publisher}); left hand: CC0 1.0.`,
    source: manifest.url,
    parts: [{ id: 'P1', name: 'Piano', measures }],
  });
  const doc = readXml(raw).doc;
  const plan = planEngraving(doc, 'library');
  const xml = plan.inserts.length > 0 ? applyInserts(raw, plan.inserts) : raw;

  const departures = [LEFT_HAND_DEPARTURE, ...(definition.meta.departures ?? [])];
  const sidecar: Record<string, unknown> = {
    version: 1,
    title: definition.title,
    ...(definition.meta.composer ? { composer: definition.meta.composer } : {}),
    subtitle: SUBTITLE,
    arranger: ARRANGER,
    kind: 'piece',
    level: definition.meta.level,
    arrangement: true,
    tags: ['chords', 'hands-together'],
    trains: definition.meta.trains,
    hands: 'both',
    provenance: {
      origin: 'authored',
      licence: 'CC0-1.0',
      author: definition.meta.reviewedBy,
      created: options.generatedOn,
      basedOn: `${manifest.id}: ${manifest.work} (${manifest.url})`,
      note: `Melody from ${manifest.edition} (${manifest.url}), public domain; left-hand chords our own (CC0)`,
    },
    departures,
    reviewedBy: definition.meta.reviewedBy,
    reviewedOn: definition.meta.reviewedOn,
    step: 'song',
    stepOrder: options.stepOrder,
  };
  return { id, xml, sidecar };
}

/** Beat number (from 1) as an offset from the start of a bar. */
function timesBeat(beatNumber: number, beat: QuarterTime): QuarterTime {
  const steps = Math.round((beatNumber - 1) * 4);
  return q(steps * beat.num, 4 * beat.den);
}

/** Builds every definition in `contentDir` into `libraryRoot`; returns the written .musicxml paths relative to it. */
export async function buildSongs(
  contentDir: string,
  libraryRoot: string,
  sourcesRoot: string,
  generatedOn: string,
  only?: string,
): Promise<string[]> {
  const sources = loadSources(sourcesRoot);
  const ids = new Set(sources.keys());
  const definitions = readdirSync(contentDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => validateSongDefinition(JSON.parse(readFileSync(join(contentDir, f), 'utf8')), ids));

  // stepOrder: 10 x the position in the folder, beginner songs first, then intermediate, each by title
  const byFolder = new Map<string, SongDefinition[]>();
  for (const d of definitions) byFolder.set(dirname(d.id), [...(byFolder.get(dirname(d.id)) ?? []), d]);
  const stepOrders = new Map<string, number>();
  for (const list of byFolder.values()) {
    const rank = (d: SongDefinition) => (d.meta.level === 'beginner' ? 0 : 1);
    const ordered = [...list].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
    ordered.forEach((d, i) => {
      stepOrders.set(d.id, (i + 1) * 10);
    });
  }

  const written: string[] = [];
  for (const definition of definitions) {
    if (only !== undefined && definition.id !== only) continue;
    const built = buildSong(definition, {
      sources,
      sourcesRoot,
      generatedOn,
      stepOrder: stepOrders.get(definition.id) as number,
    });
    const xmlPath = join(libraryRoot, `${built.id}.musicxml`);
    mkdirSync(dirname(xmlPath), { recursive: true });
    writeFileSync(xmlPath, built.xml);
    writeFileSync(join(libraryRoot, `${built.id}.json`), `${JSON.stringify(built.sidecar, null, 2)}\n`);
    written.push(relative(libraryRoot, xmlPath));
  }
  if (only !== undefined && written.length === 0) throw new Error(`no song definition has the id ${only}`);
  return written;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const at = args.indexOf('--song');
  const only = at >= 0 ? args[at + 1] : undefined;
  if (at >= 0 && only === undefined) {
    console.log('usage: pnpm library:songs [--song <id>]');
    return 2;
  }
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const contentDir = join(root, 'content/library/songs');
  if (!existsSync(contentDir)) {
    console.log('no content/library/songs folder: nothing to build');
    return 0;
  }
  try {
    const written = await buildSongs(
      contentDir,
      join(root, 'public/library'),
      join(root, 'content/library/sources'),
      new Date().toISOString().slice(0, 10),
      only,
    );
    console.log(`Wrote ${written.length} song(s).`);
    return 0;
  } catch (e) {
    console.log(`error: ${(e as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
