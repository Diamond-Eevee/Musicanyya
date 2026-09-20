export type Ticks = number;
export type NoteId = string;
export type MeasureId = string;

export interface Score {
  title: string | null;
  composer: string | null;
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
