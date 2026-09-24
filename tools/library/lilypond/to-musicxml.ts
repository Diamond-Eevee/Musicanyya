// The LilyPond -> MusicXML converter (contract fidelity-tools.md §3.3). It writes what the printed page shows, through
// the app's own writer (src/core/musicxml/write.ts, research R13): the measures are the reading's written bars, so a
// conversion read back with fromMusicXml gives the same reading on every aspect (library:convert-ly checks that).
//
// Marks that change what the app plays or grades (dynamics, ornaments, arpeggios, segno/coda) are written or the
// conversion fails; display-only marks the writer cannot express are dropped and listed, never lost silently.
// Beams and accidentals are left to `pnpm library:engrave`, as for every library file.
import {
  type WriteArticulation,
  type WriteBarline,
  type WriteDirection,
  type WriteDuration,
  type WriteEvent,
  type WriteMeasure,
  type WriteMeasureAttributes,
  type WriteNote,
  type WriteOrnament,
  writeScoreXml,
} from '../../../src/core/musicxml/write';
import type { ReferenceBar } from '../fidelity/reference';
import { spellingMidi } from '../fidelity/reference';
import { add, cmp, type QuarterTime, q, show, sub } from '../fidelity/time';
import { LyUnsupportedError } from './errors';
import type { LyPitch, Pos } from './parse';
import { type LyEvent, type LyMark, type LyScore, readWritten } from './read';

export interface ConvertMeta {
  title?: string;
  composer?: string;
  rights?: string;
  source?: string;
}

export interface Conversion {
  xml: string;
  /** Display-only marks that could not be written, one line each: "bar 2, beat 3: \markup text (not converted)". */
  dropped: string[];
}

type Written = Extract<LyEvent, { kind: 'note' | 'rest' }>;
type NoteEvent = Extract<LyEvent, { kind: 'note' }>;

const TYPES = new Map<number, WriteDuration>([
  [0.5, 'breve'],
  [1, 'whole'],
  [2, 'half'],
  [4, 'quarter'],
  [8, 'eighth'],
  [16, '16th'],
  [32, '32nd'],
  [64, '64th'],
]);

const CLEFS: Record<string, { sign: string; line: number }> = {
  treble: { sign: 'G', line: 2 },
  violin: { sign: 'G', line: 2 },
  G: { sign: 'G', line: 2 },
  G2: { sign: 'G', line: 2 },
  french: { sign: 'G', line: 1 },
  bass: { sign: 'F', line: 4 },
  F: { sign: 'F', line: 4 },
  varbaritone: { sign: 'F', line: 3 },
  subbass: { sign: 'F', line: 5 },
  alto: { sign: 'C', line: 3 },
  C: { sign: 'C', line: 3 },
  tenor: { sign: 'C', line: 4 },
  soprano: { sign: 'C', line: 1 },
  mezzosoprano: { sign: 'C', line: 2 },
  baritone: { sign: 'C', line: 5 },
};
const TREBLE = { sign: 'G', line: 2 };

/** Letter -> fifths of the natural major key (C = 0 ... B = 5, F = -1). */
const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5];

const ARTICULATIONS: Record<string, WriteArticulation> = {
  '.': 'staccato',
  staccato: 'staccato',
  '>': 'accent',
  accent: 'accent',
  '-': 'tenuto',
  tenuto: 'tenuto',
};
/** Ornaments the app reads (build.ts) or prints as they are. */
const ORNAMENTS: Record<string, WriteOrnament> = {
  trill: 'trill-mark',
  startTrillSpan: 'trill-mark',
  mordent: 'mordent',
  prall: 'inverted-mordent',
  turn: 'turn',
};
const FERMATAS = new Set(['fermata', 'shortfermata', 'longfermata', 'verylongfermata']);
/** Post-events that only close something already written, or that LilyPond itself does not print. */
const SILENT = new Set(['stopTrillSpan']);
/** Navigation marks: they change what the app plays, and the writer cannot express them yet. */
const NAVIGATION = new Set(['segno', 'coda', 'varcoda']);

/** MusicXML <dynamics> children (MusicXML 4.0). */
const DYNAMICS = new Set(
  'p pp ppp pppp ppppp pppppp f ff fff ffff fffff ffffff mp mf sf sfp sfpp fp rf rfz sfz sffz fz n pf sfzp'.split(' '),
);
const TEXT_SPANNERS: Record<string, string> = { cresc: 'cresc.', decresc: 'decresc.', dim: 'dim.' };

const BAR_STYLES: Record<string, string> = {
  '|': 'regular',
  '|.': 'light-heavy',
  '||': 'light-light',
  '.|': 'heavy-light',
  '.': 'heavy',
  '!': 'dashed',
  ';': 'dotted',
};

export function toMusicXml(score: LyScore, meta: ConvertMeta = {}): Conversion {
  const { reading, events, staves } = readWritten(score);
  const bars = reading.bars;
  const end = add((bars.at(-1) as ReferenceBar).start, (bars.at(-1) as ReferenceBar).length);
  const dropped: string[] = [];

  const barIndexAt = (t: QuarterTime): number => {
    for (let i = bars.length - 1; i >= 0; i--) if (cmp((bars[i] as ReferenceBar).start, t) <= 0) return i;
    return 0;
  };
  const where = (t: QuarterTime): string => {
    const bar = bars[barIndexAt(t)] as ReferenceBar;
    return `bar ${bar.number}, beat ${show(sub(t, bar.start))}`;
  };
  const drop = (t: QuarterTime, what: string) => dropped.push(`${where(t)}: ${what} (not converted)`);

  // ---- divisions: one per piece, fine enough for every onset and value -------------------------------------------
  let divisions = 1;
  const need = (x: QuarterTime) => {
    divisions = lcm(divisions, x.den);
  };
  for (const b of bars) {
    need(b.start);
    need(b.length);
  }
  for (const e of events) {
    need(e.t);
    if (e.kind === 'note' || e.kind === 'rest') need(e.length);
  }
  const div = (x: QuarterTime): number => (x.num * divisions) / x.den;

  // ---- voices: numbered per staff in order of appearance, 1-4 on staff 1, 5-8 on staff 2 ... -------------------
  const streams = new Map<string, Written[]>();
  const voiceNumber = new Map<string, number>();
  const perStaff = new Map<number, number>();
  const free: LyEvent[] = []; // directions not attached to a written note: spacer and Dynamics marks, \tempo, ...
  for (const e of events) {
    if (e.kind === 'note' || (e.kind === 'rest' && e.rest !== 's' && !e.inDynamics)) {
      if (!voiceNumber.has(e.voice)) {
        const n = (perStaff.get(e.staff) ?? 0) + 1;
        if (n > 4) fail(e.pos, `a fifth voice on staff ${e.staff}`);
        perStaff.set(e.staff, n);
        voiceNumber.set(e.voice, (e.staff - 1) * 4 + n);
        streams.set(e.voice, []);
      }
      (streams.get(e.voice) as Written[]).push(e);
    } else if (e.kind === 'rest') {
      if (e.marks.length > 0) free.push(e); // a spacer: it only carries marks
    } else if (e.kind !== 'time' && e.kind !== 'bar') free.push(e);
  }
  for (const stream of streams.values()) {
    let cursor = q(0);
    for (const e of stream) {
      if (cmp(e.t, cursor) < 0)
        fail(e.pos, 'two overlapping sequences in one voice (write them as << { } \\\\ { } >> or \\new Voice)');
      cursor = add(e.t, e.length);
    }
  }
  const voices = [...streams.entries()].sort(
    (a, b) => (voiceNumber.get(a[0]) as number) - (voiceNumber.get(b[0]) as number),
  );

  // ---- tuplet groups: the first and last written event of each \tuplet -------------------------------------------
  const tupletEnds = new Map<number, { first: Written; last: Written }>();
  for (const [, stream] of voices)
    for (const e of stream) {
      if (!e.tuplet || (e.kind === 'note' && e.grace)) continue;
      if (e.tuplet.nested) fail(e.pos, 'a \\tuplet inside a \\tuplet');
      const g = tupletEnds.get(e.tuplet.group);
      if (g) g.last = e;
      else tupletEnds.set(e.tuplet.group, { first: e, last: e });
    }

  // ---- staff-wide state: clefs, key, time ----------------------------------------------------------------------
  const clefEvents = events.filter((e): e is Extract<LyEvent, { kind: 'clef' }> => e.kind === 'clef');
  const keyEvents = events.filter((e): e is Extract<LyEvent, { kind: 'key' }> => e.kind === 'key');
  const timeEvents = events.filter((e): e is Extract<LyEvent, { kind: 'time' }> => e.kind === 'time');
  const barLines = events.filter((e): e is Extract<LyEvent, { kind: 'bar' }> => e.kind === 'bar');
  const currentClef = new Map<number, string>();
  let currentKey: string | undefined;
  let currentTime: string | undefined;

  // ---- marks attached to notes: directions and notations -------------------------------------------------------
  const openWedge = new Map<string, boolean>(); // mark owner (voice, or the Dynamics line of a staff) -> hairpin open
  const openTies = new Map<string, QuarterTime>(); // voice|midi -> where the tied note ends
  // ottava n: an 8va (n = 1) prints the notes an octave lower than they sound, so its <octave-shift> is "down".
  const ottavas: { t: QuarterTime; staff: number; type: 'up' | 'down' | 'stop'; size: number; pos: Pos }[] = [];
  const openOttava = new Map<number, number>(); // staff -> size
  for (const e of events) {
    if (e.kind !== 'ottava') continue;
    const open = openOttava.get(e.staff);
    if (open !== undefined) ottavas.push({ t: e.t, staff: e.staff, type: 'stop', size: open, pos: e.pos });
    openOttava.delete(e.staff);
    if (e.octaves === 0) continue;
    const size = 7 * Math.abs(e.octaves) + 1;
    ottavas.push({ t: e.t, staff: e.staff, type: e.octaves > 0 ? 'down' : 'up', size, pos: e.pos });
    openOttava.set(e.staff, size);
  }
  for (const [staff, size] of openOttava)
    ottavas.push({ t: end, staff, type: 'stop', size, pos: { line: 0, column: 0 } });

  const dynamicDirections = (
    marks: LyMark[],
    t: QuarterTime,
    owner: string,
    staff: number,
    placement: 'above' | 'below',
    pos: Pos,
  ): WriteDirection[] => {
    const out: WriteDirection[] = [];
    const pedals = marks.filter((m): m is Extract<LyMark, { type: 'pedal' }> => m.type === 'pedal');
    const names = pedals.map((p) => p.name);
    if (names.includes('sustainOff') && names.includes('sustainOn'))
      out.push({ pedal: 'change', placement: 'below', staff });
    else if (names.includes('sustainOn')) out.push({ pedal: 'start', placement: 'below', staff });
    else if (names.includes('sustainOff')) out.push({ pedal: 'stop', placement: 'below', staff });
    for (const p of pedals) if (p.name !== 'sustainOn' && p.name !== 'sustainOff') drop(t, `\\${p.name}`);

    for (const m of marks) {
      if (m.type === 'text') {
        if (m.text === undefined) drop(t, '\\markup text');
        else out.push({ words: m.text, italic: true, placement: m.placement ?? 'above', staff });
        continue;
      }
      if (m.type !== 'dynamic') continue;
      const closeWedge = () => {
        if (openWedge.get(owner)) out.push({ wedge: 'stop', staff });
        openWedge.set(owner, false);
      };
      if (m.name === '<' || m.name === 'cr' || m.name === '>' || m.name === 'decr') {
        closeWedge();
        const crescendo = m.name === '<' || m.name === 'cr';
        out.push({ wedge: crescendo ? 'crescendo' : 'diminuendo', placement: m.placement ?? placement, staff });
        openWedge.set(owner, true);
      } else if (m.name === '!') closeWedge();
      else if (m.name in TEXT_SPANNERS) {
        closeWedge();
        out.push({ words: TEXT_SPANNERS[m.name] as string, italic: true, placement: m.placement ?? placement, staff });
      } else if (DYNAMICS.has(m.name)) {
        closeWedge();
        out.push({ dynamics: m.name, placement: m.placement ?? placement, staff });
      } else fail(pos, `dynamic \\${m.name} (MusicXML has no such mark)`);
    }
    return out;
  };

  const writeNote = (e: NoteEvent, voice: string, directions: WriteDirection[]): WriteNote[] => {
    const type = TYPES.get(e.base);
    if (!type) fail(e.pos, `note value ${e.base}`);
    if (cmp(e.factor, q(1)) !== 0) fail(e.pos, 'a note value scaled with *n/m');
    const number = String(voiceNumber.get(e.voice));
    const notations: Pick<WriteNote, 'slurs' | 'articulations' | 'ornament' | 'fermata' | 'fingering'> = {};
    let arpeggiate = false;
    const noteMarks = (marks: LyMark[], target: typeof notations) => {
      for (const m of marks) {
        if (m.type === 'slur') {
          target.slurs = [...(target.slurs ?? []), { type: m.start ? 'start' : 'stop', number: m.phrasing ? 2 : 1 }];
        } else if (m.type === 'articulation') {
          const a = ARTICULATIONS[m.name];
          if (a) target.articulations = [...(target.articulations ?? []), a];
          else drop(e.t, `articulation '${m.name}'`);
        } else if (m.type === 'ornament') {
          const ornament = ORNAMENTS[m.name];
          if (ornament) target.ornament = ornament;
          else if (FERMATAS.has(m.name)) target.fermata = true;
          else if (m.name === 'arpeggio') arpeggiate = true;
          else if (NAVIGATION.has(m.name)) fail(e.pos, `\\${m.name} on a note (navigation is not converted)`);
          else if (!SILENT.has(m.name)) drop(e.t, `\\${m.name}`);
        } else if (m.type === 'fingering') {
          if (target.fingering === undefined) target.fingering = m.finger;
          else drop(e.t, `second fingering ${m.finger}`);
        }
      }
    };
    noteMarks(e.marks, notations);
    const memberNotations = e.pitches.map((p) => {
      const own: typeof notations = {};
      noteMarks(p.marks, own);
      return own;
    });
    directions.push(...dynamicDirections(e.marks, e.t, voice, e.staff, 'below', e.pos));
    for (const p of e.pitches) directions.push(...dynamicDirections(p.marks, e.t, voice, e.staff, 'below', e.pos));

    const tupletEnd = e.tuplet ? tupletEnds.get(e.tuplet.group) : undefined;
    return e.pitches.map((p, i) => {
      const midi = spellingMidi(p.spelling);
      const key = `${voice}|${midi}`;
      const tieStop = !e.grace && openTies.has(key) && cmp(openTies.get(key) as QuarterTime, e.t) === 0;
      if (!e.grace) {
        openTies.delete(key);
        if (p.tie) openTies.set(key, add(e.t, e.length));
      }
      const note: WriteNote = {
        pitch: {
          step: p.spelling.step,
          octave: p.spelling.octave,
          ...(p.spelling.alter ? { alter: p.spelling.alter } : {}),
        },
        duration: e.grace ? 0 : div(e.length),
        voice: number,
        type: type as WriteDuration,
        staff: e.staff,
        ...(e.dots ? { dots: e.dots } : {}),
        ...(i > 0 ? { chord: true } : {}),
        ...(p.tie && !e.grace
          ? { tie: { start: true, ...(tieStop ? { stop: true } : {}) } }
          : tieStop
            ? { tie: { stop: true } }
            : {}),
        ...(e.grace ? { grace: { slash: e.grace === '\\acciaccatura' || e.grace === '\\slashedGrace' } } : {}),
        ...(e.tuplet ? { timeModification: { actual: e.tuplet.actual, normal: e.tuplet.normal } } : {}),
        ...(arpeggiate ? { arpeggiate: true } : {}),
        ...(memberNotations[i] as typeof notations),
      };
      if (i === 0) {
        if (notations.slurs) note.slurs = [...(note.slurs ?? []), ...notations.slurs];
        if (notations.articulations) note.articulations = [...(note.articulations ?? []), ...notations.articulations];
        if (notations.ornament) note.ornament = notations.ornament;
        if (notations.fermata) note.fermata = true;
        if (notations.fingering !== undefined && note.fingering === undefined) note.fingering = notations.fingering;
        if (tupletEnd && tupletEnd.first !== tupletEnd.last) {
          if (tupletEnd.first === e) note.tuplet = { type: 'start' };
          else if (tupletEnd.last === e) note.tuplet = { type: 'stop' };
        }
      }
      return note;
    });
  };

  const writeRest = (
    e: Extract<LyEvent, { kind: 'rest' }>,
    bar: ReferenceBar,
    measure: boolean,
    directions: WriteDirection[],
  ) => {
    const type = TYPES.get(e.base);
    if (!type) fail(e.pos, `rest value ${e.base}`);
    directions.push(...dynamicDirections(e.marks, e.t, e.voice, e.staff, 'below', e.pos));
    for (const m of e.marks)
      if (m.type === 'ornament' && FERMATAS.has(m.name)) {
        /* a fermata over a rest: written on the rest below */
      } else if (m.type !== 'dynamic' && m.type !== 'pedal' && m.type !== 'text') drop(e.t, `${m.type} on a rest`);
    const fermata = e.marks.some((m) => m.type === 'ornament' && FERMATAS.has(m.name));
    const tupletEnd = e.tuplet ? tupletEnds.get(e.tuplet.group) : undefined;
    const rest: WriteNote = {
      rest: true,
      ...(measure ? { measureRest: true } : {}),
      duration: div(measure ? bar.length : e.length),
      voice: String(voiceNumber.get(e.voice)),
      type: type as WriteDuration,
      staff: e.staff,
      ...(e.dots ? { dots: e.dots } : {}),
      ...(e.tuplet ? { timeModification: { actual: e.tuplet.actual, normal: e.tuplet.normal } } : {}),
      ...(fermata ? { fermata: true } : {}),
    };
    if (tupletEnd && tupletEnd.first !== tupletEnd.last) {
      if (tupletEnd.first === e) rest.tuplet = { type: 'start' };
      else if (tupletEnd.last === e) rest.tuplet = { type: 'stop' };
    }
    return rest;
  };

  // ---- measures --------------------------------------------------------------------------------------------------
  const measures: WriteMeasure[] = [];
  bars.forEach((bar, index) => {
    const barEnd = add(bar.start, bar.length);
    const at = (t: QuarterTime) => cmp(t, bar.start) === 0;
    const inside = (t: QuarterTime) => cmp(t, bar.start) > 0 && cmp(t, barEnd) < 0;

    // Attributes at the bar line.
    const attributes: WriteMeasureAttributes = {};
    if (index === 0) attributes.divisions = divisions;
    const key = keyAt(keyEvents, bar.start, index === 0);
    if (key && key.text !== currentKey) {
      attributes.key = key.key;
      currentKey = key.text;
    } else if (index === 0) {
      attributes.key = { fifths: 0 };
      currentKey = '0 major';
    }
    const time = timeEvents.find((e) => at(e.t)) ?? (index === 0 ? { num: 4, den: 4 } : undefined);
    if (time && `${time.num}/${time.den}` !== currentTime) {
      attributes.time = { beats: String(time.num), beatType: time.den };
      currentTime = `${time.num}/${time.den}`;
    }
    if (index === 0) attributes.staves = staves;
    const clefs: { number: number; sign: string; line: number }[] = [];
    for (let s = 1; s <= staves; s++) {
      const clef = clefEvents.filter((e) => e.staff === s && at(e.t)).at(-1);
      const name = clef?.name ?? (index === 0 ? 'treble' : undefined);
      if (name === undefined || name === currentClef.get(s)) continue;
      clefs.push({ number: s, ...clefOf(name, clef?.pos) });
      currentClef.set(s, name);
    }
    if (clefs.length > 0) attributes.clefs = clefs;

    // Things placed at a time inside the bar: attached before the element that starts there (or after the element
    // that ends there, for an 8va's end).
    const before = new Map<Written, WriteEvent[]>();
    const after = new Map<Written, WriteEvent[]>();
    const place = (t: QuarterTime, staff: number, what: WriteEvent[], pos: Pos, preferEnd = false): void => {
      const candidates = voices.flatMap(([, stream]) =>
        stream.filter((e) => !(e.kind === 'note' && e.grace) && cmp(e.t, barEnd) < 0 && cmp(e.t, bar.start) >= 0),
      );
      const onStaff = (e: Written) => e.staff === staff;
      const starting = (e: Written) => cmp(e.t, t) === 0;
      const ending = (e: Written) => cmp(add(e.t, e.length), t) === 0;
      const pick = (test: (e: Written) => boolean) =>
        candidates.find((e) => test(e) && onStaff(e)) ?? candidates.find(test);
      const start = pick(starting);
      const stop = pick(ending);
      if (preferEnd && stop) after.set(stop, [...(after.get(stop) ?? []), ...what]);
      else if (start) {
        // Grace notes come before their principal note, so a direction at this time goes before the first of them.
        const stream = voices.find(([, s]) => s.includes(start))?.[1] as Written[];
        let first = start;
        for (let i = stream.indexOf(start) - 1; i >= 0; i--) {
          const g = stream[i] as Written;
          if (g.kind === 'note' && g.grace && cmp(g.t, t) === 0) first = g;
          else break;
        }
        before.set(first, [...(before.get(first) ?? []), ...what]);
      } else if (stop) after.set(stop, [...(after.get(stop) ?? []), ...what]);
      else fail(pos, `a mark at ${where(t)} that no note starts or ends at`);
    };
    const direction = (d: WriteDirection): WriteEvent => ({ kind: 'direction', ...d });

    // Clef and key changes inside the bar.
    for (const e of clefEvents)
      if (inside(e.t) && e.name !== currentClef.get(e.staff)) {
        place(e.t, e.staff, [{ kind: 'attributes', clefs: [{ number: e.staff, ...clefOf(e.name, e.pos) }] }], e.pos);
        currentClef.set(e.staff, e.name);
      }
    for (const e of keyEvents)
      if (inside(e.t)) {
        const k = keyOf(e.tonic, e.mode, e.pos);
        if (k.text === currentKey) continue;
        place(e.t, e.staff, [{ kind: 'attributes', key: k.key }], e.pos);
        currentKey = k.text;
      }

    // Free directions: \tempo, \ottava, marks on spacers and in Dynamics lines, standalone mark commands.
    // An 8va ends after the last note under it: its end belongs to the bar that ends there.
    for (const o of ottavas) {
      const d = direction({
        octaveShift: { type: o.type, size: o.size },
        ...(o.type === 'stop' ? {} : { placement: o.type === 'down' ? 'above' : 'below' }),
        staff: o.staff,
      });
      if (
        o.type === 'stop'
          ? cmp(o.t, bar.start) > 0 && cmp(o.t, barEnd) <= 0
          : cmp(o.t, bar.start) >= 0 && cmp(o.t, barEnd) < 0
      )
        place(o.t, o.staff, [d], o.pos, o.type === 'stop');
    }

    for (const e of free) {
      const t = e.t;
      const inThisBar =
        cmp(t, bar.start) >= 0 && (cmp(t, barEnd) < 0 || (index === bars.length - 1 && cmp(t, end) === 0));
      if (!inThisBar) continue;
      if (e.kind === 'tempo') {
        const d: WriteDirection = { placement: 'above', staff: e.staff };
        if (e.text !== undefined) {
          d.words = e.text;
          d.bold = true;
        }
        if (e.bpm !== undefined && e.beat) {
          const unit = TYPES.get(e.beat.base);
          const beat = e.beat.length;
          if (unit && e.beat.dots === 0) d.metronome = { beatUnit: unit, perMinute: e.bpm };
          else drop(t, `metronome mark with a dotted beat (${e.bpm} per minute)`);
          d.tempo = (e.bpm * beat.num) / beat.den;
        }
        if (d.words !== undefined || d.metronome || d.tempo !== undefined) place(t, e.staff, [direction(d)], e.pos);
      } else if (e.kind === 'rest') {
        // A spacer's marks: in a Dynamics line they sit between the staves (below staff 1).
        const staff = e.inDynamics ? 1 : e.staff;
        const owner = e.inDynamics ? `dynamics:${staff}` : e.voice;
        const ds = dynamicDirections(e.marks, t, owner, staff, 'below', e.pos);
        for (const m of e.marks)
          if (m.type !== 'dynamic' && m.type !== 'pedal' && m.type !== 'text') drop(t, `${m.type}`);
        if (ds.length > 0) place(t, staff, ds.map(direction), e.pos);
      } else if (e.kind === 'mark') {
        const name = e.name.slice(1);
        if (name === 'mark') {
          drop(t, 'rehearsal mark');
          continue;
        }
        const staff = e.inDynamics ? 1 : e.staff;
        const owner = e.inDynamics ? `dynamics:${staff}` : e.voice;
        const marks: LyMark[] = [];
        if (/^(sustain|sostenuto)(On|Off)$|^unaCorda$|^treCorde$/.test(name)) marks.push({ type: 'pedal', name });
        else if (name === '(' || name === ')') fail(e.pos, `phrasing slur \\${name} outside a note`);
        else marks.push({ type: 'dynamic', name });
        const ds = dynamicDirections(marks, t, owner, staff, 'below', e.pos);
        if (ds.length > 0) place(t, staff, ds.map(direction), e.pos);
      }
    }

    // The voices.
    const events: WriteEvent[] = [];
    const left: WriteBarline = { location: 'left' };
    if (bar.repeatStart) {
      left.barStyle = 'heavy-light';
      left.repeat = { direction: 'forward' };
    }
    const previous = bars[index - 1];
    const next = bars[index + 1];
    const endingText = (n: number[]) => ({ number: n.join(', '), text: `${n.join('., ')}.` });
    if (bar.endings.length > 0 && !(previous && sameEndings(previous, bar)))
      left.ending = { ...endingText(bar.endings), type: 'start' };
    if (left.repeat || left.ending) events.push({ kind: 'barline', ...left });

    let cursor = bar.start;
    let longest = bar.start;
    let wroteVoice = false;
    for (const [voiceKey, stream] of voices) {
      const here = stream.filter((e) =>
        e.kind === 'rest' && e.rest === 'R'
          ? cmp(e.t, barEnd) < 0 && cmp(add(e.t, e.length), bar.start) > 0
          : cmp(e.t, bar.start) >= 0 && cmp(e.t, barEnd) < 0,
      );
      if (here.length === 0) continue;
      if (wroteVoice && cmp(cursor, bar.start) > 0)
        events.push({ kind: 'backup', duration: div(sub(cursor, bar.start)) });
      cursor = bar.start;
      wroteVoice = true;
      for (const e of here) {
        const start = e.kind === 'rest' && e.rest === 'R' && cmp(e.t, bar.start) < 0 ? bar.start : e.t;
        if (cmp(start, cursor) > 0) events.push({ kind: 'forward', duration: div(sub(start, cursor)) });
        const stop = add(e.t, e.length);
        const isMeasureRest = e.kind === 'rest' && e.rest === 'R' && cmp(stop, barEnd) >= 0 && cmp(e.t, bar.start) <= 0;
        if (cmp(stop, barEnd) > 0 && !isMeasureRest)
          fail(e.pos, `a value that crosses the bar line at ${where(barEnd)}`);
        const directions: WriteDirection[] = [];
        const written =
          e.kind === 'note' ? writeNote(e, voiceKey, directions) : writeRest(e, bar, isMeasureRest, directions);
        events.push(...(before.get(e) ?? []));
        events.push(...directions.map(direction));
        if (Array.isArray(written)) for (const n of written) events.push({ kind: 'note', note: n });
        else events.push({ kind: 'note', note: written });
        events.push(...(after.get(e) ?? []));
        if (!(e.kind === 'note' && e.grace)) cursor = isMeasureRest ? barEnd : stop;
      }
      if (cmp(cursor, longest) > 0) longest = cursor;
    }
    // A bar the voices do not fill (the rest of it is spacers) still has its full written length.
    if (cmp(longest, barEnd) < 0) {
      if (cmp(cursor, bar.start) > 0 && cmp(cursor, longest) < 0)
        events.push({ kind: 'forward', duration: div(sub(longest, cursor)) });
      events.push({ kind: 'forward', duration: div(sub(barEnd, longest)) });
    }

    const right: WriteBarline = { location: 'right' };
    const style = barLines.filter((b) => cmp(b.t, barEnd) === 0 && b.style !== '').at(-1);
    if (style) {
      const s = BAR_STYLES[style.style];
      if (s) right.barStyle = s;
      else drop(barEnd, `bar line "${style.style}"`);
    }
    if (bar.repeatEnd) {
      right.barStyle = 'light-heavy';
      right.repeat = { direction: 'backward', ...(bar.repeatTimes ? { times: bar.repeatTimes } : {}) };
    }
    if (bar.endings.length > 0 && !(next && sameEndings(next, bar)))
      right.ending = { number: endingText(bar.endings).number, type: bar.repeatEnd ? 'stop' : 'discontinue' };
    if (right.barStyle || right.repeat || right.ending) events.push({ kind: 'barline', ...right });

    measures.push({
      number: bar.number,
      ...(index === 0 && bar.number === '0' ? { implicit: true } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      events,
    });
  });

  const xml = writeScoreXml({
    ...(meta.title !== undefined ? { title: meta.title } : {}),
    ...(meta.composer !== undefined ? { composer: meta.composer } : {}),
    ...(meta.rights !== undefined ? { rights: meta.rights } : {}),
    ...(meta.source !== undefined ? { source: meta.source } : {}),
    parts: [{ id: 'P1', name: 'Piano', measures }],
  });
  return { xml, dropped };
}

// ---- helpers ---------------------------------------------------------------------------------------------------------

function fail(pos: Pos, construct: string): never {
  throw new LyUnsupportedError(pos.line, pos.column, `${construct} (converter)`);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

function sameEndings(a: ReferenceBar, b: ReferenceBar): boolean {
  return a.endings.length === b.endings.length && a.endings.every((n, i) => n === b.endings[i]);
}

function clefOf(name: string, pos: Pos | undefined): { sign: string; line: number } {
  const clef = CLEFS[name];
  if (clef) return clef;
  if (pos) fail(pos, `\\clef "${name}"`);
  return TREBLE;
}

function keyOf(tonic: LyPitch, mode: string, pos: Pos): { key: { fifths: number; mode: string }; text: string } {
  const major = (LETTER_FIFTHS[tonic.letter] as number) + 7 * tonic.alter;
  let fifths: number;
  if (mode === 'major') fifths = major;
  else if (mode === 'minor') fifths = major - 3;
  else return fail(pos, `\\key ... \\${mode}`);
  if (fifths < -7 || fifths > 7) fail(pos, `a key signature with ${Math.abs(fifths)} accidentals`);
  return { key: { fifths, mode }, text: `${fifths} ${mode}` };
}

/** The key at a bar line; staves must agree. */
function keyAt(
  keys: Extract<LyEvent, { kind: 'key' }>[],
  t: QuarterTime,
  first: boolean,
): { key: { fifths: number; mode: string }; text: string } | undefined {
  const here = keys.filter((k) => cmp(k.t, t) === 0 || (first && cmp(k.t, t) < 0));
  if (here.length === 0) return undefined;
  const found = here.map((k) => keyOf(k.tonic, k.mode, k.pos));
  const texts = new Set(found.map((k) => k.text));
  if (texts.size > 1) fail((here[0] as { pos: Pos }).pos, 'different key signatures on different staves');
  return found[0];
}
