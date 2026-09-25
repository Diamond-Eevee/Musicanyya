export type Ticks = number;
export type NoteId = string;
export type MeasureId = string;

export interface Score {
  title: string | null;
  composer: string | null;
  arranger: string | null;
  ppq: number;
  parts: Part[];
  measures: MeasureInfo[];
  tempoMarks: TempoMark[];
  navigation: NavigationMarks;
  defaultTempoUsed: boolean;
}

export interface MeasureInfo {
  index: number;
  id: MeasureId;
  label: string;
  startTick: Ticks;
  lengthTicks: Ticks;
  nominalTicks: Ticks;
  implicit: boolean;
  beatOffsetTicks: Ticks;
  time: { beats: string; beatType: number } | null;
}

export interface Part {
  index: number;
  xmlId: string;
  name: string;
  staves: number;
  instruments: Instrument[];
  notes: Note[];
  dynamics: DynamicMark[];
  soundDynamics: SoundDynamicMark[];
  wedges: Wedge[];
  transpositions: Transposition[];
  /** Clefs in force, by staff and position (feature 008: where a pressed key is printed). Every staff of the part has
   *  one at the start, the default (G2, F4 on the second staff of a two-staff part) when the file names none. */
  clefs: ClefChange[];
  /** Key signatures by position; empty when the file names none (C major applies). */
  keys: KeyChange[];
  /** Octave-shift spans (8va, 15mb, ...), one per `<octave-shift>` start. */
  octaveShifts: OctaveShiftSpan[];
}

/** A place in a part: the measure and the tick inside it. Nothing here changes timing, Note IDs or playback. */
export interface ScorePosition {
  measureIndex: number;
  onsetInMeasure: Ticks;
}

export interface ClefChange extends ScorePosition {
  /** 1-based staff (`<clef number>`, default 1). */
  staff: number;
  /** A sign the disc placement cannot use (percussion, TAB, jianpu, none) is kept as written and reported. */
  sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB' | 'jianpu' | 'none';
  /** The staff line the clef's reference pitch sits on, 1 = the bottom line; defaults G2, F4, C3. */
  line: number;
  /** `<clef-octave-change>`, e.g. -1 for a tenor G clef (G8vb). */
  octaveChange: number;
}

export interface KeyChange extends ScorePosition {
  /** `null`: the key applies to every staff of the part (`<key>` without a number). */
  staff: number | null;
  /** -7..7, `null` for a non-traditional key (`<key-step>`/`<key-alter>`): every sign is then shown. */
  fifths: number | null;
  mode: 'major' | 'minor' | null;
}

export interface OctaveShiftSpan {
  staff: number;
  start: ScorePosition;
  /** Where the shift ends: notes from here on are printed as written (a note at this position is not shifted, as the
   *  engraving prints it). One past the last measure for a shift with no stop. */
  stop: ScorePosition;
  /** Printed = sounding - octaves: an 8va (`type="down"`) is +1, an 8vb -1, a 15ma +2, a 15mb -2. */
  octaves: -2 | -1 | 1 | 2;
}

export interface Instrument {
  xmlId: string;
  name: string;
  program: number;
  bank: number | null;
  channelHint: number | null;
  percussion: boolean;
  unpitchedKey: number | null;
  volume: number | null;
  pan: number | null;
  fallback: boolean;
}

export interface Note {
  id: NoteId;
  part: number;
  staff: number;
  voice: string;
  measureIndex: number;
  onsetInMeasure: Ticks;
  onsetQuarters: { num: number; den: number };
  durationTicks: Ticks;
  /** The written pitch letter ('C'-'B'), before alter/octave; '' for an unpitched note. Ornament neighbours
   *  (data-model.md §4) step by this letter, not by the resolved MIDI key, which has already lost it. */
  step: string;
  writtenKey: number;
  soundingKey: number;
  unpitched: boolean;
  grace: null | {
    index: number;
    slash: boolean;
    stealPrevious: number | null;
    stealFollowing: number | null;
    makeTime: number | null;
  };
  tie: { start: boolean; stop: boolean };
  chord: boolean;
  instrument: string | null;
  velocityOverride: number | null;
  accent: boolean;
  fingerings: Fingering[];
  printed: boolean;
  source: { start: number; end: number };
  /** A written <trill-mark>, <mordent>, <turn> or <tremolo> (owner decision D-1); its realisation is played-along. */
  ornament: 'trill' | 'mordent' | 'turn' | 'tremolo' | null;
  /** The Score writes this chord member <arpeggiate> (owner decision D-2): the wider arpeggio spread applies. */
  arpeggiate: boolean;
}

export interface Fingering {
  text: string;
  finger: 1 | 2 | 3 | 4 | 5 | null;
  substitution: boolean;
  alternate: boolean;
  placement: 'above' | 'below' | null;
}

export interface TempoMark {
  measureIndex: number;
  onsetInMeasure: Ticks;
  qpmNum: number;
  qpmDen: number;
}

export interface NavigationMarks {
  repeats: RepeatMark[];
  endings: EndingMark[];
  targets: JumpTarget[];
  jumps: Jump[];
}

export interface RepeatMark {
  measureIndex: number;
  direction: 'forward' | 'backward';
  times?: number;
  afterJump?: boolean;
}
export interface EndingMark {
  measureIndex: number;
  type: 'start' | 'stop' | 'discontinue';
  numbers: number[];
}
export interface JumpTarget {
  measureIndex: number;
  type: 'segno' | 'coda' | 'fine';
  name?: string;
}
export interface Jump {
  measureIndex: number;
  type: 'da-capo' | 'dal-segno' | 'to-coda';
  al?: 'fine' | 'coda';
  name?: string;
  timeOnly?: number[];
}
export interface DynamicMark {
  measureIndex: number;
  onsetInMeasure: Ticks;
  type: string;
}
export interface SoundDynamicMark {
  measureIndex: number;
  onsetInMeasure: Ticks;
  percent: number;
}
export interface Wedge {
  measureIndex: number;
  onsetInMeasure: Ticks;
  type: 'crescendo' | 'diminuendo' | 'stop';
  number: number;
}
export interface Transposition {
  measureIndex: number;
  onsetInMeasure: Ticks;
  chromatic: number;
  diatonic?: number;
  octaveChange?: number;
}
